#!/usr/bin/env bash
set -euo pipefail

# Draehi Rust Tools Installation Script
# Installs export-logseq-notes binary for Logseq graph processing
# Usage: ./scripts/install-rust-tools.sh

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
        echo "✅ Installation complete"
    else
        echo "❌ Installation failed (exit code: $exit_code)"
    fi

    exit $exit_code
}

trap cleanup EXIT ERR INT TERM

echo "==================================="
echo "📦 Draehi Rust Tools Installation"
echo "==================================="
echo

# Check for export-logseq-notes
if command -v export-logseq-notes &> /dev/null; then
    echo "✅ export-logseq-notes already installed"
    echo "   Version: $(export-logseq-notes --version 2>/dev/null || echo 'unknown')"
    exit 0
fi

# Check for Rust
if ! command -v cargo &> /dev/null; then
    echo "→ Installing Rust..."
    echo

    if curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y; then
        echo "✅ Rust installed"

        # Source cargo environment
        if [[ -f "$HOME/.cargo/env" ]]; then
            # shellcheck source=/dev/null
            source "$HOME/.cargo/env"
        fi
    else
        echo "❌ Failed to install Rust"
        echo "   Install manually from: https://rustup.rs"
        exit 1
    fi
else
    echo "✅ Rust found: $(rustc --version)"
fi

echo

# Ensure cargo is in PATH for this script
export PATH="$HOME/.cargo/bin:$PATH"

# Check for vendored export-tool source
EXPORT_TOOL_DIR="${PROJECT_ROOT}/modules/logseq/export-tool"

if [[ ! -d "${EXPORT_TOOL_DIR}" ]]; then
    echo "❌ Export tool source not found: ${EXPORT_TOOL_DIR}"
    echo "   The vendored Rust tool is missing from the repository"
    exit 1
fi

if [[ ! -f "${EXPORT_TOOL_DIR}/Cargo.toml" ]]; then
    echo "❌ Cargo.toml not found in: ${EXPORT_TOOL_DIR}"
    exit 1
fi

# Build and install from vendored source
echo "→ Building export-logseq-notes from vendored source..."
echo "   Source: ${EXPORT_TOOL_DIR}"
echo "   This may take a few minutes (compiling Rust code)..."
echo

if cargo install --path "${EXPORT_TOOL_DIR}"; then
    echo "✅ export-logseq-notes built and installed"

    # Verify installation
    if command -v export-logseq-notes &> /dev/null; then
        echo "   Version: $(export-logseq-notes --version 2>/dev/null || echo 'unknown')"
        echo "   Path: $(command -v export-logseq-notes)"
    fi
else
    echo "❌ Failed to build export-logseq-notes"
    exit 1
fi

echo
echo "==================================="
echo "✅ Rust tools ready"
echo "==================================="
echo
