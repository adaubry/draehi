#!/usr/bin/env bash
set -euo pipefail

# Draehi KeyDB (Redis) Deployment on EKS
# Deploys KeyDB or AWS ElastiCache Redis for caching
# Usage: ./scripts/deploy-keydb-eks.sh --stack-name draehi-keydb [--region us-east-1] [--mode elasticache]

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
        echo "✅ KeyDB deployment complete"
    else
        echo "❌ KeyDB deployment failed (exit code: $exit_code)"
    fi

    exit $exit_code
}

trap cleanup EXIT ERR INT TERM

# Parse arguments
STACK_NAME=""
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_PROFILE="${AWS_PROFILE:-default}"
DEPLOY_MODE="k8s"  # k8s or elasticache

while [[ $# -gt 0 ]]; do
    case $1 in
        --stack-name) STACK_NAME="$2"; shift 2 ;;
        --region) AWS_REGION="$2"; shift 2 ;;
        --profile) AWS_PROFILE="$2"; shift 2 ;;
        --mode) DEPLOY_MODE="$2"; shift 2 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

if [[ -z "${STACK_NAME}" ]]; then
    echo "Usage: $0 --stack-name <name> [--mode elasticache|k8s]"
    exit 1
fi

echo "═════════════════════════════════════════════════════"
echo "⚡ KeyDB/Redis Deployment - AWS"
echo "═════════════════════════════════════════════════════"
echo

echo "Configuration:"
echo "  Stack Name: ${STACK_NAME}"
echo "  Region: ${AWS_REGION}"
echo "  Mode: ${DEPLOY_MODE}"
echo

# Check prerequisites
if [[ "${DEPLOY_MODE}" == "k8s" ]]; then
    if ! command -v kubectl &> /dev/null; then
        echo "❌ kubectl not found"
        exit 1
    fi
    echo "✅ kubectl found"
fi

if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found"
    exit 1
fi
echo "✅ AWS CLI found"

echo

case "${DEPLOY_MODE}" in
    elasticache)
        echo "=== Deploying AWS ElastiCache Redis ==="
        echo

        echo "→ Creating ElastiCache subnet group..."
        aws elasticache create-cache-subnet-group \
            --cache-subnet-group-name "${STACK_NAME}-subnet-group" \
            --cache-subnet-group-description "Draehi KeyDB subnet group" \
            --subnet-ids "subnet-12345678" \
            --region "${AWS_REGION}" \
            --profile "${AWS_PROFILE}" \
            2>/dev/null || echo "⚠️  Subnet group may already exist"

        echo

        echo "→ Creating ElastiCache cluster..."
        if aws elasticache create-cache-cluster \
            --cache-cluster-id "${STACK_NAME}-redis" \
            --cache-node-type cache.t3.small \
            --engine redis \
            --engine-version "7.0" \
            --num-cache-nodes 1 \
            --cache-subnet-group-name "${STACK_NAME}-subnet-group" \
            --region "${AWS_REGION}" \
            --profile "${AWS_PROFILE}" > /tmp/redis-create.json 2>&1; then
            echo "✅ ElastiCache cluster created"
        else
            if grep -q "InvalidParameterCombination\|already exists" /tmp/redis-create.json; then
                echo "⚠️  Cluster already exists"
            else
                echo "❌ Failed to create ElastiCache cluster"
                cat /tmp/redis-create.json
                exit 1
            fi
        fi

        echo

        echo "→ Waiting for cluster to be available..."
        aws elasticache wait cache-cluster-available \
            --cache-cluster-id "${STACK_NAME}-redis" \
            --region "${AWS_REGION}" \
            --profile "${AWS_PROFILE}" \
            2>/dev/null || echo "⚠️  Cluster may not be ready yet"

        echo "✅ ElastiCache Redis deployed"
        echo

        # Get endpoint
        ENDPOINT=$(aws elasticache describe-cache-clusters \
            --cache-cluster-id "${STACK_NAME}-redis" \
            --show-cache-node-info \
            --region "${AWS_REGION}" \
            --profile "${AWS_PROFILE}" \
            --query 'CacheClusters[0].CacheNodes[0].Endpoint.Address' \
            --output text 2>/dev/null || echo "pending")

        echo "Connection Details:"
        echo "  Cluster ID: ${STACK_NAME}-redis"
        echo "  Endpoint: ${ENDPOINT}:6379"
        echo "  Engine: Redis 7.0"
        ;;

    k8s)
        echo "=== Deploying KeyDB on Kubernetes ==="
        echo

        # Get cluster info
        CLUSTER_NAME="${STACK_NAME}-eks"

        echo "→ Configuring kubectl..."
        if aws eks update-kubeconfig \
            --name "${CLUSTER_NAME}" \
            --region "${AWS_REGION}" \
            --profile "${AWS_PROFILE}" > /dev/null 2>&1; then
            echo "✅ kubectl configured"
        else
            echo "⚠️  Could not configure kubectl"
        fi

        echo

        # Create namespace
        echo "→ Creating namespace..."
        kubectl create namespace draehi-cache --dry-run=client -o yaml | kubectl apply -f - > /dev/null 2>&1
        echo "✅ Namespace created"

        echo

        # Deploy KeyDB statefulset
        echo "→ Deploying KeyDB StatefulSet..."

        TEMP_MANIFEST=$(mktemp)
        TEMP_FILES+=("${TEMP_MANIFEST}")
        CLEANUP_NEEDED=true

        cat > "${TEMP_MANIFEST}" << 'EOF'
apiVersion: v1
kind: ConfigMap
metadata:
  name: keydb-config
  namespace: draehi-cache
data:
  keydb.conf: |
    port 6379
    appendonly yes
    appendfsync everysec
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: keydb
  namespace: draehi-cache
spec:
  serviceName: keydb
  replicas: 1
  selector:
    matchLabels:
      app: keydb
  template:
    metadata:
      labels:
        app: keydb
    spec:
      containers:
      - name: keydb
        image: eqalpha/keydb:latest
        ports:
        - containerPort: 6379
          name: keydb
        volumeMounts:
        - name: data
          mountPath: /data
        - name: config
          mountPath: /etc/keydb
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "1Gi"
            cpu: "500m"
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      storageClassName: gp3
      resources:
        requests:
          storage: 20Gi
---
apiVersion: v1
kind: Service
metadata:
  name: keydb
  namespace: draehi-cache
spec:
  clusterIP: None
  selector:
    app: keydb
  ports:
  - port: 6379
    targetPort: 6379
---
apiVersion: v1
kind: Service
metadata:
  name: keydb-lb
  namespace: draehi-cache
spec:
  type: LoadBalancer
  selector:
    app: keydb
  ports:
  - port: 6379
    targetPort: 6379
EOF

        if kubectl apply -f "${TEMP_MANIFEST}" > /dev/null 2>&1; then
            echo "✅ KeyDB deployed"
        else
            echo "❌ Failed to deploy KeyDB"
            exit 1
        fi

        echo

        echo "→ Waiting for KeyDB to be ready..."
        if kubectl rollout status statefulset/keydb \
            --namespace draehi-cache \
            --timeout=3m 2>&1 | tail -1; then
            echo "✅ KeyDB is ready"
        else
            echo "⚠️  KeyDB may still be starting"
        fi

        echo

        LOAD_BALANCER=$(kubectl get svc keydb-lb -n draehi-cache -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "pending")

        echo "Connection Details:"
        echo "  Service: keydb-lb"
        echo "  Endpoint: ${LOAD_BALANCER}:6379"
        echo "  Internal: keydb.draehi-cache.svc.cluster.local:6379"
        ;;

    *)
        echo "Unknown mode: ${DEPLOY_MODE}"
        exit 1
        ;;
esac

echo
echo "═════════════════════════════════════════════════════"
echo "✅ KeyDB Deployment Complete"
echo "═════════════════════════════════════════════════════"
echo
