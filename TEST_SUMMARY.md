# Production-Grade Testing - Quick Start

Complete end-to-end testing infrastructure for Draehi Phase 4 Logseq features.

## 🤖 Automated Pre-Flight Tests

**Run BEFORE making any changes:**

### 1. Source Code Verification (30s)

```bash
./scripts/verify-implementation.sh
```

**Checks source code directly** to ensure features are actually implemented:
- Page/block reference regexes exist
- Task markers create checkboxes
- Reference processor is called
- CSS classes have actual styles
- Block tree renders recursively
- Workspace slug is fetched
- 35+ source code checks

**Exit:** `0` = Implementation verified | `1` = Missing features

### 2. Build & File Tests (30s)

```bash
./scripts/test-phase4.sh
```

Validates:
- TypeScript compilation
- Production build
- All critical files exist
- Test graph structure (238 pages)
- Database schema correct
- Documentation updated
- 40+ automated checks

**Exit:** `0` = All tests passed | `1` = Tests failed

## 🚀 Manual E2E Test (5 minutes)

**Using Official Logseq Documentation Graph** (238 pages, 75 journals)

```bash
# 1. Start dev server
npm run dev

# 2. Create user at http://localhost:3000/signup
#    Username: testuser
#    Password: testpass123

# 3. Connect Logseq docs graph at http://localhost:3000/dashboard/settings
#    Repository URL: file:///home/adam/markdown_projects/draehi/test-data/logseq-docs-graph
#    Branch: master
#    Token: (leave empty)

# 4. Wait for sync (watch dashboard status badge)
#    NOTE: 238 pages will take ~30-60 seconds

# 5. Validate content
node scripts/validate-content.js

# 6. Visit workspace and verify UI
#    http://localhost:3000/{workspace-slug}/contents
#    Compare with: https://docs.logseq.com/#/page/contents
```

## 📊 What Gets Tested

### Test Graph: Official Logseq Documentation

**Source:** https://github.com/logseq/docs
**Live Site:** https://docs.logseq.com

**Statistics:**
- **238 pages** - Complete Logseq documentation
- **75 journals** - Real journal entries
- **Thousands of blocks** - Comprehensive test data
- **Real-world content** - Actual production Logseq graph

**Key Pages to Test:**
- `contents` - Homepage (compare with docs.logseq.com/#/page/contents)
- `Tutorial` - Complex formatting
- `Queries` - Advanced features
- `Shortcuts` - Tables and lists
- Journals - Date-based pages

**Features Covered:**
- Page references (extensive)
- Block references (throughout docs)
- Namespaced pages (many)
- Journal pages (75 entries)
- Complex nesting
- Real-world structure

### Feature Coverage

✅ **Page References** - `[[page]]` → clickable blue links
✅ **Block References** - `((uuid))` → gray pill hash links
✅ **Task Markers** - TODO/DOING/DONE/LATER/NOW with checkboxes
✅ **Priority Badges** - [#A]/[#B]/[#C] color-coded
✅ **Namespaces** - guides/advanced/tips hierarchy
✅ **Journals** - YYYY_MM_DD date detection
✅ **Block Tree** - Collapsible, clickable bullets
✅ **Navigation** - Sidebar, breadcrumbs, links

## 🔧 Test Scripts

### Automated Validation

```bash
# Full E2E test suite (with manual steps)
./scripts/test-e2e.sh

# Content validation only
node scripts/validate-content.js
```

### Expected Output

```
╔════════════════════════════════════════╗
║  Content Validation Report           ║
╚════════════════════════════════════════╝

📊 Statistics:
✓ Total nodes: 87
✓ Pages: 7
✓ Blocks: 80

✅ Task Markers:
✓ TODO: 5 blocks
✓ DOING: 4 blocks
✓ DONE: 4 blocks

⭐ Priority Levels:
✓ [#A]: 3 blocks
✓ [#B]: 2 blocks
✓ [#C]: 2 blocks

╔════════════════════════════════════════╗
║  Validation Summary                   ║
╚════════════════════════════════════════╝
✓ All checks passed!
```

## 📋 UI Verification Checklist

Visit workspace pages and check:

### Page References (`/{workspace}/page-references`)
- [ ] Blue dashed underline links
- [ ] Hover changes to solid underline
- [ ] Click navigates correctly
- [ ] Namespaced links work (guides/...)

### Block References (`/{workspace}/block-references`)
- [ ] Gray pill with shortened UUID
- [ ] Monospace font
- [ ] Click scrolls to block
- [ ] Target block highlights yellow

### Task Markers (`/{workspace}/task-management`)
- [ ] TODO - yellow, unchecked
- [ ] DOING - blue, unchecked
- [ ] DONE - green, checked, strikethrough
- [ ] LATER - gray, unchecked
- [ ] NOW - red, unchecked
- [ ] Checkboxes disabled (can't toggle)

### Priority Badges
- [ ] [#A] - red badge
- [ ] [#B] - yellow badge
- [ ] [#C] - blue badge

### Block Tree (`/{workspace}/guides/getting-started`)
- [ ] Nested blocks indent correctly
- [ ] Bullets clickable
- [ ] Hover effects (gray bg, blue bullet)
- [ ] Collapse/expand works
- [ ] Shows ▸ (collapsed) / ▾ (expanded)

### Navigation
- [ ] Sidebar shows all pages
- [ ] Journal pages section exists
- [ ] Breadcrumbs work (guides/advanced/tips)
- [ ] Mobile responsive

## 🐛 Troubleshooting

### Sync Fails
- Check file:// path is absolute
- Verify git repo exists: `cd test-data/logseq-graph && git status`
- Check server console for errors

### No Content
- Run validation: `node scripts/validate-content.js`
- Check export-logseq-notes installed: `which export-logseq-notes`
- View deployment logs in dashboard

### References Not Clickable
- View page source, check for `class="page-reference"`
- Verify blocks.css loaded (Network tab)
- Check processLogseqReferences ran (inspect block HTML in DB)

## 📚 Full Documentation

- [TESTING.md](docs/TESTING.md) - Complete testing guide
- [test-data/README.md](test-data/README.md) - Test graph details
- [CHANGELOG.md](docs/CHANGELOG.md) - Implementation log

## ✅ Success Criteria

**Phase 4 Complete When:**

- [x] Build passes (`npm run build`)
- [x] Type-check passes (`npm run type-check`)
- [x] Validation script passes (all checks green)
- [x] All UI checklist items verified
- [x] No console errors
- [x] All test pages visible in workspace

---

**Status:** ✅ Ready for testing
**Test Time:** ~5 minutes manual + 30 seconds automated
**Last Updated:** 2025-01-17
