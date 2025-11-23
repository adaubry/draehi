#!/bin/bash
# Draehi Docker Setup Script
# One-command setup for all services (SurrealDB, KeyDB, MinIO)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    Draehi Docker Setup                            ║${NC}"
echo -e "${GREEN}║        SurrealDB + KeyDB + MinIO + Next.js                        ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed.${NC}"
    echo "Please install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check for Docker Compose
if ! command -v docker compose &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed.${NC}"
    echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

cd "$PROJECT_DIR"

# Parse arguments
FULL_STACK=false
CLEAN=false
STOP=false

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --full) FULL_STACK=true ;;
        --clean) CLEAN=true ;;
        --stop) STOP=true ;;
        -h|--help)
            echo "Usage: ./scripts/docker-setup.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --full    Run with Next.js app in Docker (default: services only)"
            echo "  --clean   Remove all volumes and start fresh"
            echo "  --stop    Stop all containers"
            echo "  -h, --help Show this help message"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
    shift
done

if [ "$STOP" = true ]; then
    echo -e "${YELLOW}Stopping all containers...${NC}"
    docker compose --profile full down
    echo -e "${GREEN}All containers stopped.${NC}"
    exit 0
fi

if [ "$CLEAN" = true ]; then
    echo -e "${YELLOW}Removing all volumes and starting fresh...${NC}"
    docker compose --profile full down -v
    echo -e "${GREEN}Volumes removed.${NC}"
fi

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    echo -e "${YELLOW}Creating .env.local from template...${NC}"
    cp .env.docker .env.local
    echo -e "${GREEN}.env.local created. Edit it to customize settings.${NC}"
fi

# Start services
echo ""
echo -e "${YELLOW}Starting Docker services...${NC}"

if [ "$FULL_STACK" = true ]; then
    echo "Starting full stack (services + Next.js app)..."
    docker compose --profile full up -d
else
    echo "Starting services only (SurrealDB, KeyDB, MinIO)..."
    docker compose up -d surrealdb keydb minio minio-init
fi

echo ""
echo -e "${YELLOW}Waiting for services to be healthy...${NC}"

# Wait for SurrealDB
echo -n "Waiting for SurrealDB..."
for i in {1..30}; do
    if docker compose exec -T surrealdb curl -sf http://localhost:8000/health > /dev/null 2>&1; then
        echo -e " ${GREEN}ready${NC}"
        break
    fi
    echo -n "."
    sleep 1
done

# Wait for KeyDB
echo -n "Waiting for KeyDB..."
for i in {1..30}; do
    if docker compose exec -T keydb keydb-cli ping > /dev/null 2>&1; then
        echo -e " ${GREEN}ready${NC}"
        break
    fi
    echo -n "."
    sleep 1
done

# Wait for MinIO
echo -n "Waiting for MinIO..."
for i in {1..30}; do
    if curl -sf http://localhost:9000/minio/health/live > /dev/null 2>&1; then
        echo -e " ${GREEN}ready${NC}"
        break
    fi
    echo -n "."
    sleep 1
done

# Initialize SurrealDB schema
echo ""
echo -e "${YELLOW}Initializing SurrealDB schema...${NC}"
npx tsx scripts/init-surreal-schema.ts

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    Setup Complete!                                 ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Services running:"
echo "  - SurrealDB:    http://localhost:8000"
echo "  - KeyDB:        redis://localhost:6379"
echo "  - MinIO:        http://localhost:9000"
echo "  - MinIO Console: http://localhost:9001 (minioadmin/minioadmin)"
echo ""

if [ "$FULL_STACK" = true ]; then
    echo "  - Next.js App:  http://localhost:3000"
else
    echo "To start the Next.js dev server:"
    echo "  npm run dev"
fi

echo ""
echo "To stop services:"
echo "  ./scripts/docker-setup.sh --stop"
echo ""
echo "To view logs:"
echo "  docker compose logs -f [service_name]"
