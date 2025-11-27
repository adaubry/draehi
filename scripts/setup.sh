#!/usr/bin/env bash
set -euo pipefail

# Draehi Master Setup Script
# Automated setup for local development environment
# Usage: ./scripts/setup.sh [--skip-docker] [--skip-rust]

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
        echo "✅ Setup complete"
    else
        echo "❌ Setup failed (exit code: $exit_code)"
    fi

    exit $exit_code
}

trap cleanup EXIT ERR INT TERM

# Parse arguments
SKIP_DOCKER=false
SKIP_RUST=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-docker) SKIP_DOCKER=true; shift ;;
        --skip-rust) SKIP_RUST=true; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

echo "================================"
echo "🚀 Draehi Setup - Local Development"
echo "================================"
echo

# Step 1: Check prerequisites
echo "=== Step 1/6: Checking Prerequisites ==="
echo

check_command() {
    local cmd=$1
    local install_msg=$2

    if ! command -v "${cmd}" &> /dev/null; then
        echo "❌ ${cmd} not found"
        echo "   ${install_msg}"
        return 1
    fi

    echo "✅ ${cmd} found"
    return 0
}

if ! check_command "git" "Install Git: https://git-scm.com"; then exit 1; fi
if ! check_command "node" "Install Node.js 20+: https://nodejs.org"; then exit 1; fi
if ! check_command "npm" "Install npm (comes with Node.js)"; then exit 1; fi

if [[ "${SKIP_DOCKER}" != "true" ]]; then
    if ! check_command "docker" "Install Docker: https://docs.docker.com/get-docker"; then
        echo "⚠️  Docker not found. Skipping Docker setup."
        SKIP_DOCKER=true
    fi
fi

echo

# Step 2: Install npm dependencies
echo "=== Step 2/6: Installing npm Dependencies ==="
echo

if [[ -f "${PROJECT_ROOT}/package.json" ]]; then
    echo "📦 Running npm install..."
    cd "${PROJECT_ROOT}"
    npm install

    if [[ $? -eq 0 ]]; then
        echo "✅ npm dependencies installed"
    else
        echo "❌ npm install failed"
        exit 1
    fi
else
    echo "❌ package.json not found"
    exit 1
fi

echo

# Step 3: Setup environment variables
echo "=== Step 3/6: Setting Up Environment Variables ==="
echo

if [[ -f "${PROJECT_ROOT}/.env.local" ]]; then
    echo "⚠️  .env.local already exists"
    read -p "Overwrite? (y/N): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "→ Keeping existing .env.local"
    else
        cp "${PROJECT_ROOT}/.env.docker" "${PROJECT_ROOT}/.env.local"
        echo "✅ .env.local updated from .env.docker"
    fi
else
    if [[ -f "${PROJECT_ROOT}/.env.docker" ]]; then
        cp "${PROJECT_ROOT}/.env.docker" "${PROJECT_ROOT}/.env.local"
        echo "✅ Created .env.local from .env.docker"
    elif [[ -f "${PROJECT_ROOT}/.env.example" ]]; then
        cp "${PROJECT_ROOT}/.env.example" "${PROJECT_ROOT}/.env.local"
        echo "✅ Created .env.local from .env.example"
    else
        echo "❌ No environment template found"
        exit 1
    fi
fi

# Add CARGO_BIN_PATH if not present
if ! grep -q "CARGO_BIN_PATH" "${PROJECT_ROOT}/.env.local" 2>/dev/null; then
    echo "" >> "${PROJECT_ROOT}/.env.local"
    echo "# Rust cargo binaries (auto-configured by setup)" >> "${PROJECT_ROOT}/.env.local"
    echo "CARGO_BIN_PATH=$HOME/.cargo/bin" >> "${PROJECT_ROOT}/.env.local"
    echo "✅ Added CARGO_BIN_PATH to .env.local"
fi

echo

# Step 4: Install Rust tools (if not skipped)
echo "=== Step 4/6: Installing Rust Tools ==="
echo

if [[ "${SKIP_RUST}" == "true" ]]; then
    echo "⊘ Skipping Rust tools (--skip-rust specified)"
else
    if "${SCRIPT_DIR}/install-rust-tools.sh"; then
        echo "✅ Rust tools installed"
    else
        echo "⚠️  Rust tools installation failed. Continuing..."
    fi
fi

echo

# Step 5: Docker setup (if not skipped)
echo "=== Step 5/6: Docker Setup ==="
echo

if [[ "${SKIP_DOCKER}" == "true" ]]; then
    echo "⊘ Skipping Docker setup (--skip-docker specified or Docker not found)"
    echo "   You can run this manually later:"
    echo "   npm run docker:setup"
else
    read -p "Start Docker services now? (Y/n): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        if "${SCRIPT_DIR}/docker-setup.sh"; then
            echo "✅ Docker services started"
            sleep 5
            echo "Waiting for services to be healthy..."
            sleep 10
        else
            echo "❌ Docker setup failed"
            exit 1
        fi
    else
        echo "→ Skipped Docker startup"
        echo "  Start manually later with: npm run docker:setup"
    fi
fi

echo

# Step 6: Initialize database
echo "=== Step 6/6: Database Initialization ==="
echo

if "${SCRIPT_DIR}/setup-databases.sh"; then
    echo "✅ Database initialized"
else
    echo "❌ Database initialization failed"
    exit 1
fi

echo
echo "================================"
echo "✅ Setup Complete!"
echo "================================"
echo
echo "Next steps:"
echo "1. Review .env.local if needed"
echo "2. Start the dev server: npm run dev"
echo "3. Open http://localhost:3000 in your browser"
echo
echo "For testing:"
echo "source .test.env"
echo "./scripts/test-e2e.sh"
echo
