# Testing Guide

Complete guide for testing Draehi end-to-end with all Logseq features.

## Quick Start

### Automated Pre-Flight Test (30 seconds)

**Run BEFORE making any changes:**

```bash
./scripts/test-phase4.sh
```

Validates Phase 4 implementation without requiring a running server or database.

### Manual E2E Test (5 minutes)

```bash
# 1. Run full automated test suite
./scripts/test-e2e.sh

# Includes:
# - Content validation (database queries)
# - Logseq emulation comparison (live site comparison)
# - UI verification checklist
```

### Logseq Structure Comparison (NEW!)

**Validate database structure matches Logseq docs:**

```bash
# Requires database with synced content
npx tsx scripts/compare-with-logseq.ts
```

**What it checks:**
- ✅ Total page count matches (~917 pages)
- ✅ Non-journal page count (~695 pages)
- ✅ Journal count matches (~222 journals)
- ✅ Key pages exist (contents, Tutorial, Queries, etc.)
- ✅ Pages have meaningful content (not empty placeholders)
- ✅ Blocks have UUIDs (>90%)
- ✅ Blocks have HTML rendered (>90%)
- ✅ Block parent relationships (>80%)

**Content validation:**
- Detects empty pages (no blocks)
- Detects placeholder content (minimal text, "TODO", "coming soon")
- Validates critical pages (contents, Tutorial, FAQ) have substantial content
- Checks blocks have meaningful HTML (>50 chars per block)

**Expected:** All checks pass with 10% tolerance

## Test Data

### Test Logseq Graph

Location: `test-data/logseq-graph/`

**Pages:**
- `index.md` - Entry point with all feature links
- `Page References.md` - Tests `[[wiki-style]]` links
- `Block References.md` - Tests `((uuid))` references
- `Task Management.md` - Tests TODO/DOING/DONE/LATER/NOW markers
- `guides/getting-started.md` - Tests namespace hierarchy
- `guides/advanced/tips.md` - Tests deep namespace + mixed features
- `2025_01_15.md` - Tests journal page detection

**Features Tested:**
- ✅ Page references `[[page]]`
- ✅ Block references `((uuid))`
- ✅ Task markers (TODO, DOING, DONE, LATER, NOW)
- ✅ Priority levels ([#A], [#B], [#C])
- ✅ Namespaced pages (guides/...)
- ✅ Nested blocks (3+ levels deep)
- ✅ Journal pages (YYYY_MM_DD format)
- ✅ Block UUIDs (id:: property)

## Manual Test Flow

### 1. Environment Setup

```bash
# Ensure .env.local is configured
cp .env.example .env.local

# Set DATABASE_URL
echo "DATABASE_URL=postgresql://..." >> .env.local

# Push database schema
npm run db:push
```

### 2. Start Development Server

```bash
npm run dev
```

### 3. Create Test User

1. Visit `http://localhost:3000/signup`
2. Create user:
   - Username: `testuser`
   - Password: `testpass123`
3. Automatic workspace creation → redirects to dashboard

### 4. Connect Test Graph

1. Visit `http://localhost:3000/dashboard/settings`
2. Git Repository Connection:
   - **Repository URL**: `file:///absolute/path/to/test-data/logseq-graph`
   - **Branch**: `master`
   - **Access Token**: *(leave empty for local file://)*
3. Click **"Connect Repository"**
4. Wait for sync to complete (watch status badge)

### 5. Verify Sync Status

Dashboard should show:
- ✅ Status: **Synced** (green badge)
- ✅ Last sync timestamp
- ✅ Repository URL displayed
- ✅ Branch name correct

### 6. Content Validation (Automated)

```bash
node scripts/validate-content.js
```

**Expected Output:**
```
╔════════════════════════════════════════╗
║  Content Validation Report           ║
╚════════════════════════════════════════╝

📊 Statistics:
✓ Total nodes: 87
✓ Pages: 7
✓ Blocks: 80

📄 Expected Pages:
✓ index
✓ Page References
✓ Block References
✓ Task Management
✓ guides/getting-started
✓ guides/advanced/tips
✓ 2025_01_15

🔗 Page References:
✓ Found 15 blocks with page references

🔗 Block References:
✓ Found 8 blocks with block references

✅ Task Markers:
✓ TODO: 5 blocks
✓ DOING: 4 blocks
✓ DONE: 4 blocks
✓ LATER: 2 blocks
✓ NOW: 1 blocks

⭐ Priority Levels:
✓ [#A]: 3 blocks
✓ [#B]: 2 blocks
✓ [#C]: 2 blocks

🌳 Block Hierarchy:
✓ Blocks with parent: 75
⚠ Orphan blocks: 5

🔑 Block UUIDs:
✓ Blocks with UUID: 80
⚠ Blocks without UUID: 0

╔════════════════════════════════════════╗
║  Validation Summary                   ║
╚════════════════════════════════════════╝
✓ All checks passed!
```

## UI Testing Checklist

Visit workspace at: `http://localhost:3000/{workspace-slug}`

### Navigation Tests

- [ ] Sidebar shows all pages
- [ ] Sidebar shows journal section with date
- [ ] Clicking page in sidebar navigates correctly
- [ ] Breadcrumbs show for nested pages (guides/...)
- [ ] Breadcrumb links work
- [ ] Mobile sidebar toggle works

### Page Reference Tests

Visit: `/{workspace}/page-references`

- [ ] `[[Block References]]` renders as blue link
- [ ] `[[guides/getting-started]]` renders correctly
- [ ] `[[index]]` link works
- [ ] Hovering changes underline style (dashed → solid)
- [ ] Clicking navigates to correct page

### Block Reference Tests

Visit: `/{workspace}/block-references`

- [ ] `((uuid))` renders as gray pill with shortened UUID
- [ ] Shows format: `((67391234))`
- [ ] Monospace font applied
- [ ] Clicking scrolls to target block
- [ ] Target block highlights with yellow background
- [ ] Multiple refs on same line render correctly

### Task Marker Tests

Visit: `/{workspace}/task-management`

- [ ] **TODO** - Yellow background, unchecked box
- [ ] **DOING** - Blue background, unchecked box
- [ ] **DONE** - Green background, checked box, strikethrough
- [ ] **LATER** - Gray background, unchecked box
- [ ] **NOW** - Red background, unchecked box
- [ ] Checkboxes are disabled (cursor: not-allowed)
- [ ] Cannot toggle checkbox state

### Priority Badge Tests

Visit: `/{workspace}/task-management`

- [ ] **[#A]** - Red badge with border
- [ ] **[#B]** - Yellow badge with border
- [ ] **[#C]** - Blue badge with border
- [ ] Badges uppercase and bold
- [ ] Combined with task markers works

### Block Tree Tests

Visit: `/{workspace}/guides/getting-started`

- [ ] Nested blocks render with indentation
- [ ] Bullets show for all blocks
- [ ] Hover on block shows gray background
- [ ] Hover on bullet shows blue color + scale
- [ ] Clicking bullet with children collapses/expands
- [ ] Collapsed shows `▸`, expanded shows `▾`
- [ ] Clicking bullet without children navigates (hash link)

### Journal Page Tests

Visit: `/{workspace}/2025_01_15`

- [ ] Page title shows "Daily Journal - January 15, 2025"
- [ ] Appears in sidebar "Journal Pages" section
- [ ] Date format correct
- [ ] Mixed features work (tasks + refs)

### Deep Namespace Tests

Visit: `/{workspace}/guides/advanced/tips`

- [ ] Breadcrumbs: `guides / advanced / tips`
- [ ] All breadcrumb links work
- [ ] Sidebar shows under "guides/advanced" hierarchy
- [ ] Page references work across namespaces
- [ ] Block references work

### Dark Mode Tests

*(If browser supports prefers-color-scheme: dark)*

- [ ] Page references - blue-400 color
- [ ] Block references - gray-400 on gray-800
- [ ] Task markers - adjusted colors
- [ ] Priority badges - adjusted colors
- [ ] Block hover - gray-800 background

## Performance Tests

### Query Performance

```bash
# Check query execution times in browser DevTools
# Network tab → Filter by "Fetch/XHR"
```

**Expected:**
- Page load TTFB: < 100ms
- Sidebar data fetch: < 50ms
- Block tree render: < 200ms

### Database Indexes

```sql
-- Verify indexes exist
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'nodes';
```

**Expected Indexes:**
- `workspace_namespace_slug_idx` - O(1) page lookups
- `workspace_pagename_nodetype_idx` - Block queries
- `parent_order_idx` - Hierarchy queries
- `block_uuid_idx` - Block reference resolution

## Troubleshooting

### Sync Fails

**Symptoms:** Status shows "Error" badge

**Check:**
1. Repository URL correct (file:// path must be absolute)
2. Branch exists (check: `cd test-data/logseq-graph && git branch`)
3. View deployment logs in dashboard
4. Check server console for errors

### No Content After Sync

**Symptoms:** Empty workspace, no pages/blocks

**Debug:**
```bash
# Check database
node scripts/validate-content.js

# Check export-logseq-notes installed
which export-logseq-notes

# Manual test export
export-logseq-notes --help
```

### Page References Not Clickable

**Symptoms:** `[[page]]` shows as plain text

**Check:**
1. HTML contains `class="page-reference"` (view source)
2. CSS loaded (check Network tab for blocks.css)
3. processLogseqReferences ran (check block HTML in DB)

### Block References Not Working

**Symptoms:** `((uuid))` shows as plain text

**Check:**
1. Block has `blockUuid` in database
2. HTML contains `class="block-reference"`
3. Hash link format: `#67391234-0000-0000-0000-000000000020`

### Task Markers Not Styled

**Symptoms:** TODO shows as plain text

**Check:**
1. HTML contains `class="task-marker task-todo"`
2. blocks.css loaded
3. Checkbox rendered with `disabled` attribute

## Automated Test Suite

### Run Full Suite

```bash
./scripts/test-e2e.sh
```

**Steps:**
1. ✓ Check prerequisites (.env.local, test graph)
2. ✓ Push database schema
3. ⚠ Manual: Create user (requires browser)
4. ⚠ Manual: Connect repository (requires browser)
5. ⏳ Wait for sync completion
6. ✓ Validate content (automated)
7. ⚠ Manual: UI verification checklist

### CI/CD Integration

*(Future - Phase 6)*

```yaml
# .github/workflows/test.yml
- name: E2E Tests
  run: |
    npm run build
    npm run test:e2e
```

## Logseq Structure Comparison

### Overview

The comparison test validates that Draehi correctly imports Logseq graph structure into the database by checking against the official Logseq docs stats.

### How It Works

```
Database Query
    ↓
Count pages, blocks, journals
Check key pages exist
Validate block quality (UUIDs, HTML, hierarchy)
    ↓
Compare to expected Logseq docs stats:
  - ~917 total pages
  - ~695 non-journal pages
  - ~222 journals
  - Key pages: contents, Tutorial, FAQ, etc.
```

### Metrics Validated

1. **Total Page Count** - All pages (expected ~917)
2. **Non-Journal Pages** - Regular pages (expected ~695)
3. **Journal Count** - Date-based pages (expected ~222)
4. **Key Pages** - Important docs pages exist
5. **Block UUIDs** - >90% blocks have UUID
6. **Block HTML** - >90% blocks have rendered HTML
7. **Block Hierarchy** - >80% blocks have parent relationships

### Test Pages Checked

- **contents** - Homepage
- **Tutorial** - Getting started guide
- **Queries** - Advanced queries doc
- **Shortcuts** - Keyboard shortcuts
- **Term Portal** - Glossary
- **FAQ** - Frequently asked questions
- **Publishing (Desktop App Only)** - Publishing guide

### Tolerance

**10% difference allowed** - Some variability in parsing is acceptable.

### Running Standalone

```bash
# After syncing test graph
npx tsx scripts/compare-with-logseq.ts
```

### Expected Output

```
╔════════════════════════════════════════╗
║  Logseq Structure Comparison Test     ║
╚════════════════════════════════════════╝

Reference: https://docs.logseq.com
Testing:   Database content

📊 Database Statistics:
   Total pages: 917
   Total blocks: 12458
   Journal pages: 222
   Namespaced pages: 87

🧱 Block Quality:
   Blocks with UUID: 12458/12458
   Blocks with HTML: 12458/12458
   Blocks with parent: 11980/12458
   Sample blocks with page refs: 2/5
   Sample blocks with block refs: 1/5

📈 Expected vs Actual:
   Total pages:    Expected ~917, Got 917
   Non-journals:   Expected ~695, Got 695
   Journals:       Expected ~222, Got 222

📋 Key Pages Check:
[checks each page...]

╔════════════════════════════════════════╗
║  Summary                               ║
╚════════════════════════════════════════╝

📊 Statistics:
   ✅ Total pages: 917
   ✅ Total blocks: 12458
   ✅ Journals: 222
   ✅ Namespaced: 87

🧱 Block Quality:
   ✅ Blocks with UUID: 100.0%
   ✅ Blocks with HTML: 100.0%
   ✅ Blocks with parent: 96.2%

📄 Key Pages:
   ✅ Found: 7/7

🎉 Draehi successfully imported Logseq structure!
   All key pages present with expected counts
```

## Future Test Improvements

To achieve complete emulation of https://docs.logseq.com, we should implement:

### 1. Link Integrity Tests
- ✅ **Broken link detection**: Check all `[[page]]` references point to existing pages
- ✅ **Block reference validation**: Verify all `((uuid))` references resolve to real blocks
- ✅ **Circular reference detection**: Find any circular page references
- ✅ **External link validation**: Check external URLs are preserved (optional: verify they work)

### 2. Content Structure Tests
- ✅ **Hierarchy validation**: Verify parent-child block relationships are correct
- ✅ **Namespace integrity**: Check namespace pages (guides/advanced/tips) have correct depth
- ✅ **Journal date parsing**: Validate journal pages have correct dates (YYYY_MM_DD format)
- ✅ **Ordering validation**: Verify blocks maintain source order

### 3. Feature Preservation Tests
- ✅ **TODO markers**: Check TODO/DOING/DONE/LATER/NOW are styled correctly
- ✅ **Priority badges**: Verify [#A]/[#B]/[#C] render with correct colors
- ✅ **Tags extraction**: If supported, validate #tags are extracted
- ✅ **Properties**: Check page properties/frontmatter are preserved
- ✅ **Code blocks**: Verify syntax highlighting preserved

### 4. Visual Comparison Tests (Future)
- ⏸️ **Screenshot comparison**: Compare rendered pages vs docs.logseq.com
- ⏸️ **CSS validation**: Check styling matches Logseq appearance
- ⏸️ **Responsive design**: Test mobile/desktop layouts
- ⏸️ **Dark mode**: Verify dark mode styling

### 5. Performance Tests
- ⏸️ **Page load time**: Measure TTFB < 100ms
- ⏸️ **Query performance**: Validate DB queries < 50ms
- ⏸️ **Memory usage**: Check memory doesn't leak during sync
- ⏸️ **Large graph handling**: Test with 1000+ pages

### 6. Edge Cases
- ✅ **Empty pages**: Handle pages with no blocks gracefully
- ✅ **Special characters**: Test pages with unicode, emoji, special chars
- ✅ **Very long pages**: Pages with 1000+ blocks
- ✅ **Nested references**: `[[page with [[nested]] ref]]`
- ✅ **Malformed markdown**: Handle parse errors gracefully

### Implementation Priority

**Phase 1 (Current):**
- ✅ Page count validation
- ✅ Block quality checks
- ✅ Content validation (placeholders)

**Phase 2 (Next):**
- Link integrity (broken links, missing blocks)
- Hierarchy validation
- Feature preservation (TODOs, priorities)

**Phase 3 (Later):**
- Visual comparison tests
- Performance benchmarks
- Edge case handling

### Troubleshooting

**"Page count off by >10%"**
- Check Git sync completed
- Verify all .md files in test-data/logseq-docs-graph/pages/
- Check export-logseq-notes ran successfully

**"Missing key pages"**
- Verify page naming matches Logseq (case-sensitive)
- Check namespace calculation (guides/advanced/tips)
- Review sync logs for errors

**"Blocks missing UUIDs"**
- Check markdown parser extracts `id::` property
- Verify parseLogseqMarkdown() in modules/logseq/markdown-parser.ts
- Some blocks naturally lack UUIDs (acceptable if >90%)

**"Blocks missing HTML"**
- Check processLogseqReferences() runs after parse
- Verify marked + cheerio dependencies installed
- Review block ingestion in modules/logseq/export.ts

## Test Coverage

**Current Coverage:**

✅ **Database Layer**
- Schema migrations
- CRUD operations
- Idempotent inserts
- Cascading deletes
- Query performance

✅ **Git Integration**
- Clone repository
- Branch detection
- Sync on connect
- Error handling

✅ **Logseq Processing**
- Markdown parsing
- Block hierarchy
- UUID extraction
- Namespace calculation
- Journal detection

✅ **Reference Processing**
- Page references → links
- Block references → hash links
- Task markers → checkboxes
- Priority levels → badges

✅ **UI Rendering**
- Block tree
- Breadcrumbs
- Sidebar navigation
- Collapsible blocks
- CSS styling

**Not Yet Covered:**

⏸️ **Embeds** (Phase 5)
- Page embeds `{{embed [[page]]}}`
- Block embeds `{{embed ((uuid))}}`

⏸️ **Advanced Features** (Future)
- Search functionality
- Asset handling (images)
- Custom domains
- Multiple workspaces

## Success Criteria

**Phase 4 Complete When:**

- [x] All 7 test pages ingested
- [x] Page references render as clickable links
- [x] Block references render as hash links
- [x] Task markers render with checkboxes
- [x] Priority badges render with colors
- [x] Block tree navigable with collapse/expand
- [x] No console errors
- [x] Build passes
- [x] Type-check passes
- [x] Validation script passes

---

**Last Updated:** 2025-01-17
