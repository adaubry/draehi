#!/usr/bin/env bash
set -euo pipefail

# Quick MinIO launcher for Draehi local development
# Usage:
#   npm run minio           - Start MinIO (runs setup if needed)
#   npm run minio stop      - Stop MinIO
#   npm run minio restart   - Restart MinIO
#   npm run minio logs      - Show MinIO logs
#   npm run minio status    - Check MinIO status

MINIO_CONTAINER="draehi-minio"
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Helper functions
error() {
    echo -e "${RED}✗ $1${NC}" >&2
}

success() {
    echo -e "${GREEN}✓ $1${NC}"
}

info() {
    echo -e "${YELLOW}→ $1${NC}"
}

# Check if Docker is available
check_docker() {
    if ! command -v docker &> /dev/null; then
        error "Docker not found. Install Docker first."
        exit 1
    fi

    if ! docker ps &> /dev/null; then
        error "Cannot connect to Docker daemon. Is Docker running?"
        exit 1
    fi
}

# Check if MinIO container exists
container_exists() {
    docker ps -a --format '{{.Names}}' | grep -q "^${MINIO_CONTAINER}$"
}

# Check if MinIO is running
is_running() {
    docker ps --format '{{.Names}}' | grep -q "^${MINIO_CONTAINER}$"
}

# Start MinIO
start() {
    check_docker

    if ! container_exists; then
        info "MinIO not set up yet. Running setup..."
        echo
        exec "$(dirname "$0")/setup-minio.sh"
    fi

    if is_running; then
        success "MinIO is already running"
        show_info
    else
        info "Starting MinIO..."
        docker start "${MINIO_CONTAINER}" > /dev/null
        success "MinIO started"
        show_info
    fi
}

# Stop MinIO
stop() {
    check_docker

    if ! container_exists; then
        error "MinIO container does not exist. Run 'npm run minio' first."
        exit 1
    fi

    if is_running; then
        info "Stopping MinIO..."
        docker stop "${MINIO_CONTAINER}" > /dev/null
        success "MinIO stopped"
    else
        info "MinIO is already stopped"
    fi
}

# Restart MinIO
restart() {
    check_docker

    if ! container_exists; then
        error "MinIO container does not exist. Run 'npm run minio' first."
        exit 1
    fi

    info "Restarting MinIO..."
    docker restart "${MINIO_CONTAINER}" > /dev/null
    success "MinIO restarted"
    show_info
}

# Show logs
logs() {
    check_docker

    if ! container_exists; then
        error "MinIO container does not exist. Run 'npm run minio' first."
        exit 1
    fi

    docker logs -f "${MINIO_CONTAINER}"
}

# Check status
status() {
    check_docker

    if ! container_exists; then
        echo "Status: Not set up"
        info "Run 'npm run minio' to set up and start MinIO"
        exit 0
    fi

    if is_running; then
        echo "Status: Running"
        show_info
    else
        echo "Status: Stopped"
        info "Run 'npm run minio' to start"
    fi
}

# Show connection info
show_info() {
    echo
    echo "MinIO is ready:"
    echo "  API:     http://localhost:${MINIO_PORT}"
    echo "  Console: http://localhost:${MINIO_CONSOLE_PORT}"
    echo
    echo "Quick commands:"
    echo "  npm run minio stop     - Stop MinIO"
    echo "  npm run minio restart  - Restart MinIO"
    echo "  npm run minio logs     - View logs"
}

# Main command router
case "${1:-start}" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    logs)
        logs
        ;;
    status)
        status
        ;;
    *)
        echo "Usage: npm run minio [command]"
        echo
        echo "Commands:"
        echo "  (none)   - Start MinIO (default)"
        echo "  stop     - Stop MinIO"
        echo "  restart  - Restart MinIO"
        echo "  logs     - Show MinIO logs"
        echo "  status   - Check MinIO status"
        exit 1
        ;;
esac
