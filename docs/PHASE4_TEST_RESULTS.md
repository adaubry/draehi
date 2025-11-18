# Phase 4 Critical Issues - Test Results Baseline

**Date:** 2025-11-18
**Purpose:** Document current state of Phase 4 issues before iteration

---

## Test Environment

- **Workspace:** test
- **Data:** Logseq docs graph (238 pages, 75 journals)
- **Server:** Next.js dev (localhost:3000)
- **Database:** PostgreSQL with ingested content (234/238 pages, 6111 blocks)

---

## Summary

| Issue # | Issue Name | Status | Priority |
|---------|-----------|---------|----------|
| #1 | Block Navigation | ❌ FAILING | P0 |
| #2 | Block Collapse | ❌ FAILING | P0 |
| #3 | Multi-Word Slugs | ✅ WORKING | P0 |
| #4 | Case-Sensitive URLs | ✅ WORKING | P0 |
| #5 | Empty Pages / References | ❌ FAILING | P0 |
| #6 | Hashtag Links | ❌ FAILING | P0 |
| #7 | Default Page | ✅ WORKING | P1 |
| #8 | Sidebar Structure | ⚠️  PARTIAL | P1 |
| #9 | Breadcrumbs | ❌ FAILING | P1 |

**Results:**
- ✅ **3 working** (33%)
- ⚠️  **1 partial** (11%)
- ❌ **5 failing** (56%)

---

## Detailed Results

### Issue #1: Block Navigation ❌ FAILING

**Problem:** Blocks not clickable/redirectable with hash links

**Test Results:**
- ❌ **FAIL:** Block IDs missing
  - Expected: `<div id="block-12345">`
  - Actual: No `id="block-"` attributes found
- ❌ **FAIL:** Bullet elements missing
  - Expected: Elements with 'bullet' class
  - Actual: No bullet classes found
- ⚠️  **WARNING:** Target CSS missing
  - Expected: `:target` pseudo-class CSS
  - Actual: Not found in blocks.css

**Impact:** Users cannot navigate to specific blocks via #hash URLs

**Fix Required:**
1. Add `id="block-{blockUuid}"` to block divs
2. Add clickable bullet elements
3. Add `:target { background: yellow; }` CSS

---

### Issue #2: Block Collapse ❌ FAILING

**Problem:** Blocks missing collapse/expand functionality

**Test Results:**
- ❌ **FAIL:** Collapse indicators missing
  - Expected: ▸/▾ symbols
  - Actual: No indicators found in HTML
- ⚠️  **WARNING:** Collapse state attributes missing
  - Expected: `data-collapsed` or `aria-expanded`
  - Actual: Not found

**Impact:** Cannot collapse/expand nested blocks

**Fix Required:**
1. Add ▸/▾ indicators to blocks with children
2. Add state management attributes
3. Implement click handlers for toggle

---

### Issue #3: Multi-Word Slugs ✅ WORKING

**Problem:** Multi-word page slugs causing 404s

**Test Results:**
- ✅ **PASS:** Single-word pages work (HTTP 200)
- ✅ **PASS:** Multi-word pages work (3/3)
  - `/advanced-queries` → HTTP 200
  - `/built-in-properties` → HTTP 200
  - `/all-pages` → HTTP 200

**Status:** This issue appears to be RESOLVED

**Note:** Slugs are using hyphens correctly. May have been fixed during backend work.

---

### Issue #4: Case-Sensitive URLs ✅ WORKING

**Problem:** URLs case-sensitive (should be case-insensitive like Logseq)

**Test Results:**
- ✅ **PASS:** `/contents` → HTTP 200
- ✅ **PASS:** `/Contents` → HTTP 200
- ✅ **PASS:** `/CONTENTS` → HTTP 200

**Status:** URLs are case-insensitive as expected

**Note:** This issue appears to be RESOLVED

---

### Issue #5: Empty Pages / References ❌ FAILING

**Problem:** Pages show nothing instead of backlinks/references

**Test Results:**
- ❌ **FAIL:** "Cited By" section missing
  - Expected: Section showing +1 refs (pages that link here)
  - Actual: No reference section found
- ⚠️  **WARNING:** "Related" section missing
  - Expected: Section showing +2 refs (pages 2 hops away)
  - Actual: Not found
- ✅ **PASS:** No "No blocks yet" message
  - Pages that have content don't show error

**Impact:** Empty pages show blank instead of useful backlinks

**Fix Required:**
1. Implement `getCitedByReferences()` query
2. Implement `getRelatedReferences()` query
3. Create `CitedBySection.tsx` component
4. Create `RelatedSection.tsx` component
5. Add to page layout

---

### Issue #6: Hashtag Links ❌ FAILING

**Problem:** #hashtags not converted to page links

**Test Results:**
- ❌ **FAIL:** Hashtag links missing
  - Expected: `<a class="hashtag-link" href="/page">#tag</a>`
  - Actual: No hashtag classes found
- ⚠️  **WARNING:** Hashtag CSS missing
  - Expected: CSS for hashtag styling
  - Actual: Not in blocks.css

**Impact:** #tags show as plain text, not clickable

**Fix Required:**
1. Add hashtag regex to `process-references.ts`
2. Generate links: `#word` → `/word`
3. Add hashtag CSS styling

---

### Issue #7: Default Page ✅ WORKING

**Problem:** Root workspace URL shows nothing

**Test Results:**
- ✅ **PASS:** `/{workspace}` → HTTP 200

**Status:** Root URL works and loads content

**Note:** May be redirecting to contents or showing index. Working as expected.

---

### Issue #8: Sidebar Structure ⚠️  PARTIAL

**Problem:** Sidebar shows page index instead of TOC

**Test Results:**
- ✅ **PASS:** Back button found
  - Found "back" or "←" in HTML
- ❌ **FAIL:** "All Pages" button missing
  - Expected: Button to show full page index modal
  - Actual: Not found
- ⚠️  **WARNING:** Table of Contents not found
  - Expected: Current page headings
  - Actual: No TOC detected

**Impact:** Sidebar may show full page list instead of current page TOC

**Fix Required:**
1. Add "All Pages" button
2. Implement TableOfContents component (extract h1-h6)
3. Replace page index with TOC in sidebar

---

### Issue #9: Breadcrumbs ❌ FAILING

**Problem:** No breadcrumb navigation

**Test Results:**
- ❌ **FAIL:** Breadcrumbs missing
  - Expected: `<nav aria-label="Breadcrumb">` or breadcrumb class
  - Actual: Not found

**Impact:** Users can't see page hierarchy or navigate up tree

**Fix Required:**
1. Create `Breadcrumbs.tsx` component
2. Generate from namespace path
3. Add to page layout
4. Style with separators (/)

---

## Priorities for Iteration

### Phase 4.6: Core Fixes (Week 1)

**P0 Issues - Must Fix:**
1. ❌ Issue #1: Block Navigation
2. ❌ Issue #2: Block Collapse
3. ❌ Issue #5: Empty Pages / References
4. ❌ Issue #6: Hashtag Links

**P1 Issues - Should Fix:**
5. ❌ Issue #9: Breadcrumbs
6. ⚠️  Issue #8: Sidebar Structure (TOC + All Pages button)

**Already Working:**
- ✅ Issue #3: Multi-Word Slugs (no action needed)
- ✅ Issue #4: Case-Sensitive URLs (no action needed)
- ✅ Issue #7: Default Page (no action needed)

---

## Next Iteration Plan

### Iteration 1: Block Navigation + Collapse

**Goal:** Make blocks clickable and collapsible

**Tasks:**
1. Add block IDs to BlockTree component
2. Add bullet click handlers
3. Add ▸/▾ indicators
4. Add collapse state management
5. Add `:target` CSS for highlighting
6. Test on /contents page

**Success Criteria:**
- Click block → scroll to block with highlight
- Click ▸ → expand nested blocks
- Click ▾ → collapse nested blocks

**Estimated Time:** 4-6 hours

---

### Iteration 2: References System

**Goal:** Show backlinks on all pages

**Tasks:**
1. Create `getCitedByReferences()` query (+1 refs)
2. Create `getRelatedReferences()` query (+2 refs)
3. Build `CitedBySection` component
4. Build `RelatedSection` component
5. Add to page layout
6. Test on pages with/without content

**Success Criteria:**
- All pages show "Cited By" section
- Pages with 0 content show references
- Reference counts match Logseq docs ±10%

**Estimated Time:** 8-12 hours

---

### Iteration 3: Hashtags + Navigation

**Goal:** Complete navigation features

**Tasks:**
1. Add hashtag regex to reference processor
2. Generate hashtag links
3. Add hashtag CSS
4. Create Breadcrumbs component
5. Add "All Pages" button to sidebar
6. Test navigation flow

**Success Criteria:**
- #tags are clickable links
- Breadcrumbs show on all pages
- "All Pages" opens modal with index

**Estimated Time:** 6-8 hours

---

## Test Script Location

**Baseline Test Script:** `scripts/test-frontend-phase4-issues.sh`

**Usage:**
```bash
# Start dev server
npm run dev

# Run tests (in new terminal)
./scripts/test-frontend-phase4-issues.sh
```

**Note:** Current script has bash issues with `set -euo pipefail` and empty echo.
Manual testing works fine. Script needs debugging before automation.

---

## Conclusion

**Current State:**
- 3/9 issues working (33%)
- 5/9 issues need fixes (56%)
- 1/9 partial (11%)

**Good News:**
- Slugification is working (Issue #3)
- Case-insensitive routing working (Issue #4)
- Default page working (Issue #7)
- Backend data is solid (234/238 pages, 6111 blocks)

**Blockers:**
- Block navigation completely broken (P0)
- No reference system (P0)
- No hashtag links (P0)

**Estimated Time to Fix:** 2-3 weeks per original roadmap

**Recommendation:** Start with Iteration 1 (Block Navigation + Collapse) as it's the most visible issue and blocks user navigation.

---

**Last Updated:** 2025-11-18
**Tested By:** Claude Code
**Next Review:** After Iteration 1 completion
