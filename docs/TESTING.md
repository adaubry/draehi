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
# 1. Run automated test suite
./scripts/test-e2e.sh

# 2. Validate content after sync
node scripts/validate-content.js
```

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
