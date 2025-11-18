# Phase 4 Issues - Test Plan Updates

**Purpose:** Define test script changes needed to validate Phase 4 fixes
**Related:** [PHASE4_ISSUES.md](./PHASE4_ISSUES.md)
**Status:** Planning

---

## Test Strategy

### Testing Pyramid

```
        ┌──────────────┐
        │  Manual E2E  │  ← 5 min, visual validation
        ├──────────────┤
        │  Integration │  ← 2 min, content/nav tests
        ├──────────────┤
        │ Unit Tests   │  ← 30s, slug/parse/ref logic
        └──────────────┘
```

**Goals:**
1. Catch regressions automatically
2. Validate against Logseq docs (ground truth)
3. Fast feedback (<3 min total)
4. CI-ready (future)

---

## New Test Files

### 1. `scripts/test-slugification.ts`

**Purpose:** Validate slug generation edge cases

**Test Cases:**
```typescript
// Spaces
"Advanced Features" → "advanced-features" ✓
"Multi  Word  Spaces" → "multi-word-spaces" ✓

// Case
"CamelCase" → "camelcase" ✓
"SCREAMING" → "screaming" ✓

// Special chars
"FAQ & Help" → "faq-help" ✓
"What's Next?" → "whats-next" ✓
"C++ Tutorial" → "c-tutorial" ✓

// Namespaces
"guides/Getting Started" → "guides/getting-started" ✓
"docs/API/Overview" → "docs/api/overview" ✓

// Unicode
"café" → ? (TBD based on strategy)
"日本語" → ? (TBD)

// Edge cases
"" → "" or error ✓
"---" → "" or error ✓
"   spaces   " → "spaces" ✓
"123-numbers" → "123-numbers" ✓
```

**Validation:**
- All output URL-safe (alphanumeric + hyphen + slash)
- No double hyphens
- No leading/trailing hyphens
- Idempotent (slug(slug(x)) === slug(x))

**Exit Code:**
- 0: All tests pass
- 1: Any test fails

**Runtime:** <5 seconds

---

### 2. `scripts/test-references.ts`

**Purpose:** Validate backlink system against Logseq docs

**Prerequisites:**
- Logseq docs synced to database
- Reference system implemented

**Test Cases:**

```typescript
// Test +1 refs (Cited By)
Page: "Tutorial"
Expected: ~15-20 pages cite it (from Logseq docs analysis)
Actual: Query DB, count distinct pages with [[Tutorial]]
Assert: Within ±2 of expected

// Test +2 refs (Related)
Page: "Queries"
Expected: Pages that cite pages that cite "Queries"
Actual: Query DB, 2-hop backlinks
Assert: Count > 0, logical

// Test reference counts
Pages to check:
- "contents" → ~50+ refs (most cited)
- "Tutorial" → ~15-20 refs
- "FAQ" → ~10-15 refs
- "Shortcuts" → ~8-12 refs

// Test context snippets
Assert: Each ref shows block content
Assert: Context <200 chars
Assert: Contains target page name

// Test empty pages
Find pages with no content
Assert: All have refs OR are journal pages
Assert: No truly empty pages
```

**Data Source:**
- Manual analysis of Logseq docs (do once, cache results)
- Alternative: Scrape live site reference counts

**Exit Code:**
- 0: All ref counts within range
- 1: Missing refs or empty pages found

**Runtime:** ~30 seconds (DB queries)

---

### 3. `scripts/test-navigation.ts`

**Purpose:** Validate navigation features

**Test Cases:**

```typescript
// Block navigation
Test: Generate page with blocks having IDs
Assert: Block IDs in HTML
Assert: Click handler exists (check HTML/JS)
Assert: Smooth scroll CSS exists

// Breadcrumbs
Test: Load "guides/getting-started/installation"
Assert: Breadcrumb HTML present
Assert: Links to "guides", "guides/getting-started"
Assert: Current page not linked

// Sidebar TOC
Test: Load page with headings
Assert: TOC generated
Assert: TOC links to heading IDs
Assert: Collapsible sections work

// Back button
Test: Visit page A → page B
Assert: Back button shows "← Back to A"
Assert: Click returns to A (check href)

// Default page
Test: Visit /{workspace}
Assert: Redirects to /contents
Fallback: If no contents, redirects to index/readme/home/first
```

**Implementation:**
- Mix of HTML parsing (jsdom) + manual checks
- Some tests require browser (future: Playwright)

**Exit Code:**
- 0: All navigation elements present
- 1: Missing elements

**Runtime:** ~20 seconds

---

### 4. `scripts/test-features.ts`

**Purpose:** Validate Logseq feature parity

**Test Cases:**

```typescript
// Page references
Test: Find [[Tutorial]] in HTML
Assert: Rendered as <a class="page-reference" href="/tutorial">
Assert: Slugified correctly

// Block references
Test: Find ((uuid)) in HTML
Assert: Rendered as <a class="block-reference" href="#block-{uuid}">
Assert: UUID shortened in display

// Hashtag links
Test: Find #tutorial in HTML
Assert: Rendered as <a class="hashtag-link" href="/tutorial">
Assert: Styled as tag

// Task markers
Test: Find TODO/DOING/DONE in HTML
Assert: Checkboxes rendered
Assert: Color classes applied
Assert: Strikethrough for DONE

// Priority badges
Test: Find [#A] [#B] [#C] in HTML
Assert: Badges rendered
Assert: Color-coded

// Block collapse
Test: Find nested blocks in HTML
Assert: ▸/▾ indicators present
Assert: Collapse handler exists
```

**Exit Code:**
- 0: All features implemented
- 1: Missing features

**Runtime:** ~10 seconds

---

## Updated Test Files

### 1. `scripts/test-phase4.sh` - Major Rewrite

**Current Issues:**
- Doesn't test slugification
- Doesn't test references
- Doesn't validate all pages accessible
- Doesn't test navigation

**New Structure:**

```bash
#!/bin/bash
set -euo pipefail

echo "╔════════════════════════════════════════╗"
echo "║  Phase 4 Issues - Automated Tests     ║"
echo "╚════════════════════════════════════════╝"

# Phase 1: Build validation (existing, keep)
echo "📦 Phase 1: Build Validation"
npm run type-check || exit 1
npm run build || exit 1

# Phase 2: Unit tests (NEW)
echo "🧪 Phase 2: Unit Tests"
tsx scripts/test-slugification.ts || exit 1
# ... more unit tests

# Phase 3: Integration tests (NEW)
echo "🔗 Phase 3: Integration Tests"
echo "⚠️  Requires: Database with Logseq docs synced"
read -p "Database ready? (y/n) " -n 1 -r
if [[ $REPLY =~ ^[Yy]$ ]]; then
  tsx scripts/test-references.ts || exit 1
  tsx scripts/test-navigation.ts || exit 1
  tsx scripts/test-features.ts || exit 1
else
  echo "⚠️  Skipping integration tests (manual run later)"
fi

# Phase 4: Content validation (existing, update)
echo "📊 Phase 4: Content Validation"
tsx scripts/validate-content.ts || exit 1
tsx scripts/compare-with-logseq.ts || exit 1

# Phase 5: File checks (existing, keep)
echo "📁 Phase 5: File Checks"
# ... existing checks

echo ""
echo "╔════════════════════════════════════════╗"
echo "║  ✅ All Automated Tests Passed        ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "Next: Manual E2E validation (5 min)"
echo "Run: ./scripts/test-e2e.sh"
```

**Changes:**
- Add unit test phase (new scripts)
- Add integration test phase (db-dependent)
- Keep existing build/file checks
- Interactive prompt for db-dependent tests
- Better output formatting
- Exit codes preserved

---

### 2. `scripts/validate-content.ts` - Additions

**Current:** Validates basic stats, task markers, priorities

**Add:**

```typescript
// Empty page detection
const emptyPages = await db.query.nodes.findMany({
  where: and(
    eq(nodes.workspaceId, workspaceId),
    eq(nodes.nodeType, 'page'),
    or(
      isNull(nodes.html),
      sql`length(${nodes.html}) < 50` // <50 chars = empty
    )
  )
});

if (emptyPages.length > 0) {
  console.log(`\n❌ Empty Pages Found: ${emptyPages.length}`);

  // Check if they have references
  for (const page of emptyPages) {
    const refs = await getReferences(page.id); // +1 refs
    if (refs.length === 0) {
      console.log(`  ⚠️  ${page.pageName} - No content AND no references`);
      errors++;
    } else {
      console.log(`  ✓ ${page.pageName} - No content but has ${refs.length} refs`);
    }
  }
}

// Reference validation
console.log('\n🔗 References:');
const totalRefs = await countAllReferences();
console.log(`✓ Total references: ${totalRefs}`);

// Expected ranges (from Logseq docs analysis)
const expectedRefs = {
  'contents': { min: 45, max: 55 },
  'Tutorial': { min: 15, max: 25 },
  'FAQ': { min: 10, max: 18 },
  'Shortcuts': { min: 8, max: 15 }
};

for (const [pageName, range] of Object.entries(expectedRefs)) {
  const count = await countReferences(pageName);
  const inRange = count >= range.min && count <= range.max;

  if (inRange) {
    console.log(`✓ ${pageName}: ${count} refs (expected ${range.min}-${range.max})`);
  } else {
    console.log(`❌ ${pageName}: ${count} refs (expected ${range.min}-${range.max})`);
    errors++;
  }
}

// Block navigation
console.log('\n🎯 Block Navigation:');
const blocksWithIds = await db.query.nodes.findMany({
  where: and(
    eq(nodes.workspaceId, workspaceId),
    eq(nodes.nodeType, 'block'),
    isNotNull(nodes.blockUuid)
  )
});

console.log(`✓ Blocks with IDs: ${blocksWithIds.length}`);

// Slugification validation
console.log('\n🔗 Slugs:');
const pagesWithSpaces = await db.query.nodes.findMany({
  where: and(
    eq(nodes.workspaceId, workspaceId),
    eq(nodes.nodeType, 'page'),
    sql`${nodes.slug} LIKE '% %'` // Contains spaces
  )
});

if (pagesWithSpaces.length > 0) {
  console.log(`❌ Pages with spaces in slug: ${pagesWithSpaces.length}`);
  errors++;
} else {
  console.log(`✓ All slugs URL-safe (no spaces)`);
}
```

**Exit Code:**
- 0: All validations pass
- 1: Empty pages without refs OR ref counts out of range OR slugs invalid

---

### 3. `scripts/compare-with-logseq.ts` - Additions

**Current:** Compares page counts, structure

**Add:**

```typescript
// Reference count comparison
console.log('\n🔗 Reference Comparison:');

const logseqRefs = {
  'contents': 50, // Manually counted from docs.logseq.com
  'Tutorial': 18,
  'FAQ': 12,
  'Shortcuts': 10
};

for (const [page, expectedCount] of Object.entries(logseqRefs)) {
  const ourCount = await countReferences(page);
  const diff = Math.abs(ourCount - expectedCount);
  const percentDiff = (diff / expectedCount) * 100;

  if (percentDiff <= 10) { // ±10% acceptable
    console.log(`✓ ${page}: ${ourCount} refs (Logseq: ${expectedCount}, ${percentDiff.toFixed(1)}% diff)`);
  } else {
    console.log(`⚠️  ${page}: ${ourCount} refs (Logseq: ${expectedCount}, ${percentDiff.toFixed(1)}% diff)`);
    warnings++;
  }
}

// Feature parity check
console.log('\n🎯 Feature Parity:');
const features = [
  { name: 'Page references', check: () => checkPageReferences() },
  { name: 'Block references', check: () => checkBlockReferences() },
  { name: 'Hashtag links', check: () => checkHashtagLinks() },
  { name: 'Task markers', check: () => checkTaskMarkers() },
  { name: 'Priority badges', check: () => checkPriorityBadges() },
  { name: 'Block collapse', check: () => checkBlockCollapse() },
  { name: 'Breadcrumbs', check: () => checkBreadcrumbs() },
  { name: 'Sidebar TOC', check: () => checkSidebarTOC() },
  { name: 'References (Cited By)', check: () => checkCitedBy() },
  { name: 'References (Related)', check: () => checkRelated() }
];

for (const feature of features) {
  const implemented = await feature.check();
  if (implemented) {
    console.log(`✓ ${feature.name}`);
  } else {
    console.log(`❌ ${feature.name} - NOT IMPLEMENTED`);
    errors++;
  }
}
```

**Exit Code:**
- 0: All features present, ref counts close
- 1: Missing features

---

### 4. `scripts/test-e2e.sh` - Minor Updates

**Current:** Automates setup, manual validation

**Add:**

```bash
# After validation
echo ""
echo "📊 Manual Validation Checklist:"
echo ""
echo "Navigation Tests:"
echo "  [ ] Visit /{workspace} → redirects to /contents"
echo "  [ ] Visit /Multi Word Page → works (no 404)"
echo "  [ ] Visit /CONTENTS vs /contents → same page"
echo "  [ ] Click block bullet → scrolls, highlights"
echo "  [ ] Click collapsed block → expands"
echo ""
echo "References Tests:"
echo "  [ ] Visit /Queries → see 'Cited By' section"
echo "  [ ] 'Cited By' open by default"
echo "  [ ] Visit empty page → see references"
echo "  [ ] 'Related' section closed by default"
echo ""
echo "Features Tests:"
echo "  [ ] Click [[page]] → navigates"
echo "  [ ] Click ((block)) → scrolls to block"
echo "  [ ] Click #hashtag → navigates to page"
echo "  [ ] See breadcrumbs on all pages"
echo "  [ ] Sidebar shows TOC"
echo "  [ ] Back button works"
echo ""
echo "If all ✓, Phase 4 fixed!"
```

---

## Test Data

### Reference Count Baseline (Logseq Docs)

**Method:** Manual analysis of https://docs.logseq.com

| Page | Cited By (+1) | Related (+2) | Notes |
|------|---------------|--------------|-------|
| contents | ~50 | ~150 | Most cited page |
| Tutorial | ~18 | ~60 | Second most cited |
| FAQ | ~12 | ~40 | Help section |
| Shortcuts | ~10 | ~35 | Utility page |
| Queries | ~15 | ~50 | Advanced feature |
| Plugins | ~8 | ~25 | Extension system |

**How to Update:**
1. Visit https://docs.logseq.com/#/page/{page}
2. Scroll to "Linked References" section
3. Count direct refs (Cited By)
4. Count indirect refs (Related) if shown
5. Update table above

**Automation (Future):**
- Scrape live site with Playwright
- Extract reference counts
- Cache as JSON
- Use in tests

---

## Test Timeline

### Phase 4.6: Core Fixes
```
Week 1:
  Day 1-2: Implement slugification + test-slugification.ts
  Day 3-4: Implement case-insensitive + update test-phase4.sh
  Day 5: Block navigation + collapse fixes
```

### Phase 4.7: References
```
Week 1-2:
  Day 1-3: Implement reference system
  Day 4: test-references.ts
  Day 5: Update validate-content.ts
```

### Phase 4.8: Features
```
Week 2:
  Day 1-2: Hashtags, sidebar, breadcrumbs
  Day 3: test-navigation.ts
  Day 4: test-features.ts
  Day 5: Update compare-with-logseq.ts
```

### Phase 4.9: Validation
```
Week 2-3:
  Day 1-2: Run all tests, fix issues
  Day 3: Manual E2E validation
  Day 4: Performance testing
  Day 5: Documentation updates
```

**Total:** 2-3 weeks

---

## CI/CD Integration (Future)

**GitHub Actions Workflow:**

```yaml
name: Phase 4 Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install deps
        run: npm ci

      - name: Type check
        run: npm run type-check

      - name: Build
        run: npm run build

      - name: Unit tests
        run: |
          tsx scripts/test-slugification.ts
          tsx scripts/test-features.ts

      # Integration tests need DB - skip in CI for now
      # Could add test DB setup later

      - name: File checks
        run: ./scripts/test-phase4.sh
```

**Deferred to:** Phase 6 (CI setup)

---

## Success Metrics

**Test Coverage:**
- [ ] 100% of critical issues have automated tests
- [ ] <3 min total test runtime
- [ ] 0 false positives (flaky tests)

**Validation:**
- [ ] Matches Logseq docs structure
- [ ] Matches Logseq docs ref counts ±10%
- [ ] Zero 404s on test graph
- [ ] Zero empty pages without refs

**Documentation:**
- [ ] All test scripts documented
- [ ] Test plan reviewed
- [ ] Manual checklist updated

---

**Status:** 📋 Planning Complete
**Next Step:** Implement test-slugification.ts (Phase 4.6)
**Dependencies:** None (tests can be written before fixes)

---

**Last Updated:** 2025-11-17
**Owner:** Engineering
