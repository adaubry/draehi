#!/usr/bin/env bash
set -euo pipefail

# Draehi Health Check Script
# Verifies all services are running and responding
# Usage: ./scripts/health-check.sh [--watch]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Load environment
if [[ -f "${PROJECT_ROOT}/.env.local" ]]; then
    # shellcheck source=/dev/null
    set +u
    source "${PROJECT_ROOT}/.env.local"
    set -u
fi

# Parse arguments
WATCH=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --watch) WATCH=true; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# Service configuration
SURREAL_URL="${SURREAL_URL:-http://localhost:8000}"
KEYDB_URL="${KEYDB_URL:-redis://localhost:6379}"
MINIO_URL="${MINIO_URL:-http://localhost:9000}"
APP_URL="${APP_URL:-http://localhost:3000}"

# Check service health
check_services() {
    local all_healthy=true

    echo "╔════════════════════════════════════════╗"
    echo "║      Service Health Check              ║"
    echo "╚════════════════════════════════════════╝"
    echo

    # SurrealDB
    echo -n "SurrealDB      ($SURREAL_URL): "
    if curl -s "${SURREAL_URL}/health" > /dev/null 2>&1; then
        echo "✅ Healthy"
    else
        echo "❌ Not responding"
        all_healthy=false
    fi

    # KeyDB
    echo -n "KeyDB          ($KEYDB_URL): "
    if redis-cli -u "${KEYDB_URL}" ping > /dev/null 2>&1; then
        echo "✅ Healthy"
    else
        echo "❌ Not responding"
        all_healthy=false
    fi

    # MinIO
    echo -n "MinIO          ($MINIO_URL): "
    if curl -s "${MINIO_URL}/minio/health" > /dev/null 2>&1 || curl -s "${MINIO_URL}" > /dev/null 2>&1; then
        echo "✅ Healthy"
    else
        echo "⚠️  Not responding"
    fi

    # App
    echo -n "Next.js App    ($APP_URL): "
    if curl -s "${APP_URL}" > /dev/null 2>&1; then
        echo "✅ Healthy"
    else
        echo "⚠️  Not responding"
    fi

    echo

    # Docker containers
    if command -v docker &> /dev/null && docker info &> /dev/null; then
        echo "Docker Containers:"
        echo

        docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "draehi-|NAMES" || echo "  (None running)"
        echo
    fi

    # Overall status
    if [[ "${all_healthy}" == "true" ]]; then
        echo "✅ All critical services healthy"
        return 0
    else
        echo "❌ Some services are not responding"
        return 1
    fi
}

# Main loop
if [[ "${WATCH}" == "true" ]]; then
    echo "Watching services (Ctrl+C to exit)..."
    echo

    while true; do
        clear
        check_services
        sleep 5
    done
else
    check_services
fi
