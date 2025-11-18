#!/bin/bash
set -euo pipefail

# Frontend Test for Phase 4 Critical Issues
# Tests current state against 9 known critical issues
# Establishes baseline for what works vs what needs fixing

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
GRAY='\033[0;90m'
NC='\033[0m'

ERRORS=0
WARNINGS=0
PASSED=0

log_step() {
    echo -e "${BLUE}━━━ $1 ━━━${NC}"
}

log_test() {
    echo -e "${GRAY}Testing: $1${NC}"
}

log_success() {
    echo -e "${GREEN}✓ $1${NC}"
    ((PASSED++))
}

log_error() {
    echo -e "${RED}✗ $1${NC}"
    ((ERRORS++))
}

log_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
    ((WARNINGS++))
}

log_info() {
    echo -e "  $1"
}

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════╗"
echo "║  Phase 4 Critical Issues - Frontend Test Baseline    ║"
echo "║  Tests 9 known issues to establish current state     ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}\n"

# Check prerequisites
check_prerequisites() {
    log_step "Prerequisites"

    if ! command -v curl &> /dev/null; then
        log_error "curl not found"
        exit 1
    fi

    if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
        log_error "Next.js dev server not running on http://localhost:3000"
        log_info "Start with: npm run dev"
        exit 1
    fi

    log_success "Prerequisites OK"
    printf "\n"
}

# Issue #1: Blocks Not Clickable/Redirectable
test_block_navigation() {
    log_step "Issue #1: Block Navigation (Clickable blocks with hash links)"

    local url="http://localhost:3000/${TEST_WORKSPACE_SLUG}/contents"
    local body=$(curl -s "$url")

    # Test if blocks have IDs
    log_test "Blocks have id attributes"
    if echo "$body" | grep -q 'id="block-'; then
        log_success "Block IDs found in HTML"
    else
        log_error "Block IDs missing (blocks not navigable)"
        log_info "Expected: <div id=\"block-12345\">"
    fi

    # Test for clickable bullet indicators
    log_test "Blocks have clickable bullets"
    if echo "$body" | grep -q 'class=".*bullet'; then
        log_success "Bullet elements found"
    else
        log_warning "Bullet elements may not be clickable"
        log_info "Expected: Elements with 'bullet' class"
    fi

    # Test for target highlighting CSS
    log_test ":target CSS for highlighting"
    if echo "$body" | grep -q ':target' || curl -s "http://localhost:3000/blocks.css" | grep -q ':target'; then
        log_success "Target highlight CSS found"
    else
        log_warning "Target highlight CSS missing"
        log_info "Clicking block won't highlight it"
    fi

    printf "\n"
}

# Issue #2: Blocks Missing Collapse Functionality
test_block_collapse() {
    log_step "Issue #2: Block Collapse (▸/▾ indicators)"

    local url="http://localhost:3000/${TEST_WORKSPACE_SLUG}/contents"
    local body=$(curl -s "$url")

    # Test for collapse indicators
    log_test "Collapse indicators (▸/▾)"
    if echo "$body" | grep -qE '▸|▾|&#9656;|&#9662;'; then
        log_success "Collapse indicators found"
    else
        log_error "Collapse indicators missing"
        log_info "Nested blocks can't be collapsed/expanded"
    fi

    # Test for collapse state management
    log_test "Collapse state attributes"
    if echo "$body" | grep -qE 'data-collapsed|aria-expanded'; then
        log_success "Collapse state attributes found"
    else
        log_warning "Collapse state attributes missing"
        log_info "May lack proper state management"
    fi

    printf "\n"
}

# Issue #3: Multi-Word Page Slugs Broken (404s)
test_multi_word_slugs() {
    log_step "Issue #3: Multi-Word Page Slugs (Spaces in URLs → 404)"

    # Test pages with spaces (should work with hyphens)
    log_test "Single-word page (baseline)"
    local status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/${TEST_WORKSPACE_SLUG}/contents")
    if [[ "$status" == "200" ]]; then
        log_success "Single-word pages work (HTTP 200)"
    else
        log_error "Even single-word pages fail (HTTP $status)"
    fi

    # Test common multi-word pages from Logseq docs
    local multi_word_pages=("advanced-queries" "built-in-properties" "all-pages" "getting-started")
    local working=0
    local total=${#multi_word_pages[@]}

    log_test "Multi-word pages with hyphens"
    for page in "${multi_word_pages[@]}"; do
        local url="http://localhost:3000/${TEST_WORKSPACE_SLUG}/${page}"
        local status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
        if [[ "$status" == "200" ]]; then
            ((working++))
        fi
    done

    if [[ $working -eq $total ]]; then
        log_success "Multi-word pages accessible ($working/$total)"
    elif [[ $working -gt 0 ]]; then
        log_warning "Some multi-word pages work ($working/$total)"
        log_info "May have incomplete slugification"
    else
        log_error "Multi-word pages don't work (0/$total)"
        log_info "Slugification broken - only single words work"
    fi

    # Test for spaces in database slugs
    log_test "Database slugs contain spaces (should be hyphens)"
    log_warning "Cannot test without DB access - manual check needed"
    log_info "Run: SELECT slug FROM nodes WHERE slug LIKE '% %'"

    printf "\n"
}

# Issue #4: Case-Sensitive URLs
test_case_sensitivity() {
    log_step "Issue #4: Case-Sensitive URLs (Should be case-insensitive)"

    local base_url="http://localhost:3000/${TEST_WORKSPACE_SLUG}"

    # Test same page with different cases
    log_test "Lowercase vs uppercase URLs"
    local lower=$(curl -s -o /dev/null -w "%{http_code}" "${base_url}/contents")
    local upper=$(curl -s -o /dev/null -w "%{http_code}" "${base_url}/Contents")
    local mixed=$(curl -s -o /dev/null -w "%{http_code}" "${base_url}/CONTENTS")

    if [[ "$lower" == "200" && "$upper" == "200" && "$mixed" == "200" ]]; then
        log_success "URLs are case-insensitive (all return 200)"
    elif [[ "$lower" == "200" && ("$upper" == "404" || "$mixed" == "404") ]]; then
        log_error "URLs are case-sensitive"
        log_info "/contents=200, /Contents=$upper, /CONTENTS=$mixed"
        log_info "Breaks user expectations vs Logseq behavior"
    else
        log_warning "Case sensitivity unclear (lower=$lower, upper=$upper, mixed=$mixed)"
    fi

    printf "\n"
}

# Issue #5: Empty Pages (Missing References Display)
test_empty_pages() {
    log_step "Issue #5: Empty Pages (Should show backlinks/references)"

    # Test a known empty page from Logseq docs (exists only for backlinks)
    local url="http://localhost:3000/${TEST_WORKSPACE_SLUG}/query"
    local body=$(curl -s "$url")
    local status=$(curl -s -o /dev/null -w "%{http_code}" "$url")

    if [[ "$status" == "404" ]]; then
        log_warning "Test page not found (may not be ingested yet)"
        printf "\n"
        return
    fi

    log_test "Pages show 'Cited By' section (+1 refs)"
    if echo "$body" | grep -qi "cited.by\|linked.references\|references"; then
        log_success "Reference section found"
    else
        log_error "'Cited By' section missing"
        log_info "Empty pages show nothing instead of backlinks"
    fi

    log_test "Pages show 'Related' section (+2 refs)"
    if echo "$body" | grep -qi "related"; then
        log_success "'Related' section found"
    else
        log_warning "'Related' section missing"
        log_info "Should show pages 2 hops away"
    fi

    log_test "Empty pages don't show 'No blocks yet'"
    if echo "$body" | grep -q "No blocks yet"; then
        log_error "Empty page shows 'No blocks yet' instead of references"
    else
        log_success "No 'No blocks yet' message"
    fi

    printf "\n"
}

# Issue #6: Missing #Hashtag Links
test_hashtag_links() {
    log_step "Issue #6: Hashtag Links (#tag → page link)"

    local url="http://localhost:3000/${TEST_WORKSPACE_SLUG}/contents"
    local body=$(curl -s "$url")

    log_test "Hashtags render as links"
    if echo "$body" | grep -q 'class=".*hashtag'; then
        log_success "Hashtag links found"
    else
        log_error "Hashtag links missing"
        log_info "Expected: <a class=\"hashtag-link\" href=\"/page\">#tag</a>"
        log_info "Actual: #tag shown as plain text"
    fi

    log_test "Hashtag styling exists"
    if curl -s "http://localhost:3000/blocks.css" | grep -q 'hashtag'; then
        log_success "Hashtag CSS found"
    else
        log_warning "Hashtag CSS missing"
    fi

    printf "\n"
}

# Issue #7: No Default "Contents" Page
test_default_page() {
    log_step "Issue #7: Default Page (/{workspace} → /contents)"

    local url="http://localhost:3000/${TEST_WORKSPACE_SLUG}"
    local response=$(curl -s -w "\n%{http_code}" -L "$url")
    local status=$(echo "$response" | tail -n 1)
    local body=$(echo "$response" | head -n -1)

    log_test "Root workspace URL behavior"
    if [[ "$status" == "200" ]]; then
        # Check if it redirected to contents
        if echo "$body" | grep -q "contents\|Contents"; then
            log_success "Root redirects to default page"
        else
            log_warning "Root loads but unclear if it's default page"
        fi
    elif [[ "$status" =~ ^30[0-9]$ ]]; then
        log_success "Root performs redirect (HTTP $status)"
    else
        log_error "Root URL fails (HTTP $status)"
        log_info "Should redirect to /contents or configured default"
    fi

    printf "\n"
}

# Issue #8: Broken Sidebar Structure
test_sidebar_structure() {
    log_step "Issue #8: Sidebar Structure (Should be: TOC not page index)"

    local url="http://localhost:3000/${TEST_WORKSPACE_SLUG}/contents"
    local body=$(curl -s "$url")

    log_test "Sidebar contains back button"
    if echo "$body" | grep -qi "back\|←\|&larr;"; then
        log_success "Back button found"
    else
        log_error "Back button missing"
        log_info "Expected: ← Back to {last page}"
    fi

    log_test "Sidebar has 'All Pages' button/link"
    if echo "$body" | grep -qi "all.pages"; then
        log_success "'All Pages' button found"
    else
        log_error "'All Pages' button missing"
        log_info "Expected: Button to show full page index"
    fi

    log_test "Sidebar shows Table of Contents"
    if echo "$body" | grep -qi "table.of.contents\|toc"; then
        log_success "TOC found"
    else
        log_warning "TOC not explicitly found"
        log_info "Current sidebar may show page index instead"
    fi

    log_test "Sidebar does NOT show full page index"
    # If sidebar has 50+ links, it's probably showing all pages (wrong)
    local link_count=$(echo "$body" | grep -o '<a.*href="/test/' | wc -l)
    if [[ $link_count -lt 20 ]]; then
        log_success "Sidebar not showing all pages ($link_count links)"
    else
        log_error "Sidebar shows page index instead of TOC ($link_count links)"
        log_info "Should show current page's headings only"
    fi

    printf "\n"
}

# Issue #9: No Breadcrumbs
test_breadcrumbs() {
    log_step "Issue #9: Breadcrumbs (Navigation trail)"

    # Test on a nested page
    local url="http://localhost:3000/${TEST_WORKSPACE_SLUG}/contents"
    local body=$(curl -s "$url")

    log_test "Breadcrumbs exist"
    if echo "$body" | grep -qE 'breadcrumb|aria-label="Breadcrumb"'; then
        log_success "Breadcrumbs found"
    else
        log_error "Breadcrumbs missing"
        log_info "Expected: Home / namespace / page"
    fi

    log_test "Breadcrumb separator"
    if echo "$body" | grep -qE '/|›|>|&rsaquo;'; then
        log_success "Breadcrumb separators found"
    else
        log_warning "Breadcrumb separators unclear"
    fi

    printf "\n"
}

# Summary Report
print_summary() {
    printf "\n"
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  Test Summary - Phase 4 Critical Issues              ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════╝${NC}"
    printf "\n"

    echo -e "${GREEN}✓ Passed:  $PASSED tests${NC}"
    echo -e "${YELLOW}⚠ Warnings: $WARNINGS tests${NC}"
    echo -e "${RED}✗ Failed:  $ERRORS tests${NC}"
    printf "\n"

    if [[ $ERRORS -eq 0 && $WARNINGS -eq 0 ]]; then
        echo -e "${GREEN}🎉 All Phase 4 issues resolved!${NC}"
        echo -e "${GREEN}Ready for production deployment${NC}"
        exit 0
    elif [[ $ERRORS -eq 0 ]]; then
        echo -e "${YELLOW}⚠️  Phase 4 mostly complete (minor warnings)${NC}"
        echo -e "${YELLOW}Review warnings before deployment${NC}"
        exit 0
    else
        echo -e "${RED}❌ Phase 4 incomplete ($ERRORS critical issues)${NC}"
        printf "\n"
        echo "Next steps:"
        echo "1. Review failed tests above"
        echo "2. Refer to docs/PHASE4_ISSUES.md for fix details"
        echo "3. Implement fixes per repair roadmap"
        echo "4. Re-run this test after each fix"
        printf "\n"
        exit 1
    fi
}

# Main execution
main() {
    check_prerequisites
    test_block_navigation
    test_block_collapse
    test_multi_word_slugs
    test_case_sensitivity
    test_empty_pages
    test_hashtag_links
    test_default_page
    test_sidebar_structure
    test_breadcrumbs
    print_summary
}

main
