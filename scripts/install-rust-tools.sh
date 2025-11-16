#!/usr/bin/env bash
set -euo pipefail

# Install Rust tools required for Draehi
# This script installs Rust/Cargo and export-logseq-notes
# Usage: ./install-rust-tools.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Cleanup tracking
TEMP_DIRS=()
CLEANUP_NEEDED=false

cleanup() {
    local exit_code=$?

    if [[ "${CLEANUP_NEEDED}" == "true" ]]; then
        echo
        echo "🧹 Cleaning up temporary files..."

        for dir in "${TEMP_DIRS[@]}"; do
            if [[ -d "$dir" ]]; then
                rm -rf "$dir"
            fi
        done
    fi

    if [[ $exit_code -eq 0 ]]; then
        echo
        echo "✅ Rust tools installation complete"
    else
        echo
        echo "❌ Installation failed (exit code: $exit_code)"
        echo "See above for error details"
    fi

    exit $exit_code
}

trap cleanup EXIT ERR INT TERM

echo "╔═══════════════════════════════════════╗"
echo "║   Installing Rust Tools for Draehi   ║"
echo "╚═══════════════════════════════════════╝"
echo

# Step 1: Check/Install Rust
echo "Step 1/2: Checking Rust installation..."
echo

if command -v cargo &> /dev/null; then
    echo "✅ Rust already installed: $(rustc --version)"
else
    echo "📦 Installing Rust via rustup..."
    echo

    # Detect OS
    case "${OSTYPE}" in
        linux*|darwin*)
            curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

            # Source cargo env for current session
            # shellcheck disable=SC1091
            source "${HOME}/.cargo/env"

            echo
            echo "✅ Rust installed: $(rustc --version)"
            ;;
        *)
            echo "❌ Unsupported OS: ${OSTYPE}"
            echo "Please install Rust manually: https://rustup.rs/"
            exit 1
            ;;
    esac
fi

echo

# Step 2: Install export-logseq-notes
echo "Step 2/2: Installing export-logseq-notes..."
echo

if command -v export-logseq-notes &> /dev/null; then
    echo "✅ export-logseq-notes already installed"
else
    echo "📦 Building export-logseq-notes from source..."
    echo "Note: This tool is not on crates.io, requires building from GitHub"
    echo

    # Create temp directory
    TEMP_DIR=$(mktemp -d)
    TEMP_DIRS+=("${TEMP_DIR}")
    CLEANUP_NEEDED=true

    # Save original directory
    ORIGINAL_DIR=$(pwd)

    (
        cd "${TEMP_DIR}"

        echo "→ Cloning repository..."
        if ! git clone --depth=1 https://github.com/dimfeld/export-logseq-notes.git repo 2>&1; then
            echo "❌ Failed to clone repository"
            exit 1
        fi

        cd repo

        echo "→ Building with cargo (this may take a few minutes)..."

        # Fix time crate version issue (v0.3.20 incompatible with modern Rust)
        echo "→ Updating dependencies to fix time crate..."
        if ! cargo update 2>&1; then
            echo "⚠️  cargo update failed, attempting direct build..."
        fi

        # Try building with release profile
        if ! cargo build --release 2>&1; then
            echo "❌ Build failed"
            echo
            echo "This is a known issue with export-logseq-notes dependencies."
            echo
            echo "Possible fixes:"
            echo "  1. Use older Rust version:"
            echo "       rustup install 1.70.0"
            echo "       rustup default 1.70.0"
            echo "       cargo build --release"
            echo
            echo "  2. Manual dependency update in Cargo.toml:"
            echo "       Change time = \"0.3.20\" to time = \"0.3.30\""
            echo
            echo "  3. Skip for now (Phase 3 won't work without this tool)"
            exit 1
        fi

        echo "→ Installing binary..."
        if ! cargo install --path . 2>&1; then
            echo "❌ Installation failed"
            exit 1
        fi

        echo
        echo "✅ export-logseq-notes installed successfully"
    )

    # Return to original directory
    cd "${ORIGINAL_DIR}"
fi

echo

# Configure environment variables
echo "→ Configuring environment..."

cd "${PROJECT_ROOT}"

if [[ -f ".env.local" ]]; then
    if ! grep -q "^CARGO_BIN_PATH=" .env.local 2>/dev/null; then
        echo "" >> .env.local
        echo "# Rust cargo binaries" >> .env.local
        echo "CARGO_BIN_PATH=$HOME/.cargo/bin" >> .env.local
        echo "✅ Added CARGO_BIN_PATH to .env.local"
    else
        echo "✅ CARGO_BIN_PATH already configured"
    fi
else
    echo "⚠️  .env.local not found - will be created by setup.sh"
fi

echo
echo "Next steps:"
echo "  1. Run: npm install"
echo "  2. Run: ./scripts/setup-database.sh"
echo "  3. Run: ./scripts/setup-minio.sh (optional)"
