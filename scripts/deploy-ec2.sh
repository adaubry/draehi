#!/usr/bin/env bash
set -euo pipefail

# Draehi Next.js App Deployment on EC2
# Deploys pre-built Docker image to EC2 instance
# Usage: ./scripts/deploy-ec2.sh --stack-name draehi --image <image-uri> [--region us-east-1]

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
        echo "✅ EC2 deployment complete"
    else
        echo "❌ EC2 deployment failed (exit code: $exit_code)"
    fi

    exit $exit_code
}

trap cleanup EXIT ERR INT TERM

# Parse arguments
STACK_NAME=""
IMAGE_URI=""
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_PROFILE="${AWS_PROFILE:-default}"
INSTANCE_TYPE="${INSTANCE_TYPE:-t3.medium}"

while [[ $# -gt 0 ]]; do
    case $1 in
        --stack-name) STACK_NAME="$2"; shift 2 ;;
        --image) IMAGE_URI="$2"; shift 2 ;;
        --region) AWS_REGION="$2"; shift 2 ;;
        --profile) AWS_PROFILE="$2"; shift 2 ;;
        --instance-type) INSTANCE_TYPE="$2"; shift 2 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

if [[ -z "${STACK_NAME}" ]] || [[ -z "${IMAGE_URI}" ]]; then
    echo "Usage: $0 --stack-name <name> --image <uri> [--instance-type t3.medium]"
    exit 1
fi

echo "═════════════════════════════════════════════════════"
echo "☁️  Next.js App Deployment - EC2"
echo "═════════════════════════════════════════════════════"
echo

echo "Configuration:"
echo "  Stack Name: ${STACK_NAME}"
echo "  Docker Image: ${IMAGE_URI}"
echo "  Instance Type: ${INSTANCE_TYPE}"
echo "  Region: ${AWS_REGION}"
echo

# Check prerequisites
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found"
    exit 1
fi
echo "✅ AWS CLI found"

echo

# Find or create security group
echo "=== Configuring Security Group ==="
echo

SG_NAME="${STACK_NAME}-app-sg"
VPC_ID=$(aws ec2 describe-vpcs \
    --filters "Name=isDefault,Values=true" \
    --region "${AWS_REGION}" \
    --profile "${AWS_PROFILE}" \
    --query 'Vpcs[0].VpcId' \
    --output text 2>/dev/null || echo "")

if [[ -z "${VPC_ID}" ]]; then
    echo "⚠️  Default VPC not found, will use EC2-Classic"
else
    echo "✅ Using VPC: ${VPC_ID}"
fi

echo

# Create or update security group
echo "→ Checking security group..."
SG_ID=$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=${SG_NAME}" \
    --region "${AWS_REGION}" \
    --profile "${AWS_PROFILE}" \
    --query 'SecurityGroups[0].GroupId' \
    --output text 2>/dev/null || echo "")

if [[ -z "${SG_ID}" ]] || [[ "${SG_ID}" == "None" ]]; then
    echo "→ Creating security group: ${SG_NAME}"

    if [[ -n "${VPC_ID}" ]] && [[ "${VPC_ID}" != "None" ]]; then
        SG_ID=$(aws ec2 create-security-group \
            --group-name "${SG_NAME}" \
            --description "Draehi app security group" \
            --vpc-id "${VPC_ID}" \
            --region "${AWS_REGION}" \
            --profile "${AWS_PROFILE}" \
            --query 'GroupId' \
            --output text)
    else
        SG_ID=$(aws ec2 create-security-group \
            --group-name "${SG_NAME}" \
            --description "Draehi app security group" \
            --region "${AWS_REGION}" \
            --profile "${AWS_PROFILE}" \
            --query 'GroupId' \
            --output text)
    fi

    echo "✅ Security group created: ${SG_ID}"
else
    echo "✅ Security group exists: ${SG_ID}"
fi

echo

# Configure security group rules
echo "→ Configuring firewall rules..."

# HTTP
aws ec2 authorize-security-group-ingress \
    --group-id "${SG_ID}" \
    --protocol tcp \
    --port 80 \
    --cidr 0.0.0.0/0 \
    --region "${AWS_REGION}" \
    --profile "${AWS_PROFILE}" \
    2>/dev/null || echo "  ⊘ HTTP rule already exists"

# HTTPS
aws ec2 authorize-security-group-ingress \
    --group-id "${SG_ID}" \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0 \
    --region "${AWS_REGION}" \
    --profile "${AWS_PROFILE}" \
    2>/dev/null || echo "  ⊘ HTTPS rule already exists"

# App port
aws ec2 authorize-security-group-ingress \
    --group-id "${SG_ID}" \
    --protocol tcp \
    --port 3000 \
    --cidr 0.0.0.0/0 \
    --region "${AWS_REGION}" \
    --profile "${AWS_PROFILE}" \
    2>/dev/null || echo "  ⊘ App port rule already exists"

# SSH
aws ec2 authorize-security-group-ingress \
    --group-id "${SG_ID}" \
    --protocol tcp \
    --port 22 \
    --cidr 0.0.0.0/0 \
    --region "${AWS_REGION}" \
    --profile "${AWS_PROFILE}" \
    2>/dev/null || echo "  ⊘ SSH rule already exists"

echo "✅ Security group configured"

echo

# Create user data script
echo "=== Preparing EC2 User Data ==="
echo

TEMP_USERDATA=$(mktemp)
TEMP_FILES+=("${TEMP_USERDATA}")
CLEANUP_NEEDED=true

cat > "${TEMP_USERDATA}" << EOF
#!/bin/bash
set -euo pipefail

# Update system
yum update -y
yum install -y docker git

# Start Docker
systemctl start docker
systemctl enable docker
usermod -aG docker ec2-user

# Login to ECR
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${IMAGE_URI%/*}

# Pull image
docker pull ${IMAGE_URI}

# Run container
docker run -d \
  --name draehi-app \
  --restart always \
  -p 80:3000 \
  -p 443:3000 \
  -e NODE_ENV=production \
  \${IMAGE_URI}

# Setup CloudWatch logs (optional)
yum install -y amazon-cloudwatch-agent
systemctl enable amazon-cloudwatch-agent

echo "✅ Draehi app deployed"
EOF

echo "✅ User data script prepared"

echo

# Launch EC2 instance
echo "=== Launching EC2 Instance ==="
echo

# Get latest Ubuntu AMI
AMI_ID=$(aws ec2 describe-images \
    --owners amazon \
    --filters "Name=name,Values=amzn2-ami-hvm-*-x86_64-gp2" \
    --region "${AWS_REGION}" \
    --profile "${AWS_PROFILE}" \
    --query 'sort_by(Images, &CreationDate)[-1].ImageId' \
    --output text 2>/dev/null || echo "ami-0c55b159cbfafe1f0")

echo "→ Using AMI: ${AMI_ID}"

# Create IAM role for EC2
echo "→ Creating IAM role..."
TEMP_POLICY=$(mktemp)
TEMP_FILES+=("${TEMP_POLICY}")

cat > "${TEMP_POLICY}" << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetAuthorizationToken"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:PutMetricData",
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
EOF

# Launch instance
echo "→ Launching instance type ${INSTANCE_TYPE}..."

INSTANCE_ID=$(aws ec2 run-instances \
    --image-id "${AMI_ID}" \
    --instance-type "${INSTANCE_TYPE}" \
    --security-group-ids "${SG_ID}" \
    --user-data file://"${TEMP_USERDATA}" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=${STACK_NAME}-app}]" \
    --region "${AWS_REGION}" \
    --profile "${AWS_PROFILE}" \
    --query 'Instances[0].InstanceId' \
    --output text 2>/dev/null || echo "")

if [[ -z "${INSTANCE_ID}" ]]; then
    echo "❌ Failed to launch instance"
    exit 1
fi

echo "✅ Instance launched: ${INSTANCE_ID}"

echo

# Wait for instance and get details
echo "→ Waiting for instance to be running..."
aws ec2 wait instance-running \
    --instance-ids "${INSTANCE_ID}" \
    --region "${AWS_REGION}" \
    --profile "${AWS_PROFILE}" 2>/dev/null || echo "⚠️  Timeout waiting for instance"

echo

PUBLIC_IP=$(aws ec2 describe-instances \
    --instance-ids "${INSTANCE_ID}" \
    --region "${AWS_REGION}" \
    --profile "${AWS_PROFILE}" \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text 2>/dev/null || echo "pending")

echo "═════════════════════════════════════════════════════"
echo "✅ EC2 Deployment Complete"
echo "═════════════════════════════════════════════════════"
echo
echo "Instance Details:"
echo "  Instance ID: ${INSTANCE_ID}"
echo "  Instance Type: ${INSTANCE_TYPE}"
echo "  Public IP: ${PUBLIC_IP}"
echo "  Region: ${AWS_REGION}"
echo
echo "Access the application:"
echo "  http://${PUBLIC_IP}:3000"
echo "  (or use your domain name once configured)"
echo
echo "View logs:"
echo "  aws ec2-instance-connect ssh --instance-id ${INSTANCE_ID}"
echo "  docker logs draehi-app"
echo
echo "Next steps:"
echo "  1. Configure Route 53 DNS record"
echo "  2. Set up ALB with SSL certificate"
echo "  3. Configure CloudWatch monitoring"
echo "  4. Set up auto-scaling (optional)"
echo
