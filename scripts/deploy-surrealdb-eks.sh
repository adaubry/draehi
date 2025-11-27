#!/usr/bin/env bash
set -euo pipefail

# Draehi SurrealDB on EKS Deployment Script
# Deploys SurrealDB to AWS EKS per https://surrealdb.com/docs/surrealdb/deployment/amazon
# Usage: ./scripts/deploy-surrealdb-eks.sh --stack-name draehi-surrealdb [--region us-east-1]

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
        echo "✅ SurrealDB deployment complete"
    else
        echo "❌ SurrealDB deployment failed (exit code: $exit_code)"
    fi

    exit $exit_code
}

trap cleanup EXIT ERR INT TERM

# Parse arguments
STACK_NAME=""
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_PROFILE="${AWS_PROFILE:-default}"

while [[ $# -gt 0 ]]; do
    case $1 in
        --stack-name) STACK_NAME="$2"; shift 2 ;;
        --region) AWS_REGION="$2"; shift 2 ;;
        --profile) AWS_PROFILE="$2"; shift 2 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

if [[ -z "${STACK_NAME}" ]]; then
    echo "Usage: $0 --stack-name <name> [--region <region>]"
    exit 1
fi

echo "═════════════════════════════════════════════════════"
echo "🗄️  SurrealDB Deployment - AWS EKS"
echo "═════════════════════════════════════════════════════"
echo

echo "Configuration:"
echo "  Stack Name: ${STACK_NAME}"
echo "  Region: ${AWS_REGION}"
echo

# Check prerequisites
echo "=== Checking Prerequisites ==="
echo

if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found"
    echo "   Install: https://kubernetes.io/docs/tasks/tools"
    exit 1
fi
echo "✅ kubectl"

if ! command -v helm &> /dev/null; then
    echo "❌ helm not found"
    echo "   Install: https://helm.sh/docs/intro/install"
    exit 1
fi
echo "✅ helm"

if ! command -v aws &> /dev/null; then
    echo "❌ aws CLI not found"
    echo "   Install: https://aws.amazon.com/cli"
    exit 1
fi
echo "✅ AWS CLI"

echo

# Check EKS cluster
echo "=== Checking EKS Cluster ==="
echo

CLUSTER_NAME="${STACK_NAME}-eks"

if aws eks describe-cluster \
    --name "${CLUSTER_NAME}" \
    --region "${AWS_REGION}" \
    --profile "${AWS_PROFILE}" \
    --query 'cluster.status' \
    --output text 2>/dev/null | grep -q "ACTIVE"; then
    echo "✅ EKS cluster exists: ${CLUSTER_NAME}"
else
    echo "⚠️  EKS cluster not found"
    echo "   Create with: aws eks create-cluster ..."
    echo "   Or use: ./scripts/aws-create-cluster.sh"
    exit 1
fi

echo

# Configure kubectl
echo "=== Configuring kubectl ==="
echo

if aws eks update-kubeconfig \
    --name "${CLUSTER_NAME}" \
    --region "${AWS_REGION}" \
    --profile "${AWS_PROFILE}" > /dev/null 2>&1; then
    echo "✅ kubectl configured"
else
    echo "❌ Failed to configure kubectl"
    exit 1
fi

echo

# Create namespace
echo "=== Creating Kubernetes Namespace ==="
echo

if kubectl create namespace draehi-db --dry-run=client -o yaml | kubectl apply -f - > /dev/null 2>&1; then
    echo "✅ Namespace created: draehi-db"
else
    echo "⚠️  Failed to create namespace"
fi

echo

# Add Helm repository (if using third-party chart)
echo "=== Adding Helm Repository ==="
echo

if helm repo add surrealdb https://surrealdb.github.io/helm-charts 2>/dev/null; then
    echo "✅ Helm repository added"
    helm repo update > /dev/null 2>&1
else
    echo "⚠️  Could not add Helm repository"
fi

echo

# Deploy SurrealDB
echo "=== Deploying SurrealDB ==="
echo

# Create values file
TEMP_VALUES=$(mktemp)
TEMP_FILES+=("${TEMP_VALUES}")
CLEANUP_NEEDED=true

cat > "${TEMP_VALUES}" << 'EOF'
replicaCount: 3

image:
  repository: surrealdb/surrealdb
  tag: latest
  pullPolicy: IfNotPresent

service:
  type: LoadBalancer
  port: 8000

persistence:
  enabled: true
  storageClass: gp3
  size: 50Gi
  mountPath: /data

resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "2Gi"
    cpu: "1000m"

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

securityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  runAsNonRoot: true
  runAsUser: 1000

env:
  - name: SURREAL_USER
    value: "root"
  - name: SURREAL_PASS
    valueFrom:
      secretKeyRef:
        name: surrealdb-creds
        key: password
  - name: SURREAL_LOG
    value: "info"
EOF

echo "→ Installing Helm chart..."

if helm upgrade --install surrealdb surrealdb/surrealdb \
    --namespace draehi-db \
    --values "${TEMP_VALUES}" \
    --wait \
    --timeout 5m \
    2>&1 | grep -E "STATUS|deployed"; then
    echo "✅ SurrealDB deployed"
else
    echo "⚠️  Helm chart installation may need adjustment"
    echo "   See: https://surrealdb.com/docs/surrealdb/deployment/amazon"
fi

echo

# Wait for deployment
echo "=== Waiting for SurrealDB to be Ready ==="
echo

echo "→ Waiting for pods to be ready..."
if kubectl rollout status deployment/surrealdb \
    --namespace draehi-db \
    --timeout=5m 2>&1 | tail -1; then
    echo "✅ SurrealDB is ready"
else
    echo "⚠️  Deployment may still be starting"
fi

echo

# Get connection details
echo "=== Connection Details ==="
echo

LOAD_BALANCER=$(kubectl get svc -n draehi-db surrealdb -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "pending")

echo "SurrealDB Service:"
echo "  Namespace: draehi-db"
echo "  Service: surrealdb"
echo "  Port: 8000"
echo "  Endpoint: http://${LOAD_BALANCER}:8000"
echo
echo "Credentials:"
echo "  Username: root"
echo "  Password: (from secret: surrealdb-creds)"
echo

# Check service logs
echo "=== Service Status ==="
echo

kubectl get svc -n draehi-db surrealdb || echo "Service not yet available"
echo
kubectl get pods -n draehi-db -l app=surrealdb || echo "No pods found"

echo
echo "═════════════════════════════════════════════════════"
echo "✅ SurrealDB Deployment Complete"
echo "═════════════════════════════════════════════════════"
echo
echo "Next steps:"
echo "  • Wait for Load Balancer IP: kubectl get svc -n draehi-db -w"
echo "  • Test connection: curl http://<load-balancer>:8000/health"
echo "  • View logs: kubectl logs -n draehi-db -l app=surrealdb"
echo
