#!/usr/bin/env bash
set -euo pipefail

# Master setup script for Draehi
# Runs all setup steps in correct order
# Usage: ./setup.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# No cleanup needed for this script (delegates to sub-scripts)
cleanup() {
    local exit_code=$?

    if [[ $exit_code -eq 0 ]]; then
        echo
        echo "✅ Setup complete"
    else
        echo
        echo "❌ Setup failed (exit code: $exit_code)"
        echo "See above for error details"
    fi

    exit $exit_code
}

trap cleanup EXIT ERR INT TERM

cd "${PROJECT_ROOT}"

echo "╔═══════════════════════════════════════╗"
echo "║   Draehi Complete Setup               ║"
echo "╚═══════════════════════════════════════╝"
echo

# Step 1: Check prerequisites
echo "Step 1/6: Checking prerequisites..."
echo

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found"
    echo
    echo "Please install Node.js 20+ first:"
    echo "  https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [[ "${NODE_VERSION}" -lt 20 ]]; then
    echo "❌ Node.js version too old"
    echo "   Found: $(node -v)"
    echo "   Required: v20+"
    exit 1
fi

echo "✅ Node.js $(node -v)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found"
    exit 1
fi
echo "✅ npm $(npm -v)"

# Check Git
if ! command -v git &> /dev/null; then
    echo "❌ Git not found"
    echo
    echo "Please install Git first:"
    echo "  - macOS: brew install git"
    echo "  - Linux: apt-get install git / dnf install git"
    echo "  - Windows: https://git-scm.com/download/win"
    exit 1
fi
echo "✅ Git $(git --version | cut -d' ' -f3)"

echo

# Step 2: Install npm dependencies
echo "Step 2/6: Installing npm dependencies..."
echo

if ! npm install; then
    echo "❌ npm install failed"
    exit 1
fi

echo "✅ npm dependencies installed"
echo

# Step 3: Set up environment
echo "Step 3/6: Setting up environment..."
echo

if [[ ! -f ".env.local" ]]; then
    cp .env.example .env.local
    echo "✅ Created .env.local from template"
    echo
    echo "⚠️  IMPORTANT: Configure .env.local before continuing"
    echo
    echo "Required settings:"
    echo "  1. DATABASE_URL - PostgreSQL connection string"
    echo "     Example: postgresql://user:password@host:5432/draehi"
    echo "     Providers: Neon (https://neon.tech), Supabase, Local PostgreSQL"
    echo
    echo "  2. SESSION_SECRET - Random 32-character string"
    echo "     Generate: openssl rand -base64 32"
    echo
    read -p "Press Enter after configuring .env.local to continue..." -r
    echo
else
    echo "✅ .env.local already exists"
    echo
fi

# Step 4: Install Rust tools
echo "Step 4/6: Installing Rust tools..."
echo

if ! bash "${SCRIPT_DIR}/install-rust-tools.sh"; then
    echo "❌ Rust tools installation failed"
    exit 1
fi

echo

# Step 5: Set up database
echo "Step 5/6: Setting up database..."
echo

if ! bash "${SCRIPT_DIR}/setup-database.sh"; then
    echo "❌ Database setup failed"
    exit 1
fi

echo

# Step 6: Optional MinIO setup
echo "Step 6/6: Optional - MinIO S3 Storage"
echo

echo "MinIO provides local S3-compatible storage for assets (images, attachments)."
echo
echo "You can skip this if:"
echo "  - You don't need asset hosting yet"
echo "  - You'll use AWS S3 in production"
echo "  - You're only testing auth/git features"
echo

read -p "Set up MinIO now? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    if ! sudo bash "${SCRIPT_DIR}/setup-minio.sh"; then
        echo "⚠️  MinIO setup failed (optional, continuing...)"
    fi
else
    echo "⏭️  Skipping MinIO setup"
    echo "   Run './scripts/setup-minio.sh' later if needed"
fi

echo
echo "╔═══════════════════════════════════════╗"
echo "║   Setup Complete! 🎉                  ║"
echo "╚═══════════════════════════════════════╝"
echo
echo "Next steps:"
echo "  1. Review .env.local configuration"
echo "  2. Start development server:"
echo "       npm run dev"
echo "  3. Open http://localhost:3000"
echo
echo "Documentation:"
echo "  - Setup guide:  docs/SCRIPTS.md"
echo "  - Bash guide:   docs/BASH_GUIDELINES.md"
echo "  - Roadmap:      docs/ROADMAP.md"
