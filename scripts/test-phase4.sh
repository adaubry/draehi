#!/bin/bash
set -euo pipefail

# Automated Phase 4 Test - Run before any modifications
# Validates that Phase 4 Logseq features are working correctly

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

log_test() {
    echo -e "${BLUE}🧪 $1${NC}"
}

log_pass() {
    echo -e "${GREEN}✓ $1${NC}"
}

log_fail() {
    echo -e "${RED}✗ $1${NC}"
    ((ERRORS++))
}

log_warn() {
    echo -e "${YELLOW}⚠ $1${NC}"
    ((WARNINGS++))
}

echo -e "${BLUE}"
echo "╔════════════════════════════════════════╗"
echo "║  Phase 4 Automated Test Suite        ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}\n"

# Test 1: TypeScript compilation
log_test "TypeScript Compilation"
if npm run type-check > /dev/null 2>&1; then
    log_pass "TypeScript type-check passed"
else
    log_fail "TypeScript type-check failed"
fi

# Test 2: Build succeeds
log_test "Production Build"
if npm run build > /dev/null 2>&1; then
    log_pass "Production build succeeded"
else
    log_fail "Production build failed"
fi

# Test 3: Critical files exist
log_test "Critical Files"
critical_files=(
    "modules/logseq/process-references.ts"
    "modules/logseq/markdown-parser.ts"
    "modules/content/actions.ts"
    "app/blocks.css"
    "components/viewer/BlockTree.tsx"
    "test-data/logseq-docs-graph/pages/contents.md"
    "scripts/validate-content.js"
    "TEST_SUMMARY.md"
    "docs/TESTING.md"
)

for file in "${critical_files[@]}"; do
    if [[ -f "$PROJECT_ROOT/$file" ]]; then
        log_pass "$file exists"
    else
        log_fail "$file missing"
    fi
done

# Test 4: Test graph structure
log_test "Test Graph Structure"
if [[ -d "$PROJECT_ROOT/test-data/logseq-docs-graph" ]]; then
    log_pass "Logseq docs graph exists"

    # Count pages
    page_count=$(find "$PROJECT_ROOT/test-data/logseq-docs-graph/pages" -name "*.md" 2>/dev/null | wc -l)
    if [[ $page_count -ge 200 ]]; then
        log_pass "Pages found: $page_count"
    else
        log_warn "Only $page_count pages (expected ~238)"
    fi

    # Check journals
    if [[ -d "$PROJECT_ROOT/test-data/logseq-docs-graph/journals" ]]; then
        journal_count=$(find "$PROJECT_ROOT/test-data/logseq-docs-graph/journals" -name "*.md" 2>/dev/null | wc -l)
        log_pass "Journals found: $journal_count"
    else
        log_warn "Journals directory missing"
    fi
else
    log_fail "Test graph missing (run: git clone https://github.com/logseq/docs.git test-data/logseq-docs-graph)"
fi

# Test 5: Reference processing code
log_test "Reference Processing Implementation"
if grep -q "processLogseqReferences" "$PROJECT_ROOT/modules/content/actions.ts"; then
    log_pass "Reference processor integrated in actions"
else
    log_fail "Reference processor not integrated"
fi

if grep -q "page-reference" "$PROJECT_ROOT/modules/logseq/process-references.ts"; then
    log_pass "Page reference processing implemented"
else
    log_fail "Page reference processing missing"
fi

if grep -q "block-reference" "$PROJECT_ROOT/modules/logseq/process-references.ts"; then
    log_pass "Block reference processing implemented"
else
    log_fail "Block reference processing missing"
fi

if grep -q "task-marker" "$PROJECT_ROOT/modules/logseq/process-references.ts"; then
    log_pass "Task marker processing implemented"
else
    log_fail "Task marker processing missing"
fi

# Test 6: CSS styling
log_test "CSS Styling"
css_classes=(
    "page-reference"
    "block-reference"
    "task-marker"
    "task-todo"
    "task-done"
    "priority"
    "priority-A"
)

for class in "${css_classes[@]}"; do
    if grep -q "\.$class" "$PROJECT_ROOT/app/blocks.css"; then
        log_pass ".$class defined"
    else
        log_fail ".$class missing from CSS"
    fi
done

# Test 7: Database schema
log_test "Database Schema"
if grep -q "embedDepth" "$PROJECT_ROOT/modules/workspace/schema.ts"; then
    log_pass "embedDepth field exists"
else
    log_fail "embedDepth field missing"
fi

if grep -q "parentId" "$PROJECT_ROOT/modules/content/schema.ts"; then
    log_pass "parentId field exists (block hierarchy)"
else
    log_fail "parentId field missing"
fi

if grep -q "blockUuid" "$PROJECT_ROOT/modules/content/schema.ts"; then
    log_pass "blockUuid field exists"
else
    log_fail "blockUuid field missing"
fi

if grep -q "nodeType" "$PROJECT_ROOT/modules/content/schema.ts"; then
    log_pass "nodeType field exists"
else
    log_fail "nodeType field missing"
fi

# Test 8: Documentation
log_test "Documentation"
if grep -q "Phase 4" "$PROJECT_ROOT/docs/CHANGELOG.md"; then
    log_pass "CHANGELOG.md updated"
else
    log_warn "CHANGELOG.md may not be updated"
fi

if grep -q "logseq-docs-graph" "$PROJECT_ROOT/TEST_SUMMARY.md"; then
    log_pass "TEST_SUMMARY.md updated with test graph"
else
    log_warn "TEST_SUMMARY.md not updated"
fi

# Test 9: Dependencies
log_test "Dependencies"
if grep -q "cheerio" "$PROJECT_ROOT/package.json"; then
    log_pass "cheerio installed"
else
    log_fail "cheerio not installed"
fi

if grep -q "marked" "$PROJECT_ROOT/package.json"; then
    log_pass "marked installed"
else
    log_fail "marked not installed"
fi

# Test 10: Journals directory creation
log_test "Journals Directory Auto-Creation"
if grep -q "mkdir(journalsDir" "$PROJECT_ROOT/modules/logseq/export.ts"; then
    log_pass "Auto-creates journals/ directory"
else
    log_fail "Journals directory not auto-created (will cause export failure)"
fi

# Summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Test Summary                         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"

if [[ $ERRORS -eq 0 ]] && [[ $WARNINGS -eq 0 ]]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo -e "${GREEN}Phase 4 implementation verified.${NC}"
    exit 0
elif [[ $ERRORS -eq 0 ]]; then
    echo -e "${YELLOW}⚠ Tests passed with $WARNINGS warning(s)${NC}"
    echo -e "${YELLOW}Phase 4 functional but needs attention.${NC}"
    exit 0
else
    echo -e "${RED}✗ $ERRORS error(s), $WARNINGS warning(s)${NC}"
    echo -e "${RED}Phase 4 implementation incomplete or broken.${NC}"
    exit 1
fi
