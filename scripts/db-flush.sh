#!/usr/bin/env bash
set -euo pipefail

# Draehi Database Flush Script
# Completely clears all data from all services
# Usage: source .test.env && ./scripts/db-flush.sh

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
        echo "✅ Flush complete"
    else
        echo "❌ Flush failed (exit code: $exit_code)"
    fi

    exit $exit_code
}

trap cleanup EXIT ERR INT TERM

echo "================================"
echo "🧹 Database Flush - All Services"
echo "================================"
echo

read -p "⚠️  This will DELETE ALL DATA. Continue? (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "→ Aborted"
    exit 0
fi

SURREAL_URL="${SURREAL_URL:-http://localhost:8000}"
SURREAL_USER="${SURREAL_USER:-root}"
SURREAL_PASS="${SURREAL_PASS:-root}"
SURREAL_NS="${SURREAL_NS:-draehi}"
SURREAL_DB="${SURREAL_DB:-main}"
KEYDB_URL="${KEYDB_URL:-redis://localhost:6379}"

# Step 1: Clear SurrealDB
echo "=== Clearing SurrealDB ==="
echo

if ! curl -s "${SURREAL_URL}/health" > /dev/null; then
    echo "⚠️  SurrealDB not responding, skipping..."
else
    echo "→ Dropping database: ${SURREAL_NS}/${SURREAL_DB}"

    if curl -s -X POST "${SURREAL_URL}/sql" \
        -u "${SURREAL_USER}:${SURREAL_PASS}" \
        --data "REMOVE DATABASE ${SURREAL_DB};" > /dev/null 2>&1; then
        echo "✅ SurrealDB cleared"
    else
        echo "⚠️  Failed to clear SurrealDB"
    fi
fi

echo

# Step 2: Clear KeyDB
echo "=== Clearing KeyDB ==="
echo

if redis-cli -u "${KEYDB_URL}" ping > /dev/null 2>&1; then
    echo "→ Flushing all keys..."

    if redis-cli -u "${KEYDB_URL}" FLUSHALL > /dev/null 2>&1; then
        echo "✅ KeyDB cleared"
    else
        echo "⚠️  Failed to clear KeyDB"
    fi
else
    echo "⚠️  KeyDB not responding, skipping..."
fi

echo

# Step 3: Clear MinIO (optional)
echo "=== MinIO (Optional) ==="
echo

if command -v mc &> /dev/null; then
    if mc alias list | grep -q "myminio"; then
        echo "→ Found MinIO alias, listing buckets..."
        if mc ls myminio/ 2> /dev/null; then
            read -p "Clear MinIO buckets? (y/N): " -n 1 -r
            echo

            if [[ $REPLY =~ ^[Yy]$ ]]; then
                if mc rb myminio/draehi-assets --force 2> /dev/null; then
                    echo "✅ MinIO cleared"
                else
                    echo "⚠️  Failed to clear MinIO"
                fi
            fi
        fi
    else
        echo "⊘ MinIO alias not configured"
    fi
else
    echo "⊘ mc CLI not found, skipping MinIO"
fi

echo
echo "================================"
echo "✅ All services flushed"
echo "================================"
echo
