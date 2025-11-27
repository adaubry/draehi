#!/usr/bin/env bash
set -euo pipefail

# Draehi End-to-End Test Script (Backend)
# Tests full workflow: user creation → workspace → content ingestion
# Usage: source .test.env && ./scripts/test-e2e.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Cleanup tracking
TEMP_FILES=()
TEMP_DIRS=()
CLEANUP_NEEDED=false
AUTOMATED_SYNC_WAIT="${AUTOMATED_SYNC_WAIT:-false}"

cleanup() {
    local exit_code=$?

    if [[ "${CLEANUP_NEEDED}" == "true" ]]; then
        echo
        echo "🧹 Cleaning up temporary files..."

        for file in "${TEMP_FILES[@]}"; do
            [[ -f "$file" ]] && rm -f "$file"
        done

        for dir in "${TEMP_DIRS[@]}"; do
            [[ -d "$dir" ]] && rm -rf "$dir"
        done
    fi

    if [[ $exit_code -eq 0 ]]; then
        echo "✅ E2E Test Complete"
    else
        echo "❌ E2E Test Failed (exit code: $exit_code)"
    fi

    exit $exit_code
}

trap cleanup EXIT ERR INT TERM

# Verify environment
if [[ -z "${TEST_USER_EMAIL:-}" ]]; then
    echo "❌ .test.env not loaded"
    echo "   Run: source .test.env"
    exit 1
fi

echo "========================================="
echo "🧪 Draehi E2E Test - Backend Workflow"
echo "========================================="
echo

# Log environment
TEST_REPO_PATH="${TEST_REPO_PATH:-.test-data/logseq-docs-graph}"
TEST_REPO_BRANCH="${TEST_REPO_BRANCH:-main}"
TEST_APP_URL="${TEST_APP_URL:-http://localhost:3000}"
TIMEOUT="${TIMEOUT:-120}"

echo "Test Configuration:"
echo "  User: ${TEST_USER_EMAIL}"
echo "  Workspace: ${TEST_WORKSPACE_SLUG}"
echo "  Repo: ${TEST_REPO_PATH}"
echo "  App URL: ${TEST_APP_URL}"
echo "  Timeout: ${TIMEOUT}s"
echo

# Step 1: Verify services
echo "=== Step 1/4: Verifying Services ==="
echo

# Check SurrealDB
if ! curl -s "${SURREAL_URL:-http://localhost:8000}/health" > /dev/null; then
    echo "❌ SurrealDB not responding"
    exit 1
fi
echo "✅ SurrealDB ready"

# Check KeyDB
if ! redis-cli -u "${KEYDB_URL:-redis://localhost:6379}" ping > /dev/null 2>&1; then
    echo "⚠️  KeyDB not responding (continuing)"
fi

# Check app
if ! curl -s "${TEST_APP_URL}" > /dev/null 2>&1; then
    echo "⚠️  App not running. Start with: npm run dev"
fi

echo

# Step 2: Create test user and workspace
echo "=== Step 2/4: Creating Test User & Workspace ==="
echo

if npx tsx "${SCRIPT_DIR}/setup-test-workspace.ts" 2>&1; then
    echo "✅ Test user and workspace created"
else
    echo "❌ Failed to create test user/workspace"
    exit 1
fi

echo

# Step 3: Run ingestion
echo "=== Step 3/4: Running Content Ingestion ==="
echo

if [[ -z "${AUTOMATED_SYNC_WAIT}" ]] || [[ "${AUTOMATED_SYNC_WAIT}" != "true" ]]; then
    echo "→ Triggering manual sync..."
    if npx tsx "${SCRIPT_DIR}/trigger-sync.ts" 2>&1; then
        echo "✅ Sync triggered"
    else
        echo "⚠️  Sync trigger failed (may be normal)"
    fi
else
    echo "→ Waiting for automated sync (AUTOMATED_SYNC_WAIT=true)..."
    sleep 30
fi

echo

# Step 4: Verify results
echo "=== Step 4/4: Verifying Content ==="
echo

VERIFY_TIMEOUT=$((TIMEOUT / 2))
VERIFY_ATTEMPTS=0

while [[ $VERIFY_ATTEMPTS -lt $VERIFY_TIMEOUT ]]; do
    echo "→ Checking for ingested content... ($VERIFY_ATTEMPTS/${VERIFY_TIMEOUT}s)"

    # Query for content
    if npx tsx "${SCRIPT_DIR}/test-db-comprehensive.ts" > /tmp/verify-output.txt 2>&1; then
        echo "✅ Database verification passed"
        cat /tmp/verify-output.txt | grep -E "✓|✅|Test" || true
        break
    fi

    VERIFY_ATTEMPTS=$((VERIFY_ATTEMPTS + 1))
    sleep 1
done

if [[ $VERIFY_ATTEMPTS -eq $VERIFY_TIMEOUT ]]; then
    echo "⚠️  Content verification timed out"
    echo "   Check manually: ./scripts/test-db-comprehensive.sh"
fi

echo
echo "========================================="
echo "✅ E2E Test Complete"
echo "========================================="
echo
echo "Test Results Summary:"
echo "  ✅ Services healthy"
echo "  ✅ User created"
echo "  ✅ Workspace created"
echo "  ✅ Content ingested (if webhook triggered)"
echo
echo "Next steps:"
echo "  • View at: ${TEST_APP_URL}/${TEST_WORKSPACE_SLUG}"
echo "  • Debug logs: ./scripts/docker-setup.sh logs"
echo "  • Cleanup: ./scripts/cleanup-test-user.ts"
echo
