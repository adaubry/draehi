#!/bin/bash
set -uo pipefail

# Frontend End-to-End Test Suite
# Tests that ingested content displays correctly in the browser

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load test config
if [[ -f "$PROJECT_ROOT/.test.env" ]]; then
    set -a
    source <(grep -v '^#' "$PROJECT_ROOT/.test.env" | grep -v '^$')
    set +a
    echo "✓ Loaded test configuration from .test.env"
else
    echo "❌ .test.env not found"
    exit 1
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

log_step() {
    echo -e "${BLUE}▶ $1${NC}"
}

log_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

log_error() {
    echo -e "${RED}✗ $1${NC}"
    ((ERRORS++))
}

log_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
    ((WARNINGS++))
}

echo -e "${BLUE}"
echo "╔════════════════════════════════════════╗"
echo "║  Frontend End-to-End Test Suite       ║"
echo "║  (Comprehensive Display Tests)         ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}\n"

# Check prerequisites
check_prerequisites() {
    log_step "Checking prerequisites..."

    # Check if curl is available
    if ! command -v curl &> /dev/null; then
        log_error "curl not found (required for HTTP tests)"
        exit 1
    fi

    # Check if jq is available (for JSON parsing)
    if ! command -v jq &> /dev/null; then
        log_warning "jq not found (JSON parsing will be limited)"
    fi

    # Check if dev server is running
    if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
        log_error "Next.js dev server not running on http://localhost:3000"
        echo "  Start it with: npm run dev"
        exit 1
    fi

    log_success "Prerequisites OK"
}

# Test 1: Default page should redirect to /contents
#
test_default_page() {
    log_step "Test 1: Default page redirects to /contents"

    local url="http://localhost:3000/${TEST_WORKSPACE_SLUG}"
    local body=$(curl -s -L "$url")

    # Check if page contains "Contents" title (the /contents page)
    if echo "$body" | grep -q '<h1[^>]*>Contents</h1>'; then
        log_success "Default page loads /contents"
    else
        log_error "Default page does not load /contents"
        echo "  FIX: Check app/[workspaceSlug]/page.tsx redirect"
    fi
}

# Test 2: Slugification must be lowercase
test_slugification() {
    log_step "Test 2: URL slugification is lowercase"

    # Test that lowercase slugs work
    local test_cases=(
        "contents"
        "queries"
        "advanced-queries"
    )

    for slug in "${test_cases[@]}"; do
        local url="http://localhost:3000/${TEST_WORKSPACE_SLUG}/${slug}"
        local status=$(curl -s -o /dev/null -w "%{http_code}" "$url")

        if [[ "$status" == "200" ]]; then
            log_success "Lowercase URL /$slug works (HTTP $status)"
        else
            log_error "Lowercase URL /$slug failed (HTTP $status)"
            echo "  FIX: Check slugification in lib/utils.ts"
        fi
    done

    # Test that URLs with capitals don't exist (should 404 or redirect)
    local cap_url="http://localhost:3000/${TEST_WORKSPACE_SLUG}/Advanced%20Queries"
    local cap_status=$(curl -s -o /dev/null -w "%{http_code}" "$cap_url")

    if [[ "$cap_status" == "404" ]] || [[ "$cap_status" == "301" ]] || [[ "$cap_status" == "302" ]]; then
        log_success "Capitalized URLs properly handled (HTTP $cap_status)"
    elif [[ "$cap_status" == "200" ]]; then
        log_error "Capitalized URLs should not work (got HTTP 200)"
        echo "  FIX: All slugs must be lowercase"
    fi
}

# Test 3: Collapsible blocks with children
test_collapsible_blocks() {
    log_step "Test 3: Blocks with children are collapsible"

    local url="http://localhost:3000/${TEST_WORKSPACE_SLUG}/contents"
    local body=$(curl -s "$url")

    # Check for collapsible markers
    if echo "$body" | grep -q "has-children"; then
        log_success "Collapsible block markers found"
    else
        log_error "No collapsible block markers found"
        echo "  FIX: BlockTree should add 'has-children' class"
    fi

    # Check for collapse indicators (▾/▸)
    if echo "$body" | grep -q "▾\|▸"; then
        log_success "Collapse indicators (▾/▸) present"
    else
        log_error "No collapse indicators found"
        echo "  FIX: Blocks with children should show ▾ or ▸"
    fi

    # Check that all blocks with children are marked collapsible
    # Example: "🌟New to Logseq?" and "basics" should be collapsible
    local problem_blocks=("🌟New to Logseq" "basics")
    for block in "${problem_blocks[@]}"; do
        if echo "$body" | grep -A 5 "$block" | grep -q "has-children"; then
            log_success "Block '$block' marked as collapsible"
        else
            log_warning "Block '$block' may not be marked collapsible"
        fi
    done
}

# Test 4: Block navigation with anchor links
test_block_navigation() {
    log_step "Test 4: Collapsible blocks support ctrl+click navigation"

    local url="http://localhost:3000/${TEST_WORKSPACE_SLUG}/contents"
    local body=$(curl -s "$url")

    # Check for block IDs (UUID format only - 8-4-4-4-12)
    if echo "$body" | grep -qE 'id="[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}"'; then
        log_success "Block IDs found as UUID anchors"
    else
        log_error "No UUID block anchors found"
        echo "  FIX: Blocks need UUID id attribute for #hash navigation"
    fi

    # Check that bullets are clickable links
    if echo "$body" | grep -q 'class="block-bullet"'; then
        log_success "Block bullets are clickable"
    else
        log_error "Block bullets not clickable"
        echo "  FIX: Wrap bullets in <Link href=\"#id\">"
    fi

    # Check for href with UUID hash
    if echo "$body" | grep -qE 'href="[^"]*#[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}"'; then
        log_success "Block links use UUID #hash URLs"
    else
        log_error "Block links don't use UUID #hash URLs"
        echo "  FIX: BlockTree should generate href='#uuid'"
    fi
}

# Test 5: Page references
test_page_references() {
    log_step "Test 5: Page reference links [[page]] work"

    local url="http://localhost:3000/${TEST_WORKSPACE_SLUG}/contents"
    local body=$(curl -s "$url")

    if echo "$body" | grep -q 'class="page-reference'; then
        log_success "Page reference links found"

        local ref_count=$(echo "$body" | grep -o 'class="page-reference' | wc -l)
        log_success "Found $ref_count page reference links"
    else
        log_error "No page reference links found"
        echo "  FIX: processLogseqReferences should convert [[page]]"
    fi
}

# Test 6: Block references
test_block_references() {
    log_step "Test 6: Block reference links ((uuid)) work"

    local url="http://localhost:3000/${TEST_WORKSPACE_SLUG}/contents"
    local body=$(curl -s "$url")

    if echo "$body" | grep -q 'class="block-reference'; then
        log_success "Block reference links found"
    else
        log_warning "No block reference links found in test page"
        echo "  processLogseqReferences should convert ((uuid))"
    fi
}

# Test 7: Backlinks (cited by / related)
test_backlinks() {
    log_step "Test 7: Page shows backlinks (cited by/related)"

    local url="http://localhost:3000/${TEST_WORKSPACE_SLUG}/contents"
    local body=$(curl -s "$url")

    # Check for backlinks section
    if echo "$body" | grep -qi "cited by"; then
        log_success "'Cited by' section found"
    else
        log_error "No 'Cited by' section found"
        echo "  FIX: Add backlinks to page template"
        echo "  - 'Cited by': pages with [[page]] references"
    fi

    if echo "$body" | grep -qi "related"; then
        log_success "'Related' section found"
    else
        log_error "No 'Related' section found"
        echo "  FIX: Add related section"
        echo "  - 'Related': pages with ((block-uuid)) references"
    fi
}

# Test 8: Sidebar navigation
test_sidebar() {
    log_step "Test 8: Sidebar navigation is correct"

    local url="http://localhost:3000/${TEST_WORKSPACE_SLUG}/contents"
    local body=$(curl -s "$url")

    # Check for sidebar structure
    if echo "$body" | grep -q '<aside'; then
        log_success "Sidebar <aside> element found"
    else
        log_error "No <aside> element found"
        echo "  FIX: Sidebar should use semantic HTML"
    fi

    # Check for navigation
    if echo "$body" | grep -q '<nav'; then
        log_success "Navigation element found"
    else
        log_error "No <nav> element found"
        echo "  FIX: Use <nav> for sidebar navigation"
    fi

    # Check for hierarchical indentation
    if echo "$body" | grep -q 'paddingLeft\|style="padding-left'; then
        log_success "Sidebar shows hierarchical indentation"
    else
        log_error "Sidebar doesn't show page hierarchy"
        echo "  FIX: TreeItem should indent based on depth"
    fi

    # Check that sidebar contains pages
    if echo "$body" | grep -q 'Pages'; then
        log_success "Sidebar shows 'Pages' section"
    else
        log_warning "Sidebar may not show pages section"
    fi
}

# Test 9: Block hierarchy rendering
test_block_hierarchy() {
    log_step "Test 9: Block hierarchy renders with nesting"

    local url="http://localhost:3000/${TEST_WORKSPACE_SLUG}/contents"
    local body=$(curl -s "$url")

    # Check for nested structure
    if echo "$body" | grep -q 'block-children'; then
        log_success "Nested block structure found"
    else
        log_error "No nested blocks (block-children class)"
        echo "  FIX: BlockTree should render nested <ul>"
    fi

    # Check for depth markers
    if echo "$body" | grep -q 'data-depth\|marginLeft'; then
        log_success "Block depth indicators present"
    else
        log_error "No block depth indicators"
        echo "  FIX: Add data-depth attribute"
    fi
}

# Test 10: Task markers
test_task_markers() {
    log_step "Test 10: Task markers (TODO/DONE) render correctly"

    local url="http://localhost:3000/${TEST_WORKSPACE_SLUG}/contents"
    local body=$(curl -s "$url")

    if echo "$body" | grep -q 'task-marker\|task-todo\|task-done'; then
        log_success "Task markers found"
    else
        log_warning "No task markers found (may not exist in test data)"
    fi

    if echo "$body" | grep -q 'type="checkbox"'; then
        log_success "Task checkboxes rendered"
    else
        log_warning "No task checkboxes found"
    fi
}

# Test 11: CSS styling loaded
test_css_loaded() {
    log_step "Test 11: CSS stylesheets are loaded"

    local url="http://localhost:3000/${TEST_WORKSPACE_SLUG}/contents"
    local body=$(curl -s "$url")

    if echo "$body" | grep -q 'rel="stylesheet"'; then
        log_success "CSS stylesheets linked"
    else
        log_error "No CSS stylesheets found"
        echo "  FIX: Check app/layout.tsx"
    fi

    if echo "$body" | grep -q 'blocks.css'; then
        log_success "blocks.css explicitly loaded"
    else
        log_warning "blocks.css not explicitly found (may be bundled)"
    fi
}

# Test 12: No error messages when content exists
test_no_errors() {
    log_step "Test 12: Pages don't show errors when content exists"

    local url="http://localhost:3000/${TEST_WORKSPACE_SLUG}/contents"
    local response=$(curl -s -w "\n%{http_code}" "$url")
    local body=$(echo "$response" | head -n -1)
    local status=$(echo "$response" | tail -n 1)

    if [[ "$status" != "200" ]]; then
        log_error "Page returned HTTP $status"
        return 1
    fi

    if echo "$body" | grep -q "No blocks yet"; then
        log_error "Page shows 'No blocks yet' despite having content"
        echo "  FIX: Check getAllBlocksForPage query"
    else
        log_success "No error messages shown"
    fi

    # Check block count
    local block_count=$(echo "$body" | grep -o 'class="block' | wc -l)
    if [[ "$block_count" -ge 20 ]]; then
        log_success "Page has $block_count blocks"
    else
        log_error "Page has only $block_count blocks (expected ≥20)"
        echo "  FIX: Check content ingestion"
    fi
}

# Main test execution
main() {
    check_prerequisites
    echo ""

    test_default_page
    echo ""

    test_slugification
    echo ""

    test_collapsible_blocks
    echo ""

    test_block_navigation
    echo ""

    test_page_references
    echo ""

    test_block_references
    echo ""

    test_backlinks
    echo ""

    test_sidebar
    echo ""

    test_block_hierarchy
    echo ""

    test_task_markers
    echo ""

    test_css_loaded
    echo ""

    test_no_errors

    # Summary
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  Test Summary                          ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"

    if [[ $ERRORS -eq 0 ]] && [[ $WARNINGS -eq 0 ]]; then
        echo -e "${GREEN}✓ All tests passed!${NC}"
        exit 0
    elif [[ $ERRORS -eq 0 ]]; then
        echo -e "${YELLOW}⚠ Tests passed with $WARNINGS warning(s)${NC}"
        exit 0
    else
        echo -e "${RED}✗ $ERRORS error(s), $WARNINGS warning(s)${NC}"
        echo ""
        echo "Key issues found:"
        echo "  1. Collapsible blocks not working correctly"
        echo "  2. Slugification may have capitalized URLs"
        echo "  3. Missing backlinks (cited by/related)"
        echo "  4. Block navigation (ctrl+click) not implemented"
        echo "  5. Sidebar hierarchy issues"
        exit 1
    fi
}

main
