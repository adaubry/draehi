#!/usr/bin/env bash
set -euo pipefail

# Set up local MinIO S3-compatible storage for Draehi
# This script starts MinIO via Docker and creates the required bucket
# Usage: ./setup-minio.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

MINIO_CONTAINER="draehi-minio"
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
BUCKET_NAME="draehi-assets"

# No cleanup needed for this script (Docker manages container lifecycle)
cleanup() {
    local exit_code=$?

    if [[ $exit_code -eq 0 ]]; then
        echo
        echo "✅ MinIO setup complete"
    else
        echo
        echo "❌ MinIO setup failed (exit code: $exit_code)"
        echo "See above for error details"
    fi

    exit $exit_code
}

trap cleanup EXIT ERR INT TERM

echo "╔═══════════════════════════════════════╗"
echo "║   Setting Up MinIO S3 Storage        ║"
echo "╚═══════════════════════════════════════╝"
echo

# Step 1: Check Docker
echo "Step 1/3: Checking Docker..."
echo

if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found"
    echo
    echo "Please install Docker first:"
    echo "  - macOS/Windows: https://www.docker.com/products/docker-desktop"
    echo "  - Linux: curl -fsSL https://get.docker.com | sh"
    exit 1
fi

echo "✅ Docker found: $(docker --version)"
echo

# Step 2: Check/Fix Docker Permissions
echo "Step 2/3: Checking Docker permissions..."
echo

# Helper function to ensure docker group exists
ensure_docker_group() {
    if ! getent group docker &> /dev/null; then
        echo "→ Creating docker group..."
        if ! sudo groupadd docker; then
            echo "❌ Failed to create docker group"
            return 1
        fi
        echo "✅ Docker group created"
    fi
    return 0
}

# Helper function to fix docker permissions
fix_docker_permissions() {
    # Only applicable on Linux
    if [[ "${OSTYPE}" != "linux"* ]]; then
        echo "❌ Cannot access Docker"
        echo "Make sure Docker Desktop is running"
        return 1
    fi

    echo "⚠️  Docker permission denied"
    echo

    # Ensure docker group exists
    if ! ensure_docker_group; then
        return 1
    fi

    # Check if user is in docker group
    if ! groups "${USER}" | grep -q '\bdocker\b'; then
        echo "→ Adding ${USER} to docker group..."
        if ! sudo usermod -aG docker "${USER}"; then
            echo "❌ Failed to add user to docker group"
            return 1
        fi

        echo "✅ User added to docker group"
        echo
        echo "⚠️  IMPORTANT: Log out and log back in to apply changes"
        echo
        read -p "Log out now? (y/N): " -n 1 -r
        echo

        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "After logging back in, run:"
            echo "  ./scripts/setup-minio.sh"
            exit 0
        else
            echo "❌ Cannot continue without Docker permissions"
            echo
            echo "Please:"
            echo "  1. Log out and log back in"
            echo "  2. Run: ./scripts/setup-minio.sh"
            return 1
        fi
    fi

    return 0
}

# Test Docker access
if ! docker ps &> /dev/null; then
    if ! fix_docker_permissions; then
        exit 1
    fi
fi

echo "✅ Docker permissions OK"
echo

# Step 3: Set Up MinIO Container
echo "Step 3/3: Setting up MinIO container..."
echo

# Check if container exists
if docker ps -a --format '{{.Names}}' | grep -q "^${MINIO_CONTAINER}$"; then
    echo "→ MinIO container already exists"

    # Check if running
    if docker ps --format '{{.Names}}' | grep -q "^${MINIO_CONTAINER}$"; then
        echo "✅ MinIO is already running"
    else
        echo "→ Starting existing container..."
        if ! docker start "${MINIO_CONTAINER}"; then
            echo "❌ Failed to start container"
            exit 1
        fi
        echo "✅ MinIO started"
    fi
else
    echo "→ Creating MinIO container..."
    if ! docker run -d \
        -p "${MINIO_PORT}:${MINIO_PORT}" \
        -p "${MINIO_CONSOLE_PORT}:${MINIO_CONSOLE_PORT}" \
        --name "${MINIO_CONTAINER}" \
        -e "MINIO_ROOT_USER=minioadmin" \
        -e "MINIO_ROOT_PASSWORD=minioadmin" \
        minio/minio server /data --console-address ":${MINIO_CONSOLE_PORT}"; then
        echo "❌ Failed to create container"
        exit 1
    fi

    echo "✅ MinIO container created and started"
fi

echo
echo "→ Waiting for MinIO to be ready..."
sleep 3

# Set up bucket
echo "→ Setting up bucket '${BUCKET_NAME}'..."

if ! docker exec "${MINIO_CONTAINER}" sh -c "
    mc alias set local http://localhost:${MINIO_PORT} minioadmin minioadmin 2>/dev/null || true

    if mc ls local/${BUCKET_NAME} &>/dev/null; then
        echo 'Bucket ${BUCKET_NAME} already exists'
    else
        mc mb local/${BUCKET_NAME}
        mc anonymous set public local/${BUCKET_NAME}
        echo 'Bucket ${BUCKET_NAME} created and set to public'
    fi
"; then
    echo "❌ Failed to set up bucket"
    exit 1
fi

echo
echo "╔═══════════════════════════════════════╗"
echo "║   MinIO Configuration                 ║"
echo "╚═══════════════════════════════════════╝"
echo
echo "API Endpoint:     http://localhost:${MINIO_PORT}"
echo "Console:          http://localhost:${MINIO_CONSOLE_PORT}"
echo "Access Key:       minioadmin"
echo "Secret Key:       minioadmin"
echo "Bucket:           ${BUCKET_NAME}"
echo
echo "Add to .env.local:"
echo "  STORAGE_MODE=local"
echo "  MINIO_ENDPOINT=http://localhost:${MINIO_PORT}"
echo "  MINIO_PUBLIC_URL=http://localhost:${MINIO_PORT}"
echo "  AWS_ACCESS_KEY_ID=minioadmin"
echo "  AWS_SECRET_ACCESS_KEY=minioadmin"
echo "  S3_BUCKET=${BUCKET_NAME}"
echo
echo "Container management:"
echo "  Stop:   docker stop ${MINIO_CONTAINER}"
echo "  Start:  docker start ${MINIO_CONTAINER}"
echo "  Remove: docker rm -f ${MINIO_CONTAINER}"
