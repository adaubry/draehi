#!/usr/bin/env bash
set -euo pipefail

# Set up database for Draehi
# Pushes Drizzle schema to PostgreSQL database
# Usage: ./setup-database.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# No cleanup needed for this script
cleanup() {
    local exit_code=$?

    if [[ $exit_code -eq 0 ]]; then
        echo
        echo "✅ Database setup complete"
    else
        echo
        echo "❌ Database setup failed (exit code: $exit_code)"
        echo "See above for error details"
    fi

    exit $exit_code
}

trap cleanup EXIT ERR INT TERM

cd "${PROJECT_ROOT}"

echo "╔═══════════════════════════════════════╗"
echo "║   Setting Up Database Schema          ║"
echo "╚═══════════════════════════════════════╝"
echo

# Step 1: Check .env.local
echo "Step 1/3: Checking environment configuration..."
echo

if [[ ! -f ".env.local" ]]; then
    echo "❌ .env.local not found"
    echo
    echo "Please create .env.local with your database configuration:"
    echo "  1. Copy template:"
    echo "       cp .env.example .env.local"
    echo
    echo "  2. Edit .env.local and set:"
    echo "       DATABASE_URL=postgresql://user:password@host:5432/draehi"
    echo "       SESSION_SECRET=<random-32-char-string>"
    echo
    echo "  3. Run this script again:"
    echo "       ./scripts/setup-database.sh"
    exit 1
fi

echo "✅ Found .env.local"

# Check if DATABASE_URL is set
if ! grep -q "^DATABASE_URL=" .env.local; then
    echo "❌ DATABASE_URL not set in .env.local"
    echo
    echo "Please add DATABASE_URL to .env.local:"
    echo "  DATABASE_URL=postgresql://user:password@host:5432/draehi"
    echo
    echo "Database providers:"
    echo "  - Neon (recommended): https://neon.tech (free tier)"
    echo "  - Supabase: https://supabase.com"
    echo "  - Local PostgreSQL: Install via package manager"
    exit 1
fi

echo "✅ DATABASE_URL configured"
echo

# Step 2: Check npm dependencies
echo "Step 2/3: Checking npm dependencies..."
echo

if [[ ! -d "node_modules" ]]; then
    echo "→ Installing npm dependencies..."
    if ! npm install; then
        echo "❌ npm install failed"
        exit 1
    fi
    echo "✅ Dependencies installed"
else
    echo "✅ Dependencies already installed"
fi

echo

# Step 3: Push database schema
echo "Step 3/3: Pushing schema to database..."
echo

echo "→ Running Drizzle db:push..."
if ! npm run db:push; then
    echo "❌ Schema push failed"
    echo
    echo "Common issues:"
    echo "  - DATABASE_URL incorrect (check host/port/credentials)"
    echo "  - Database server not running"
    echo "  - Database doesn't exist (create it first)"
    echo "  - Network/firewall blocking connection"
    exit 1
fi

echo
echo "✅ Database schema pushed successfully"
echo
echo "╔═══════════════════════════════════════╗"
echo "║   Database Ready                      ║"
echo "╚═══════════════════════════════════════╝"
echo
echo "Optional: Inspect your database with Drizzle Studio"
echo "  npm run db:studio"
echo
echo "Next steps:"
echo "  1. Run development server: npm run dev"
echo "  2. Open http://localhost:3000"
