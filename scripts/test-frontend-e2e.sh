#!/bin/bash
set -euo pipefail

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
}

echo -e "${BLUE}"
echo "╔════════════════════════════════════════╗"
echo "║  Frontend End-to-End Test Suite       ║"
echo "║  (Display & Rendering)                 ║"
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

# Test workspace homepage
test_workspace_home() {
    log_step "Testing workspace homepage..."

    local url="http://localhost:3000/${TEST_WORKSPACE_SLUG}"
    local response=$(curl -s -w "\n%{http_code}" "$url")
    local body=$(echo "$response" | head -n -1)
    local status=$(echo "$response" | tail -n 1)

    if [[ "$status" == "200" ]]; then
        log_success "Workspace homepage loads (HTTP $status)"
    else
        log_error "Workspace homepage failed (HTTP $status)"
        echo "  URL: $url"
        return 1
    fi

    # Check if it contains workspace name or content
    if echo "$body" | grep -q "test"; then
        log_success "Workspace homepage contains expected content"
    else
        log_warning "Workspace homepage may not have loaded correctly"
    fi
}

# Test specific pages with blocks
test_page_with_blocks() {
    local page_slug="$1"
    local expected_min_blocks="$2"

    log_step "Testing page: /$page_slug"

    local url="http://localhost:3000/${TEST_WORKSPACE_SLUG}/${page_slug}"
    local response=$(curl -s -w "\n%{http_code}" "$url")
    local body=$(echo "$response" | head -n -1)
    local status=$(echo "$response" | tail -n 1)

    if [[ "$status" != "200" ]]; then
        log_error "Page /$page_slug returned HTTP $status"
        echo "  URL: $url"
        echo "  Expected: HTTP 200"
        return 1
    fi

    log_success "Page /$page_slug loads (HTTP $status)"

    # Check for "No blocks yet" error message
    if echo "$body" | grep -q "No blocks yet"; then
        log_error "Page /$page_slug shows 'No blocks yet' (blocks not rendering)"
        echo "  This indicates frontend query/display issue"
        echo "  Backend data exists but frontend can't display it"
        return 1
    fi

    log_success "Page /$page_slug does not show 'No blocks yet'"

    # Check for block HTML structure (Logseq uses <div> with classes)
    local block_count=$(echo "$body" | grep -o 'class="block' | wc -l)

    if [[ "$block_count" -ge "$expected_min_blocks" ]]; then
        log_success "Page /$page_slug has $block_count blocks (expected ≥$expected_min_blocks)"
    else
        log_error "Page /$page_slug has only $block_count blocks (expected ≥$expected_min_blocks)"
        echo "  Blocks may not be rendering correctly"
        return 1
    fi
}

# Test page with spaces in slug
test_page_with_spaces() {
    log_step "Testing pages with spaces in URLs..."

    # Test URL encoding for spaces
    local test_cases=(
        "All%20pages:all-pages"  # URL encoded space
        "All+pages:all-pages"    # Plus sign encoding
    )

    for test_case in "${test_cases[@]}"; do
        local url_slug="${test_case%%:*}"
        local db_slug="${test_case##*:}"

        local url="http://localhost:3000/${TEST_WORKSPACE_SLUG}/${url_slug}"
        local status=$(curl -s -o /dev/null -w "%{http_code}" "$url")

        if [[ "$status" == "200" ]] || [[ "$status" == "301" ]] || [[ "$status" == "302" ]]; then
            log_success "Page with spaces accessible via /$url_slug (HTTP $status)"
        else
            log_error "Page with spaces not accessible via /$url_slug (HTTP $status)"
            echo "  URL: $url"
            echo "  Database slug: $db_slug"
            echo "  Issue: URL encoding for spaces may not be handled correctly"
        fi
    done
}

# Test page references (links)
test_page_references() {
    log_step "Testing page reference links..."

    local url="http://localhost:3000/${TEST_WORKSPACE_SLUG}/contents"
    local body=$(curl -s "$url")

    # Check for page-reference class (from processLogseqReferences)
    if echo "$body" | grep -q 'class="page-reference'; then
        log_success "Page contains page-reference links"

        # Count page references
        local ref_count=$(echo "$body" | grep -o 'class="page-reference' | wc -l)
        log_success "Found $ref_count page reference links"
    else
        log_warning "No page-reference links found"
        echo "  processLogseqReferences may not be working"
    fi
}

# Test block hierarchy rendering
test_block_hierarchy() {
    log_step "Testing block hierarchy rendering..."

    local url="http://localhost:3000/${TEST_WORKSPACE_SLUG}/contents"
    local body=$(curl -s "$url")

    # Check for nested block structure
    if echo "$body" | grep -q 'ml-'; then  # Tailwind margin-left classes for nesting
        log_success "Page contains nested block indentation"
    else
        log_warning "No block nesting detected"
        echo "  BlockTree may not be rendering hierarchy"
    fi
}

# Test task markers
test_task_markers() {
    log_step "Testing task marker rendering..."

    # Find a page with tasks (if any)
    local url="http://localhost:3000/${TEST_WORKSPACE_SLUG}/contents"
    local body=$(curl -s "$url")

    # Check for task-marker class
    if echo "$body" | grep -q 'class="task-marker'; then
        log_success "Page contains task markers"
    else
        log_warning "No task markers found (may not exist in test data)"
    fi
}

# Validate CSS is loaded
test_css_loaded() {
    log_step "Testing CSS loading..."

    local url="http://localhost:3000/${TEST_WORKSPACE_SLUG}/contents"
    local body=$(curl -s "$url")

    # Check for CSS link tags
    if echo "$body" | grep -q 'rel="stylesheet"'; then
        log_success "CSS stylesheets are linked"
    else
        log_error "No CSS stylesheets found"
        echo "  Blocks.css may not be loaded"
        return 1
    fi

    # Check if blocks.css is specifically included
    if echo "$body" | grep -q 'blocks.css'; then
        log_success "blocks.css is loaded"
    else
        log_warning "blocks.css not explicitly found (may be bundled)"
    fi
}

# Test navigation
test_navigation() {
    log_step "Testing navigation..."

    local url="http://localhost:3000/${TEST_WORKSPACE_SLUG}"
    local body=$(curl -s "$url")

    # Check for navigation links
    if echo "$body" | grep -q '<nav'; then
        log_success "Navigation element found"
    else
        log_warning "No navigation element detected"
    fi
}

# Main test execution
main() {
    check_prerequisites

    echo ""
    test_workspace_home

    echo ""
    # Test key pages that should have blocks
    test_page_with_blocks "contents" 50
    test_page_with_blocks "Queries" 20

    echo ""
    test_page_with_spaces

    echo ""
    test_page_references

    echo ""
    test_block_hierarchy

    echo ""
    test_task_markers

    echo ""
    test_css_loaded

    echo ""
    test_navigation

    # Summary
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  Test Summary                          ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"

    if [[ $ERRORS -eq 0 ]]; then
        echo -e "${GREEN}✓ All frontend tests passed!${NC}"
        echo -e "${GREEN}Content displays correctly in browser${NC}"
        exit 0
    else
        echo -e "${RED}✗ $ERRORS frontend test(s) failed${NC}"
        echo -e "${RED}See errors above for details${NC}"
        echo ""
        echo "Common issues:"
        echo "  1. 'No blocks yet' → Query not finding blocks (check workspace ID)"
        echo "  2. HTTP 404 → Slug encoding issue (spaces, special chars)"
        echo "  3. Missing references → processLogseqReferences not working"
        echo "  4. No hierarchy → BlockTree not rendering nested blocks"
        exit 1
    fi
}

main
