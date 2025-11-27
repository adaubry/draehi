#!/usr/bin/env bash
set -euo pipefail

# Draehi Database Setup Script
# Initializes all databases: SurrealDB, KeyDB, MinIO
# Usage: ./scripts/setup-databases.sh [--skip-schema]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Load environment
if [[ -f "${PROJECT_ROOT}/.env.local" ]]; then
    # shellcheck source=/dev/null
    set +u
    source "${PROJECT_ROOT}/.env.local"
    set -u
fi

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
        echo "✅ Database setup complete"
    else
        echo "❌ Database setup failed (exit code: $exit_code)"
    fi

    exit $exit_code
}

trap cleanup EXIT ERR INT TERM

# Parse arguments
SKIP_SCHEMA=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-schema) SKIP_SCHEMA=true; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

echo "=================================="
echo "🗄️  Database Setup - All Services"
echo "=================================="
echo

# Detect environment
SURREAL_URL="${SURREAL_URL:-http://localhost:8000}"
SURREAL_USER="${SURREAL_USER:-root}"
SURREAL_PASS="${SURREAL_PASS:-root}"
SURREAL_NS="${SURREAL_NS:-draehi}"
SURREAL_DB="${SURREAL_DB:-main}"
KEYDB_URL="${KEYDB_URL:-redis://localhost:6379}"

echo "Configuration:"
echo "  SurrealDB: ${SURREAL_URL}"
echo "  KeyDB:     ${KEYDB_URL}"
echo "  Namespace: ${SURREAL_NS}"
echo "  Database:  ${SURREAL_DB}"
echo

# Step 1: Wait for SurrealDB
echo "=== Step 1/3: Waiting for SurrealDB ==="
echo

max_attempts=30
attempt=0

while [[ $attempt -lt $max_attempts ]]; do
    if curl -s "${SURREAL_URL}/health" > /dev/null 2>&1; then
        echo "✅ SurrealDB is healthy"
        break
    fi

    attempt=$((attempt + 1))
    if [[ $attempt -lt $max_attempts ]]; then
        echo "→ Waiting for SurrealDB... ($attempt/$max_attempts)"
        sleep 1
    fi
done

if [[ $attempt -eq $max_attempts ]]; then
    echo "❌ SurrealDB did not start in time"
    echo "   Check Docker: docker logs draehi-surrealdb"
    exit 1
fi

echo

# Step 2: Check KeyDB (optional)
echo "=== Step 2/3: Checking KeyDB (Optional) ==="
echo

max_attempts=10
attempt=0

while [[ $attempt -lt $max_attempts ]]; do
    if redis-cli -u "${KEYDB_URL}" ping > /dev/null 2>&1; then
        echo "✅ KeyDB is healthy"
        break
    fi

    attempt=$((attempt + 1))
    if [[ $attempt -lt $max_attempts ]]; then
        echo "→ Checking KeyDB... ($attempt/$max_attempts)"
        sleep 1
    fi
done

if [[ $attempt -eq $max_attempts ]]; then
    echo "⚠️  KeyDB not responding (optional - continuing anyway)"
fi

echo

# Step 3: Initialize SurrealDB schema
echo "=== Step 3/3: Initializing SurrealDB Schema ==="
echo

if [[ "${SKIP_SCHEMA}" == "true" ]]; then
    echo "⊘ Skipping schema initialization (--skip-schema)"
else
    # Check if init script exists
    init_script="${PROJECT_ROOT}/scripts/init-surreal-schema.ts"

    if [[ ! -f "${init_script}" ]]; then
        echo "❌ Schema initialization script not found: ${init_script}"
        exit 1
    fi

    echo "→ Running schema initialization..."

    if npx tsx "${init_script}"; then
        echo "✅ SurrealDB schema initialized"
    else
        echo "❌ Schema initialization failed"
        exit 1
    fi
fi

echo
echo "=================================="
echo "✅ All Databases Ready"
echo "=================================="
echo
echo "Service Status:"
echo "  • SurrealDB:  curl http://localhost:8000/health"
echo "  • KeyDB:      redis-cli -p 6379 ping"
echo "  • MinIO:      http://localhost:9001 (minioadmin/minioadmin)"
echo
echo "Next steps:"
echo "  npm run dev          # Start development server"
echo "  ./scripts/test-e2e.sh # Run E2E tests"
echo
