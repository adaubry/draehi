#!/usr/bin/env bash
set -euo pipefail

# Draehi Complete AWS Deployment Script
# Deploys entire stack: SurrealDB on EKS, KeyDB on ElastiCache, App on EC2
# Follows https://surrealdb.com/docs/surrealdb/deployment/amazon
# Usage: ./scripts/deploy-complete.sh --stack-name draehi-prod

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Cleanup tracking
TEMP_FILES=()
TEMP_DIRS=()
CLEANUP_NEEDED=false

cleanup() {
    local exit_code=$?

    if [[ "${CLEANUP_NEEDED}" == "true" ]]; then
        echo
        echo "🧹 Cleaning up..."

        for file in "${TEMP_FILES[@]}"; do
            [[ -f "$file" ]] && rm -f "$file"
        done

        for dir in "${TEMP_DIRS[@]}"; do
            [[ -d "$dir" ]] && rm -rf "$dir"
        done
    fi

    if [[ $exit_code -eq 0 ]]; then
        echo "✅ Deployment complete"
    else
        echo "❌ Deployment failed (exit code: $exit_code)"
    fi

    exit $exit_code
}

trap cleanup EXIT ERR INT TERM

# Parse arguments
STACK_NAME="${1:-draehi-prod}"
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_PROFILE="${AWS_PROFILE:-default}"

echo "═════════════════════════════════════════════════════"
echo "🚀 Draehi AWS Deployment - Complete Stack"
echo "═════════════════════════════════════════════════════"
echo

# Check prerequisites
echo "=== Step 1/6: Checking Prerequisites ==="
echo

check_command() {
    local cmd=$1
    local install_msg=$2

    if ! command -v "${cmd}" &> /dev/null; then
        echo "❌ ${cmd} not found"
        echo "   ${install_msg}"
        return 1
    fi

    echo "✅ ${cmd}"
    return 0
}

if ! check_command "aws" "Install AWS CLI: https://aws.amazon.com/cli"; then exit 1; fi
if ! check_command "kubectl" "Install kubectl: https://kubernetes.io/docs/tasks/tools"; then exit 1; fi
if ! check_command "helm" "Install Helm: https://helm.sh/docs/intro/install"; then exit 1; fi

echo

# Check AWS credentials
echo "=== Step 2/6: Verifying AWS Credentials ==="
echo

if ! aws sts get-caller-identity --profile "${AWS_PROFILE}" > /dev/null 2>&1; then
    echo "❌ AWS credentials not configured"
    echo "   Run: aws configure --profile ${AWS_PROFILE}"
    exit 1
fi

AWS_ACCOUNT=$(aws sts get-caller-identity --profile "${AWS_PROFILE}" --query Account --output text)
AWS_REGION_ACTUAL=$(aws configure get region --profile "${AWS_PROFILE}" || echo "${AWS_REGION}")

echo "✅ AWS Account: ${AWS_ACCOUNT}"
echo "✅ Region: ${AWS_REGION_ACTUAL}"
echo

# Build application
echo "=== Step 3/6: Building Application ==="
echo

echo "→ Running type check..."
if npm run type-check; then
    echo "✅ Type check passed"
else
    echo "❌ Type check failed"
    exit 1
fi

echo
echo "→ Building production bundle..."
if npm run build; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
    exit 1
fi

echo

# Create Docker image
echo "=== Step 4/6: Building Docker Image ==="
echo

DOCKER_REGISTRY="${DOCKER_REGISTRY:-${AWS_ACCOUNT}.dkr.ecr.${AWS_REGION_ACTUAL}.amazonaws.com}"
IMAGE_NAME="${DOCKER_REGISTRY}/draehi:latest"

echo "→ Image: ${IMAGE_NAME}"
echo "→ Building image (this may take a few minutes)..."

if docker build \
    -t "${IMAGE_NAME}" \
    -f Dockerfile \
    . > /tmp/docker-build.log 2>&1; then
    echo "✅ Docker image built"
else
    echo "❌ Docker build failed"
    cat /tmp/docker-build.log
    exit 1
fi

echo

# Push to ECR
echo "=== Step 5/6: Pushing to Amazon ECR ==="
echo

echo "→ Authenticating with ECR..."
if aws ecr get-login-password --region "${AWS_REGION_ACTUAL}" --profile "${AWS_PROFILE}" | \
    docker login --username AWS --password-stdin "${DOCKER_REGISTRY}" > /dev/null 2>&1; then
    echo "✅ Authenticated with ECR"
else
    echo "⚠️  ECR authentication failed, skipping image push"
fi

echo
echo "→ Pushing image..."
if docker push "${IMAGE_NAME}"; then
    echo "✅ Image pushed to ECR"
else
    echo "⚠️  Image push failed, continuing..."
fi

echo

# Deploy stack
echo "=== Step 6/6: Deploying Infrastructure & Application ==="
echo

echo "→ Stack Name: ${STACK_NAME}"
echo "→ Region: ${AWS_REGION_ACTUAL}"
echo

read -p "Ready to deploy? (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "→ Deployment cancelled"
    exit 0
fi

echo "→ Deploying SurrealDB on EKS..."
if "${SCRIPT_DIR}/deploy-surrealdb-eks.sh" \
    --stack-name "${STACK_NAME}-surrealdb" \
    --region "${AWS_REGION_ACTUAL}" \
    --profile "${AWS_PROFILE}"; then
    echo "✅ SurrealDB deployed"
else
    echo "❌ SurrealDB deployment failed"
    exit 1
fi

echo

echo "→ Deploying KeyDB on ElastiCache..."
if "${SCRIPT_DIR}/deploy-keydb-eks.sh" \
    --stack-name "${STACK_NAME}-keydb" \
    --region "${AWS_REGION_ACTUAL}" \
    --profile "${AWS_PROFILE}"; then
    echo "✅ KeyDB deployed"
else
    echo "⚠️  KeyDB deployment warning, continuing..."
fi

echo

echo "→ Deploying S3 buckets..."
if "${SCRIPT_DIR}/deploy-s3-assets.sh" \
    --stack-name "${STACK_NAME}" \
    --region "${AWS_REGION_ACTUAL}" \
    --profile "${AWS_PROFILE}"; then
    echo "✅ S3 configured"
else
    echo "⚠️  S3 setup warning, continuing..."
fi

echo

echo "→ Deploying Next.js app on EC2..."
if "${SCRIPT_DIR}/deploy-ec2.sh" \
    --stack-name "${STACK_NAME}" \
    --image "${IMAGE_NAME}" \
    --region "${AWS_REGION_ACTUAL}" \
    --profile "${AWS_PROFILE}"; then
    echo "✅ App deployed"
else
    echo "❌ App deployment failed"
    exit 1
fi

echo
echo "═════════════════════════════════════════════════════"
echo "✅ Deployment Complete!"
echo "═════════════════════════════════════════════════════"
echo
echo "Stack Resources:"
echo "  • EKS Cluster: ${STACK_NAME}-eks"
echo "  • SurrealDB:   http://${STACK_NAME}-surrealdb.eks.amazonaws.com:8000"
echo "  • ElastiCache: redis://${STACK_NAME}-keydb.elasticache.amazonaws.com:6379"
echo "  • S3 Buckets:  s3://${STACK_NAME}-assets/"
echo "  • EC2 App:     http://<instance-public-ip>:3000"
echo
echo "Next steps:"
echo "  • Check CloudWatch logs"
echo "  • Configure Route 53 DNS"
echo "  • Set up CloudFront CDN (optional)"
echo "  • Configure SSL with ACM"
echo
