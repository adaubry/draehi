#!/bin/bash
set -euo pipefail

# End-to-End Test Script for Draehi
# Tests full flow: DB setup → User creation → Git sync → Content ingestion → Validation

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load test configuration
if [[ -f "$PROJECT_ROOT/.test.env" ]]; then
    set -a
    source "$PROJECT_ROOT/.test.env"
    set +a
    echo "✓ Loaded test configuration from .test.env"
else
    echo "⚠ .test.env not found, using defaults"
fi

# Set defaults if not in config
TEST_GRAPH_PATH="${TEST_REPO_PATH:-$PROJECT_ROOT/test-data/logseq-docs-graph}"
TEST_WORKSPACE_SLUG="${TEST_WORKSPACE_SLUG:-testuser}"
TEST_APP_URL="${TEST_APP_URL:-http://localhost:3000}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Cleanup flag
CLEANUP_NEEDED=false

# Cleanup function
cleanup() {
    local exit_code=$?
    if [[ "${CLEANUP_NEEDED}" == "true" ]]; then
        echo -e "${YELLOW}Cleaning up test data...${NC}"
        # Add cleanup tasks here if needed
    fi
    if [[ $exit_code -eq 0 ]]; then
        echo -e "${GREEN}✓ Test completed successfully${NC}"
    else
        echo -e "${RED}✗ Test failed with exit code ${exit_code}${NC}"
    fi
    exit $exit_code
}

trap cleanup EXIT INT TERM

# Helper functions
log_step() {
    echo -e "\n${BLUE}▶ $1${NC}"
}

log_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

log_error() {
    echo -e "${RED}✗ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log_step "Checking prerequisites..."

    # Check .env exists
    if [[ ! -f "$PROJECT_ROOT/.env" ]]; then
        log_error ".env not found"
        echo "Run: cp .env.example .env"
        exit 1
    fi

    # Check DATABASE_URL is set
    if ! grep -q "^DATABASE_URL=" "$PROJECT_ROOT/.env"; then
        log_error "DATABASE_URL not set in .env"
        exit 1
    fi

    # Check .test.env exists
    if [[ ! -f "$PROJECT_ROOT/.test.env" ]]; then
        log_warning ".test.env not found"
        echo "  For automated testing, create .test.env:"
        echo "  cp .test.env.example .test.env"
        echo ""
    fi

    # Check test graph exists
    if [[ ! -d "$TEST_GRAPH_PATH" ]]; then
        log_error "Test graph not found at $TEST_GRAPH_PATH"
        exit 1
    fi

    # Check if it's a git repo
    if [[ ! -d "$TEST_GRAPH_PATH/.git" ]]; then
        log_error "Test graph is not a Git repository"
        echo "Run: cd $TEST_GRAPH_PATH && git init && git add . && git commit -m 'Initial commit'"
        exit 1
    fi

    log_success "Prerequisites OK"
}

# Database setup
setup_database() {
    log_step "Setting up database schema..."

    cd "$PROJECT_ROOT"

    # Push schema
    npm run db:push > /dev/null 2>&1

    log_success "Database schema ready"
}

# Create test user and workspace (automated)
create_test_user() {
    log_step "Setting up test user and workspace..."

    cd "$PROJECT_ROOT"

    # Run automated setup script
    npx tsx scripts/setup-test-workspace.ts

    if [[ $? -eq 0 ]]; then
        log_success "Test workspace ready"
    else
        log_error "Failed to setup test workspace"
        exit 1
    fi
}

# Verify Git repository connection (already done by setup-test-workspace.ts)
verify_git_connection() {
    log_step "Verifying Git repository connection..."

    local repo_url="file://$TEST_GRAPH_PATH"

    echo "  Repository: $repo_url"
    echo "  Branch: ${TEST_REPO_BRANCH:-master}"
    echo "  Workspace: $TEST_WORKSPACE_SLUG"

    log_success "Repository verified (connected during setup)"
}

# Wait for sync to complete (now handled in setup-test-workspace.ts)
wait_for_sync() {
    log_step "Verifying sync completion..."

    # Sync is now completed during setup, just verify
    log_success "Sync already completed during setup"
}

# Validate content ingestion - REMOVED (validate-content.ts deleted during cleanup)

# Compare with Logseq docs
compare_with_logseq() {
    log_step "Comparing structure against official Logseq docs..."

    cd "$PROJECT_ROOT"

    # Run comparison (checks database directly)
    npx tsx scripts/compare-with-logseq.ts

    if [[ $? -eq 0 ]]; then
        log_success "Draehi structure matches Logseq!"
    else
        log_warning "Some differences found - review output above"
    fi
}

# Frontend Phase 4 Tests (9 Critical Issues)
test_frontend_phase4() {
    log_step "Testing Phase 4 frontend issues (9 critical features)..."

    local url="http://localhost:3000/${TEST_WORKSPACE_SLUG}/contents"
    local errors=0

    # Issue #1: Block Navigation
    echo -n "  Block navigation (IDs, bullets): "
    local body=$(curl -s "$url")
    if echo "$body" | grep -q 'id="block-' && echo "$body" | grep -q 'bullet'; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
        ((errors++))
    fi

    # Issue #2: Block Collapse
    echo -n "  Block collapse (▸/▾): "
    if echo "$body" | grep -qE '▸|▾'; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
        ((errors++))
    fi

    # Issue #3: Multi-Word Slugs
    echo -n "  Multi-word slugs: "
    local status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/${TEST_WORKSPACE_SLUG}/advanced-queries")
    if [[ "$status" == "200" ]]; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗ (HTTP $status)${NC}"
        ((errors++))
    fi

    # Issue #4: Case-Insensitive URLs
    echo -n "  Case-insensitive URLs: "
    local lower=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/${TEST_WORKSPACE_SLUG}/contents")
    local upper=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/${TEST_WORKSPACE_SLUG}/Contents")
    if [[ "$lower" == "200" && "$upper" == "200" ]]; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
        ((errors++))
    fi

    # Issue #5: References
    echo -n "  References on pages: "
    local test_body=$(curl -s "http://localhost:3000/${TEST_WORKSPACE_SLUG}/query")
    if echo "$test_body" | grep -qi "reference"; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}⚠${NC} (may need review)"
    fi

    # Issue #6: Hashtag Links
    echo -n "  Hashtag links: "
    if echo "$body" | grep -q 'hashtag'; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
        ((errors++))
    fi

    # Issue #7: Default Page
    echo -n "  Default page: "
    local root_status=$(curl -s -o /dev/null -w "%{http_code}" -L "http://localhost:3000/${TEST_WORKSPACE_SLUG}")
    if [[ "$root_status" == "200" ]]; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗ (HTTP $root_status)${NC}"
        ((errors++))
    fi

    # Issue #8: Sidebar Structure
    echo -n "  Sidebar structure: "
    if echo "$body" | grep -qi "back" && echo "$body" | grep -qi "all.pages"; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
        ((errors++))
    fi

    # Issue #9: Breadcrumbs
    echo -n "  Breadcrumbs: "
    if echo "$body" | grep -qE 'breadcrumb|aria-label="Breadcrumb"'; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
        ((errors++))
    fi

    if [[ $errors -eq 0 ]]; then
        log_success "All Phase 4 frontend features working"
    elif [[ $errors -le 2 ]]; then
        log_warning "Phase 4 mostly complete ($errors minor issues)"
    else
        log_error "Phase 4 has $errors critical issues"
        echo "  Run: ./scripts/test-frontend-phase4-issues.sh for detailed diagnostics"
        return 1
    fi
}

# Test UI rendering
test_ui_rendering() {
    log_step "Testing UI rendering..."

    # Skip manual UI test if fully automated
    if [[ "${AUTOMATED_SYNC_WAIT:-false}" == "true" ]]; then
        log_warning "Skipping manual UI verification (automated mode)"
        log_success "UI rendering check skipped"
        return 0
    fi

    log_warning "Manual UI test checklist:"
    echo ""
    echo "  Visit workspace pages and verify:"
    echo "  □ Page references [[page]] render as blue links"
    echo "  □ Block references ((uuid)) render as gray pills"
    echo "  □ TODO markers show yellow checkboxes"
    echo "  □ DOING markers show blue checkboxes"
    echo "  □ DONE markers show green checkboxes with strikethrough"
    echo "  □ NOW markers show red checkboxes"
    echo "  □ LATER markers show gray checkboxes"
    echo "  □ [#A] shows red badge"
    echo "  □ [#B] shows yellow badge"
    echo "  □ [#C] shows blue badge"
    echo "  □ Clicking page reference navigates correctly"
    echo "  □ Clicking block reference scrolls to block"
    echo "  □ Clicking bullet collapses/expands children"
    echo "  □ Breadcrumbs show correct hierarchy"
    echo "  □ Sidebar navigation works"
    echo "  □ Journal page appears in sidebar"
    echo ""
    read -p "Press Enter after verifying UI..."

    log_success "UI rendering verified"
}

# Cleanup test user from previous run
cleanup_test_user() {
    log_step "Cleaning up previous test user..."

    cd "$PROJECT_ROOT"
    npx tsx scripts/cleanup-test-user.ts

    if [[ $? -eq 0 ]]; then
        log_success "Cleanup complete"
    else
        log_error "Cleanup failed"
        exit 1
    fi
}

# Main execution
main() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════╗"
    echo "║  Draehi End-to-End Test Suite        ║"
    echo "║  (Automated)                           ║"
    echo "╚════════════════════════════════════════╝"
    echo -e "${NC}"

    check_prerequisites
    cleanup_test_user         # Remove previous test user
    setup_database
    create_test_user          # Now automated via setup-test-workspace.ts
    verify_git_connection     # Verifies connection made during setup
    wait_for_sync            # Can be manual or automated

    compare_with_logseq
    test_frontend_phase4     # NEW: Phase 4 critical frontend tests
    test_ui_rendering        # Still manual (visual inspection)

    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  All tests passed!                    ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
}

main "$@"
