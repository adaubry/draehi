#!/bin/bash
set -euo pipefail

# Verify Implementation Against Source Code
# Directly checks code to ensure features are actually implemented, not just documented

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0

log_check() {
    echo -e "${BLUE}🔍 $1${NC}"
}

log_pass() {
    echo -e "${GREEN}✓ $1${NC}"
}

log_fail() {
    echo -e "${RED}✗ $1${NC}"
    ((ERRORS++))
}

echo -e "${BLUE}"
echo "╔════════════════════════════════════════╗"
echo "║  Implementation Source Verification   ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}\n"

# 1. Verify page reference processing ACTUALLY processes [[page]]
log_check "Page Reference Processing"
if grep -q '\[\[' "$PROJECT_ROOT/modules/logseq/process-references.ts"; then
    log_pass "Regex for [[page]] found in source"

    # Check it creates <a> tags
    if grep -q 'page-reference' "$PROJECT_ROOT/modules/logseq/process-references.ts"; then
        log_pass "Creates page-reference links"
    else
        log_fail "Does not create page-reference links"
    fi
else
    log_fail "No regex for [[page]] in process-references.ts"
fi

# 2. Verify block reference processing ACTUALLY processes ((uuid))
log_check "Block Reference Processing"
if grep -q '((.*))' "$PROJECT_ROOT/modules/logseq/process-references.ts"; then
    log_pass "Regex for ((uuid)) found in source"

    if grep -q 'block-reference' "$PROJECT_ROOT/modules/logseq/process-references.ts"; then
        log_pass "Creates block-reference links"
    else
        log_fail "Does not create block-reference links"
    fi
else
    log_fail "No regex for ((uuid)) in process-references.ts"
fi

# 3. Verify task markers ACTUALLY process TODO/DOING/etc
log_check "Task Marker Processing"
if grep -q 'TODO|DOING|DONE|LATER|NOW' "$PROJECT_ROOT/modules/logseq/process-references.ts"; then
    log_pass "Task marker regex found in source"

    # Check for checkbox creation
    if grep -q 'type="checkbox"' "$PROJECT_ROOT/modules/logseq/process-references.ts"; then
        log_pass "Creates checkboxes for tasks"
    else
        log_fail "Does not create checkboxes"
    fi

    # Check for disabled attribute
    if grep -q 'disabled' "$PROJECT_ROOT/modules/logseq/process-references.ts"; then
        log_pass "Checkboxes are disabled (read-only)"
    else
        log_fail "Checkboxes not disabled (should be read-only)"
    fi
else
    log_fail "No task marker processing in source"
fi

# 4. Verify priority levels ACTUALLY process [#A]/[#B]/[#C]
log_check "Priority Level Processing"
if grep -q '\[#' "$PROJECT_ROOT/modules/logseq/process-references.ts"; then
    log_pass "Priority regex found in source"

    if grep -q 'priority' "$PROJECT_ROOT/modules/logseq/process-references.ts"; then
        log_pass "Creates priority elements"
    else
        log_fail "Does not create priority elements"
    fi
else
    log_fail "No priority processing in source"
fi

# 5. Verify reference processor is ACTUALLY called during ingestion
log_check "Reference Processor Integration"
if grep -q "import.*processLogseqReferences" "$PROJECT_ROOT/modules/content/actions.ts"; then
    log_pass "processLogseqReferences imported in actions"

    # Check it's actually called
    if grep -q "processLogseqReferences(" "$PROJECT_ROOT/modules/content/actions.ts"; then
        log_pass "processLogseqReferences() called during ingestion"

        # Verify it's called with workspace slug
        if grep -A5 "processLogseqReferences(" "$PROJECT_ROOT/modules/content/actions.ts" | grep -q "workspaceSlug"; then
            log_pass "Called with workspaceSlug (needed for links)"
        else
            log_fail "Not called with workspaceSlug"
        fi
    else
        log_fail "processLogseqReferences never called"
    fi
else
    log_fail "processLogseqReferences not imported in actions.ts"
fi

# 6. Verify markdown parser ACTUALLY extracts blocks
log_check "Markdown Parser Block Extraction"
if grep -q "parseLogseqMarkdown" "$PROJECT_ROOT/modules/logseq/markdown-parser.ts"; then
    log_pass "parseLogseqMarkdown function exists"

    # Check for UUID extraction
    if grep -q 'id::' "$PROJECT_ROOT/modules/logseq/markdown-parser.ts"; then
        log_pass "Extracts block UUIDs (id:: property)"
    else
        log_fail "Does not extract block UUIDs"
    fi

    # Check for hierarchy
    if grep -q 'parentUuid' "$PROJECT_ROOT/modules/logseq/markdown-parser.ts"; then
        log_pass "Builds block hierarchy (parentUuid)"
    else
        log_fail "Does not build hierarchy"
    fi
else
    log_fail "parseLogseqMarkdown not found"
fi

# 7. Verify CSS ACTUALLY has all required classes
log_check "CSS Class Definitions"
required_classes=(
    "page-reference"
    "block-reference"
    "task-marker"
    "task-todo"
    "task-done"
    "priority-A"
)

for class in "${required_classes[@]}"; do
    if grep -q "\.$class\s*{" "$PROJECT_ROOT/app/blocks.css"; then
        log_pass ".$class has style rules"
    else
        log_fail ".$class missing style rules"
    fi
done

# 8. Verify dark mode styles exist
log_check "Dark Mode Support"
if grep -q "@media.*prefers-color-scheme.*dark" "$PROJECT_ROOT/app/blocks.css"; then
    log_pass "Dark mode media query exists"

    # Check for dark mode page-reference
    if grep -A20 "@media.*dark" "$PROJECT_ROOT/app/blocks.css" | grep -q "page-reference"; then
        log_pass "Dark mode styles for page-reference"
    else
        log_fail "No dark mode for page-reference"
    fi
else
    log_fail "No dark mode support"
fi

# 9. Verify BlockTree ACTUALLY renders blocks recursively
log_check "BlockTree Recursive Rendering"
if grep -q "BlockItem" "$PROJECT_ROOT/components/viewer/BlockTree.tsx"; then
    log_pass "BlockItem component exists"

    # Check for recursion (BlockItem calling itself)
    if grep -A2 "children.map" "$PROJECT_ROOT/components/viewer/BlockTree.tsx" | grep -q "BlockItem"; then
        log_pass "Renders children recursively"
    else
        log_fail "Does not render recursively"
    fi

    # Check for collapse/expand
    if grep -q "isCollapsed" "$PROJECT_ROOT/components/viewer/BlockTree.tsx"; then
        log_pass "Has collapse/expand state"
    else
        log_fail "No collapse/expand functionality"
    fi
else
    log_fail "BlockItem component not found"
fi

# 10. Verify journals directory is ACTUALLY created
log_check "Journals Directory Creation"
if grep -q "mkdir.*journals" "$PROJECT_ROOT/modules/logseq/export.ts"; then
    log_pass "Creates journals/ directory"

    # Check it's created with recursive option
    if grep -q "recursive.*true" "$PROJECT_ROOT/modules/logseq/export.ts"; then
        log_pass "Uses recursive: true (safe)"
    else
        log_fail "Not using recursive option (may fail)"
    fi
else
    log_fail "Does not create journals/ directory"
fi

# 11. Verify workspace slug is ACTUALLY fetched during ingestion
log_check "Workspace Slug Fetching"
if grep -q "workspace.*slug" "$PROJECT_ROOT/modules/content/actions.ts"; then
    log_pass "Fetches workspace slug"

    # Verify it queries the database
    if grep -q "db.query.workspaces.findFirst" "$PROJECT_ROOT/modules/content/actions.ts"; then
        log_pass "Queries database for workspace"
    else
        log_fail "Does not query database for workspace"
    fi
else
    log_fail "Does not fetch workspace slug"
fi

# 12. Verify embedDepth field exists in schema
log_check "EmbedDepth Database Field"
if grep -q "embedDepth.*integer" "$PROJECT_ROOT/modules/workspace/schema.ts"; then
    log_pass "embedDepth field defined as integer"

    # Check default value
    if grep -q "default(5)" "$PROJECT_ROOT/modules/workspace/schema.ts"; then
        log_pass "Default value is 5"
    else
        log_fail "No default value or not 5"
    fi
else
    log_fail "embedDepth field not defined"
fi

# Summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Verification Summary                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"

if [[ $ERRORS -eq 0 ]]; then
    echo -e "${GREEN}✓ All implementation checks passed!${NC}"
    echo -e "${GREEN}Source code verified - features actually implemented.${NC}"
    exit 0
else
    echo -e "${RED}✗ $ERRORS implementation issue(s) found${NC}"
    echo -e "${RED}Code claims features but source verification failed.${NC}"
    exit 1
fi
