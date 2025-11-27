#!/usr/bin/env bash
set -euo pipefail

# Draehi Docker Setup Script
# Manages Docker Compose services for local development
# Usage: ./scripts/docker-setup.sh [start|stop|clean|status|logs]

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
        echo "✅ Complete"
    else
        echo "❌ Failed (exit code: $exit_code)"
    fi

    exit $exit_code
}

trap cleanup EXIT ERR INT TERM

# Detect platform
detect_platform() {
    case "${OSTYPE}" in
        linux*)   echo "linux" ;;
        darwin*)  echo "macos" ;;
        *)        echo "unknown" ;;
    esac
}

# Check docker permissions
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker not installed"
        echo "   Install from: https://docs.docker.com/get-docker"
        return 1
    fi

    if ! docker ps &> /dev/null; then
        local platform=$(detect_platform)

        if [[ "${platform}" == "linux" ]]; then
            echo "❌ Docker permission denied"
            echo "   Adding user to docker group..."

            # Create docker group if needed
            if ! getent group docker &> /dev/null; then
                echo "→ Creating docker group..."
                if ! sudo groupadd docker 2>/dev/null; then
                    echo "❌ Failed to create docker group"
                    return 1
                fi
            fi

            # Add user to docker group
            if ! groups "${USER}" | grep -q '\bdocker\b'; then
                echo "→ Adding ${USER} to docker group..."
                if ! sudo usermod -aG docker "${USER}" 2>/dev/null; then
                    echo "❌ Failed to add user to docker group"
                    return 1
                fi

                echo "⚠️  You need to log out and log back in for changes to take effect"
                echo "   Or run: newgrp docker"
                return 1
            fi
        else
            echo "❌ Docker Desktop might not be running"
            echo "   Start Docker Desktop and try again"
            return 1
        fi
    fi

    echo "✅ Docker is available"
    return 0
}

# Start services
start_services() {
    echo "=== Starting Docker Services ==="
    echo

    if ! check_docker; then
        return 1
    fi

    echo "→ Building and starting containers..."
    echo "   Including: SurrealDB, KeyDB, MinIO, Surrealist GUI"
    cd "${PROJECT_ROOT}"

    local build_mode="${BUILD_MODE:-dev}"

    # Try to start with profile flag (Docker Compose v2.3+)
    # Fall back to basic start if profiles not supported
    BUILD_MODE="${build_mode}" docker compose up -d --profile dev 2>/dev/null || {
        echo "   Note: Using compatible compose startup (--profile not supported)"
        BUILD_MODE="${build_mode}" docker compose up -d
    }

    if [[ $? -ne 0 ]]; then
        echo "❌ Failed to start containers"
        return 1
    fi

    echo "✅ Containers started"
    echo

    # Wait for services to be healthy
    echo "→ Waiting for services to be healthy..."
    local max_attempts=30
    local attempt=0

    while [[ $attempt -lt $max_attempts ]]; do
        if docker compose ps | grep -q "healthy\|Up"; then
            echo "✅ Services are healthy"
            echo
            echo "Service URLs:"
            echo "  • SurrealDB:  http://localhost:8000/health"
            echo "  • Surrealist: http://localhost:8080 (SurrealDB GUI)"
            echo "  • KeyDB:      redis://localhost:6379"
            echo "  • MinIO:      http://localhost:9000 (minioadmin/minioadmin)"
            return 0
        fi

        attempt=$((attempt + 1))
        sleep 1
    done

    echo "⚠️  Services may still be starting. Check with: docker compose ps"
    echo
    echo "Service URLs:"
    echo "  • SurrealDB:  http://localhost:8000/health"
    echo "  • Surrealist: http://localhost:8080 (SurrealDB GUI)"
    echo "  • KeyDB:      redis://localhost:6379"
    echo "  • MinIO:      http://localhost:9000 (minioadmin/minioadmin)"
    return 0
}

# Stop services
stop_services() {
    echo "=== Stopping Docker Services ==="
    echo

    if ! check_docker; then
        return 1
    fi

    cd "${PROJECT_ROOT}"

    echo "→ Stopping containers (graceful)..."
    docker compose stop

    if [[ $? -eq 0 ]]; then
        echo "✅ Containers stopped"
    else
        echo "❌ Failed to stop containers"
        return 1
    fi
}

# Clean services (remove containers and volumes)
clean_services() {
    echo "=== Cleaning Docker Services ==="
    echo

    if ! check_docker; then
        return 1
    fi

    read -p "This will remove all containers and volumes. Continue? (y/N): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "→ Aborted"
        return 0
    fi

    cd "${PROJECT_ROOT}"

    echo "→ Removing containers..."
    docker compose down -v

    if [[ $? -eq 0 ]]; then
        echo "✅ Containers and volumes removed"
    else
        echo "❌ Failed to remove containers"
        return 1
    fi
}

# Show service status
show_status() {
    echo "=== Docker Services Status ==="
    echo

    if ! check_docker; then
        return 1
    fi

    cd "${PROJECT_ROOT}"
    docker compose ps

    echo
    echo "Service URLs:"
    echo "  • SurrealDB:  http://localhost:8000/health"
    echo "  • KeyDB:      redis://localhost:6379"
    echo "  • MinIO:      http://localhost:9000 (admin/admin)"
    echo "  • Surrealist: http://localhost:8080"
    echo
}

# Show service logs
show_logs() {
    local service="${1:-}"

    echo "=== Docker Service Logs ==="
    echo

    if ! check_docker; then
        return 1
    fi

    cd "${PROJECT_ROOT}"

    if [[ -z "${service}" ]]; then
        echo "→ Showing all service logs (Ctrl+C to exit)..."
        docker compose logs -f
    else
        echo "→ Showing logs for: ${service}"
        docker compose logs -f "${service}"
    fi
}

# Main logic
ACTION="${1:-start}"

case "${ACTION}" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    clean)
        stop_services
        clean_services
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs "${2:-}"
        ;;
    *)
        echo "Usage: $0 {start|stop|clean|status|logs} [service]"
        echo
        echo "Commands:"
        echo "  start    - Start all services (SurrealDB, Surrealist, KeyDB, MinIO)"
        echo "  stop     - Stop all services gracefully"
        echo "  clean    - Stop and remove containers/volumes"
        echo "  status   - Show container status and service URLs"
        echo "  logs     - Show service logs (optional: specify service)"
        echo
        echo "Services:"
        echo "  • surrealdb   - Document/Graph database"
        echo "  • surrealist  - SurrealDB GUI (http://localhost:8080)"
        echo "  • keydb       - Redis-compatible cache"
        echo "  • minio       - S3-compatible object storage"
        echo
        echo "Examples:"
        echo "  ./scripts/docker-setup.sh start"
        echo "  ./scripts/docker-setup.sh status"
        echo "  ./scripts/docker-setup.sh logs surrealist"
        echo "  ./scripts/docker-setup.sh logs surrealdb"
        echo "  ./scripts/docker-setup.sh clean"
        exit 1
        ;;
esac
