#!/bin/bash
set -euo pipefail

# End-to-End Test Script for Draehi
# Tests full flow: DB setup → User creation → Git sync → Content ingestion → Validation

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_GRAPH_PATH="$PROJECT_ROOT/test-data/logseq-docs-graph"

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

# Create test user and workspace
create_test_user() {
    log_step "Creating test user and workspace..."

    # Generate random test credentials
    TEST_USERNAME="testuser_$(date +%s)"
    TEST_PASSWORD="testpass123"

    echo "Username: $TEST_USERNAME"
    echo "Password: $TEST_PASSWORD"

    # Note: This requires the app to be running or a direct DB script
    # For now, we'll document manual steps
    log_warning "Manual step required: Create user via signup page"
    echo "  1. Start dev server: npm run dev"
    echo "  2. Visit http://localhost:3000/signup"
    echo "  3. Create user: $TEST_USERNAME / $TEST_PASSWORD"
    echo ""
    read -p "Press Enter after creating user..."

    log_success "User created"
}

# Test Git repository connection
test_git_connection() {
    log_step "Testing Git repository connection..."

    local repo_url="file://$TEST_GRAPH_PATH"
    local branch="master"

    log_warning "Manual step required: Connect Git repository"
    echo "  1. Go to http://localhost:3000/dashboard/settings"
    echo "  2. Repository URL: $repo_url"
    echo "  3. Branch: $branch"
    echo "  4. Access Token: (leave empty for local file://)"
    echo "  5. Click 'Connect Repository'"
    echo ""
    read -p "Press Enter after connecting repository..."

    log_success "Repository connected"
}

# Validate content ingestion
validate_content() {
    log_step "Validating content ingestion..."

    cd "$PROJECT_ROOT"

    # Run validation script via tsx
    npx tsx scripts/validate-content.ts

    log_success "Content validation complete"
}

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

# Test UI rendering
test_ui_rendering() {
    log_step "Testing UI rendering..."

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

# Main execution
main() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════╗"
    echo "║  Draehi End-to-End Test Suite        ║"
    echo "╚════════════════════════════════════════╝"
    echo -e "${NC}"

    check_prerequisites
    setup_database
    create_test_user
    test_git_connection

    echo ""
    log_step "Waiting for sync to complete..."
    echo "Check dashboard for 'Synced' status"
    read -p "Press Enter when sync is complete..."

    validate_content
    compare_with_logseq
    test_ui_rendering

    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  All tests passed!                    ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
}

main "$@"
