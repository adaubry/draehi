# Phase 4 Critical Issues - Repair Roadmap

**Status:** 🚨 Phase 4 Broken - Multiple Critical Issues
**Created:** 2025-11-17
**Priority:** URGENT - Blocks Phase 5

---

## Overview

Phase 4 was marked complete but has critical issues preventing production use. This document tracks all issues, establishes success criteria, and defines the repair roadmap.

**Current State:**
- ❌ Many collapsible blocks not clickable/redirectable
- ❌ Blocks missing collapse functionality
- ❌ Multi-word page slugs broken (404s)
- ❌ Case-sensitive URLs (diverges from Logseq)
- ❌ Empty pages (missing reference display)
- ❌ Missing Logseq features (#hashtag links)
- ❌ No default "contents" page
- ❌ Broken sidebar structure
- ❌ No breadcrumbs

---

## Critical Issues (P0 - Blocks Production)

### Issue #1: Blocks Not Clickable/Redirectable

**Severity:** P0 - Critical
**Component:** Block rendering, navigation
**Example:** `#block-105381` on `/contents` (named "basics") - many more

**Problem:**
- Collapsible blocks exist but clicking doesn't navigate to block ID
- Expected: Click → scroll to `#block-105381` with highlight
- Actual: Click does nothing or only collapses/expands

**Root Cause:**
- Block IDs exist in HTML but no click handlers
- Missing anchor navigation logic
- Collapse/expand handler conflicts with navigation

**Success Criteria:**
- [ ] Click block bullet → navigate to `#{block-id}`
- [ ] URL updates with hash (e.g., `/contents#block-105381`)
- [ ] Target block highlights (yellow background)
- [ ] Smooth scroll to block
- [ ] Works on all collapsible blocks
- [ ] Mobile touch targets ≥ 44x44px

**Files to Fix:**
- `components/viewer/BlockTree.tsx` - Add navigation handlers
- `app/blocks.css` - Add `:target` highlight styles
- `app/[workspaceSlug]/[...path]/page.tsx` - Handle hash navigation

---

### Issue #2: Blocks Missing Collapse Functionality

**Severity:** P0 - Critical
**Component:** Block tree rendering
**Example:** `#block-105399` on `/contents` (named "new to logseq") - many more

**Problem:**
- Blocks with children don't show collapse/expand UI
- No ▸/▾ indicators
- Can't hide nested content

**Root Cause:**
- BlockTree.tsx not detecting children correctly
- Missing recursive child check
- CSS not applying to all nested blocks

**Success Criteria:**
- [ ] All blocks with children have collapse UI
- [ ] Shows ▸ when collapsed, ▾ when expanded
- [ ] Click toggles state
- [ ] Preserves state during navigation
- [ ] Works recursively (nested collapses)
- [ ] Respects depth limits

**Files to Fix:**
- `components/viewer/BlockTree.tsx` - Fix child detection
- `modules/content/queries.ts` - Ensure parent-child relationships correct
- `app/blocks.css` - Apply styles to all nested levels

---

### Issue #3: Multi-Word Page Slugs Broken (404s)

**Severity:** P0 - Critical
**Component:** Slug generation, URL routing
**Example:** Only single-word pages work, "Advanced Features" → 404

**Problem:**
- Slugs contain spaces → URL encoding issues
- Only `/single-word` pages work
- `/multi word page` → 404 Not Found
- Breaks most real-world Logseq graphs

**Root Cause:**
- Slug normalization doesn't handle spaces
- Need proper slugification (like Google URLs)
- Reference: https://thetexttool.com/blog/demystifying-slugification

**Slugification Rules (Based on industry best practices):**
1. Lowercase everything
2. Replace spaces with hyphens
3. Transliterate Unicode to ASCII (`café` → `cafe`)
4. Remove special chars (keep alphanumeric + hyphens + `/`)
5. Collapse multiple hyphens (`--` → `-`)
6. Trim leading/trailing hyphens
7. Preserve namespace separators (`/`)

**Reference:** [Demystifying Slugification](https://thetexttool.com/blog/demystifying-slugification)

**Examples:**
```
"Advanced Features" → "advanced-features"
"FAQ & Help" → "faq-help"
"Getting Started!" → "getting-started"
"guides/Quick Start" → "guides/quick-start"
"Café Guide" → "cafe-guide"
"C++ Tutorial" → "c-tutorial"
```

**Success Criteria:**
- [ ] All pages generate valid URL-safe slugs
- [ ] Multi-word pages accessible
- [ ] Namespaced pages work (`guides/quick-start`)
- [ ] Special chars handled correctly
- [ ] Case-insensitive matching
- [ ] No 404s for legitimate pages
- [ ] Links between pages work
- [ ] Breadcrumbs reflect correct slugs

**Files to Fix:**
- `modules/workspace/actions.ts` - Slugification function
- `modules/content/actions.ts` - Apply to page ingestion
- `modules/logseq/process-references.ts` - Update page link generation
- `app/[workspaceSlug]/[...path]/page.tsx` - Case-insensitive routing
- Database migration - Re-slug all existing pages

**Implementation Plan:**
1. Create `lib/slugify.ts` with Google-style slugification
2. Add tests for edge cases
3. Update content ingestion to use slugify
4. Create migration to re-slug existing pages
5. Update reference processor to slugify links
6. Test all pages accessible

---

### Issue #4: Case-Sensitive URLs

**Severity:** P0 - Critical
**Component:** URL routing, slug matching
**Example:** `/Contents` vs `/contents` - inconsistent behavior

**Problem:**
- URLs case-sensitive, Logseq docs are not
- Breaks user expectations
- Inconsistent with Logseq behavior
- Link rot (old links break)

**Logseq Behavior:**
- `#/page/Contents` = `#/page/contents` = `#/page/CONTENTS`
- Case-insensitive everywhere

**Success Criteria:**
- [ ] `/page`, `/Page`, `/PAGE` → same content
- [ ] Case-insensitive slug matching in DB query
- [ ] Canonical URL redirect (all → lowercase)
- [ ] Links normalized to lowercase
- [ ] Breadcrumbs show original case (from DB)
- [ ] SEO: canonical link tag

**Files to Fix:**
- `app/[workspaceSlug]/[...path]/page.tsx` - Lowercase params before query
- `modules/content/queries.ts` - Case-insensitive WHERE clause
- `modules/logseq/process-references.ts` - Normalize link hrefs
- Add canonical URL to metadata

---

### Issue #5: Empty Pages (Missing References Display)

**Severity:** P0 - Critical
**Component:** Page rendering, backlinks
**Example:** Many pages have no content, only exist to show references

**Problem:**
- Pages created for backlinks but show nothing
- Logseq shows references in 2 levels:
  - **+1 refs (Cited By):** Pages that directly link here - open by default
  - **+2 refs (Related):** Pages that link to pages that link here - closed by default
- We show neither → empty pages

**Logseq Reference System:**

```
Page: "Queries"

## Content
[Page's own blocks/content]

## Cited By (7 references) ▾ [OPEN BY DEFAULT]
- [[Tutorial]] (3 mentions)
  - "Use queries to find tasks"
  - "Advanced query syntax"
  - "Query examples"
- [[Shortcuts]] (2 mentions)
  - "Query shortcuts"
  - "Run query with Cmd+Enter"

## Related (12 references) ▸ [CLOSED BY DEFAULT]
- [[Contents]] → mentioned [[Tutorial]]
- [[FAQ]] → mentioned [[Tutorial]]
- [[Advanced Features]] → mentioned [[Shortcuts]]
```

**Success Criteria:**
- [ ] All pages show "+1 refs (Cited By)" section
- [ ] Collapsible, open by default
- [ ] Shows page name + mention count
- [ ] Shows context snippets (block content with ref)
- [ ] All pages show "+2 refs (Related)" section
- [ ] Collapsible, closed by default
- [ ] Shows page → intermediate → current page path
- [ ] Empty pages (no content) still show refs
- [ ] Performance: efficient backlink queries

**Architecture Decision:**
- ✅ **Compute dynamically** - No page_references table
- ✅ **Real-time queries** - Use PPR + indexes for performance
- ✅ **Show page links only** - No context snippets (simplified)

**Implementation Plan:**
1. Create backlink query functions (+1, +2)
2. Add composite indexes (workspace_id, page_name)
3. Build CitedBySection component (collapsible, open by default)
4. Build RelatedSection component (collapsible, closed by default)
5. Use PPR skeleton for loading state
6. Integrate into page layout
7. Test with Logseq docs (compare reference counts)

**Files to Create/Modify:**
- `modules/content/queries.ts` - Add `getCitedByReferences()`, `getRelatedReferences()`
- `components/viewer/CitedBySection.tsx` - +1 refs UI (page links only)
- `components/viewer/RelatedSection.tsx` - +2 refs UI (page links only)
- `app/[workspaceSlug]/[...path]/page.tsx` - Integrate ref sections
- Database migration - Add composite index on (workspace_id, page_name)

---

### Issue #6: Missing Logseq Features - #Hashtag Links

**Severity:** P0 - Critical
**Component:** Reference processing
**Example:** `#link` on `/Web` should redirect to `/link`

**Problem:**
- Logseq hashtags `#tag` create page links
- We don't process them at all
- Breaks navigation in many graphs

**Logseq Hashtag Behavior:**
```markdown
#tutorial → link to [[tutorial]] page
#multi-word → link to [[multi-word]] page
#namespace/page → link to [[namespace/page]]
```

**All Interactive Elements Needing Implementation:**

1. **#Hashtag Links** - `#word` → page link
2. **Page Embeds** - `{{embed [[page]]}}` → inline page content
3. **Block Embeds** - `{{embed ((uuid))}}` → inline block content
4. **Query Results** - `{{query ...}}` → dynamic content
5. **TODO/DONE clicking** - Toggle task state (future, requires backend)

**Success Criteria - Phase 4.6 (Hashtags):**
- [ ] `#word` → link to `/word`
- [ ] `#multi-word` → link to `/multi-word`
- [ ] `#namespace/page` → link to `/namespace/page`
- [ ] Styled as tags (rounded, background)
- [ ] Hover/click UX
- [ ] Works in all contexts (blocks, pages)

**Files to Fix:**
- `modules/logseq/process-references.ts` - Add hashtag regex
- `app/blocks.css` - Tag styling
- Add to test suite

**Future Phases:**
- Phase 4.7: Page embeds
- Phase 4.8: Block embeds
- Phase 4.9: Query results
- Phase 6+: Interactive tasks (backend required)

---

### Issue #7: No Default "Contents" Page

**Severity:** P1 - High
**Component:** Routing, default pages
**Example:** `/{workspace}` → should show `/contents`

**Problem:**
- Root workspace URL shows nothing
- Should default to "contents" page (if exists)
- Fallback to index/readme/first page

**Logseq Behavior:**
- `docs.logseq.com` → shows `#/page/contents`
- Most graphs have a "contents" or "index" page

**Design Decision:**
- ✅ **User configurable** - Set default page in repo setup
- ✅ **Fallback to "contents"** - If user choice doesn't exist
- ❌ **No complex fallback chain** - Just user choice → contents → 404

**Success Criteria:**
- [ ] `/{workspace}` → redirect to user's default page
- [ ] If default doesn't exist, fallback to `/contents`
- [ ] If "contents" doesn't exist, show 404
- [ ] Configurable in workspace settings

**Files to Fix:**
- `app/[workspaceSlug]/page.tsx` - Redirect logic
- `modules/workspace/schema.ts` - Add `defaultPage` field (default: 'contents')
- `app/(dashboard)/dashboard/settings/page.tsx` - UI to set default page
- Database migration - Add defaultPage column

---

### Issue #8: Broken Sidebar Structure

**Severity:** P1 - High
**Component:** Navigation sidebar
**Current:** Index of all pages (wrong)
**Expected:** 3-part structure

**Problem:**
- Sidebar is just a page list
- Logseq sidebar has:
  1. **Top section** - Empty (future use) - show placeholder
  2. **Back button** - Return to last visited page
  3. **Table of Contents** - Current page's headings/blocks

**Correct Structure:**

```
┌─────────────────────────┐
│ [Placeholder Area]      │ ← Empty div (graph logo? search?)
├─────────────────────────┤
│ ← Back to Tutorial      │ ← Last visited page (n-1)
├─────────────────────────┤
│ 📄 All Pages            │ ← Button to show full page index
├─────────────────────────┤
│ Table of Contents       │
│ ▾ Getting Started       │ ← Current page headings
│   • Installation        │ ← H2 heading
│   • Quick Start         │ ← H2 heading
│   • Configuration       │
└─────────────────────────┘
```

**Design Decision:**
- ✅ **4-section layout** - Placeholder, back, all pages button, TOC
- ✅ **Persist n-1 only** - Last visited page (sessionStorage)
- ✅ **"All Pages" button** - Opens modal/panel with full index
- ✅ **Client-side TOC** - Extract from rendered HTML

**Success Criteria:**
- [ ] 4-section layout as shown
- [ ] Top: Empty div with placeholder
- [ ] Section 2: Back button (shows last page, disabled if none)
- [ ] Section 3: "All Pages" button → shows modal with full index
- [ ] Bottom: Current page TOC (auto-generated)
- [ ] TOC collapsible sections
- [ ] Click TOC item → smooth scroll to heading
- [ ] Mobile: Hamburger menu, swipe gestures

**Files to Fix:**
- `components/viewer/Sidebar.tsx` - 4-section layout
- `components/viewer/TableOfContents.tsx` - Client-side TOC (extract h1-h6)
- `components/viewer/AllPagesModal.tsx` - Full page index modal
- `app/[workspaceSlug]/[...path]/layout.tsx` - Pass page data
- Use sessionStorage for back button state

---

### Issue #9: No Breadcrumbs

**Severity:** P1 - High
**Component:** Navigation
**Example:** `guides/getting-started/installation` → no breadcrumb trail

**Problem:**
- No breadcrumbs anywhere
- Can't see page hierarchy
- Can't navigate up tree

**Expected:**
```
Home / guides / getting-started / installation
[link] [link]  [link]            [current - no link]
```

**Success Criteria:**
- [ ] Breadcrumbs on all pages
- [ ] Shows full namespace path
- [ ] Links to parent pages
- [ ] Current page not linked
- [ ] Responsive (collapse on mobile)
- [ ] Styled like Vercel

**Files to Fix:**
- `components/viewer/Breadcrumbs.tsx` - Create component
- `app/[workspaceSlug]/[...path]/page.tsx` - Add to layout
- `app/blocks.css` - Breadcrumb styles

---

## Future Issues (P2 - Post-MVP)

### Issue #10: Incomplete Markdown Support

**Severity:** P2 - Medium
**Component:** Markdown rendering
**Examples:** YouTube embeds, audio, images

**Missing Features:**
- YouTube: `{{youtube https://...}}` → iframe embed
- Audio: `![audio](file.mp3)` → audio player
- Images: Optimization, lazy loading, lightbox
- Video: `{{video file.mp4}}` → video player
- Tweets: `{{tweet id}}` → Twitter embed

**Success Criteria:**
- [ ] YouTube embeds render
- [ ] Audio files playable
- [ ] Images lazy-loaded, optimized
- [ ] Video embeds work
- [ ] Tweets embedded
- [ ] Responsive media

**Deferred to:** Phase 6 - Polish & Features

---

## Success Criteria - Phase 4 Fixed

**Definition of Done:**

### Automated Tests
- [ ] All test scripts pass:
  - `npm run type-check` ✅
  - `npm run build` ✅
  - `./scripts/test-phase4.sh` ✅
  - `./scripts/verify-implementation.sh` ✅

### Manual E2E Tests (Against Logseq Docs)
- [ ] All 238 pages accessible (no 404s)
- [ ] Multi-word page URLs work
- [ ] Case-insensitive URLs work
- [ ] Collapsible blocks all work
- [ ] Block navigation works (click → scroll)
- [ ] Hashtag links work (`#tag` → `/tag`)
- [ ] Empty pages show references
- [ ] Cited By section shows correct refs
- [ ] Related section shows correct refs
- [ ] Sidebar shows TOC
- [ ] Back button works
- [ ] Breadcrumbs show on all pages
- [ ] Default page loads (`/{workspace}` → `/contents`)

### Content Validation
- [ ] `scripts/validate-content.ts` passes
- [ ] `scripts/compare-with-logseq.ts` passes
- [ ] Zero empty pages (all show content OR refs)
- [ ] Reference counts match Logseq docs ±5%

### Performance
- [ ] TTFB < 100ms (Server Components)
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Build size reasonable (<500KB JS)

---

## Repair Roadmap

### Phase 4.6: Core Fixes (Week 1)

**Goal:** Fix critical navigation & routing issues

**Tasks:**
1. **Slugification Overhaul**
   - [ ] Create `lib/slugify.ts` (Google-style)
   - [ ] Add unit tests
   - [ ] Update content ingestion
   - [ ] Database migration to re-slug
   - [ ] Update reference processor
   - [ ] Test all pages accessible

2. **Case-Insensitive URLs**
   - [ ] Lowercase params in route handler
   - [ ] Case-insensitive DB queries
   - [ ] Canonical URL redirects
   - [ ] Add canonical link tags

3. **Block Navigation**
   - [ ] Add click handlers to BlockTree
   - [ ] Implement hash navigation
   - [ ] Add `:target` highlight CSS
   - [ ] Smooth scroll to blocks

4. **Block Collapse Fix**
   - [ ] Fix child detection in BlockTree
   - [ ] Ensure ▸/▾ indicators show
   - [ ] Test recursive nesting

**Deliverable:** All pages accessible, blocks navigable/collapsible

---

### Phase 4.7: References System (Week 1-2)

**Goal:** Implement Logseq-style backlinks (dynamic computation)

**Tasks:**
1. **Database Optimization**
   - [ ] Add composite index on (workspace_id, page_name)
   - [ ] No page_references table needed (compute dynamically)

2. **Backlink Queries**
   - [ ] Create `getCitedByReferences()` - +1 refs query
   - [ ] Create `getRelatedReferences()` - +2 refs query
   - [ ] Use Server Components for rendering
   - [ ] Add PPR skeleton for loading state

3. **UI Components**
   - [ ] CitedBySection - Collapsible, open by default, page links only
   - [ ] RelatedSection - Collapsible, closed by default, page links only
   - [ ] No context snippets (simplified UX)

4. **Integration**
   - [ ] Add reference sections to page layout
   - [ ] Test with Logseq docs
   - [ ] Validate reference counts vs live site

**Deliverable:** All pages show references, no empty pages

---

### Phase 4.8: Missing Features (Week 2)

**Goal:** Hashtags, sidebar, breadcrumbs

**Tasks:**
1. **Hashtag Links**
   - [ ] Add hashtag regex to processor
   - [ ] Generate page links
   - [ ] Style as tags
   - [ ] Test in context

2. **Sidebar Rebuild (4-section layout)**
   - [ ] Section 1: Placeholder area
   - [ ] Section 2: Back button (sessionStorage n-1)
   - [ ] Section 3: "All Pages" button
   - [ ] Section 4: Table of Contents (client-side, from headings)
   - [ ] AllPagesModal component (full page index)
   - [ ] Collapsible TOC sections

3. **Breadcrumbs**
   - [ ] Create Breadcrumbs component
   - [ ] Generate from namespace
   - [ ] Add to page layout
   - [ ] Responsive design

4. **Default Page**
   - [ ] Add `defaultPage` field to workspace schema
   - [ ] Root redirect logic (user choice → contents → 404)
   - [ ] Settings UI to configure default page
   - [ ] Database migration

**Deliverable:** Complete navigation UX matching Logseq

---

### Phase 4.9: Testing & Validation (Week 2-3)

**Goal:** Ensure all fixes work end-to-end

**Tasks:**
1. **Update Test Scripts**
   - [ ] Rewrite `scripts/test-phase4.sh`
   - [ ] Add slug validation tests
   - [ ] Add reference validation tests
   - [ ] Add navigation tests

2. **Content Validation**
   - [ ] Update `validate-content.ts`
   - [ ] Check all pages accessible
   - [ ] Check references computed
   - [ ] Check no empty pages

3. **Comparison Tests**
   - [ ] Update `compare-with-logseq.ts`
   - [ ] Match page counts
   - [ ] Match reference counts
   - [ ] Match structure

4. **Documentation**
   - [ ] Update TESTING.md
   - [ ] Update CHANGELOG.md
   - [ ] Update ROADMAP.md
   - [ ] Update CLAUDE.md

**Deliverable:** Full test suite passing, docs updated

---

## Test Plan Updates

### New Test Files Needed

1. **`scripts/test-slugification.ts`**
   - Test all slug edge cases
   - Validate URL-safe output
   - Check case normalization

2. **`scripts/test-references.ts`**
   - Validate backlink queries
   - Check +1/+2 ref counts
   - Compare with Logseq

3. **`scripts/test-navigation.ts`**
   - Test block click navigation
   - Test breadcrumb generation
   - Test sidebar TOC
   - Test back button

### Updated Test Files

1. **`scripts/test-phase4.sh`**
   - Add slugification checks
   - Add reference system checks
   - Add navigation checks
   - Test all 238 pages accessible

2. **`scripts/validate-content.ts`**
   - Add empty page detection
   - Add reference validation
   - Add block navigation validation

3. **`scripts/compare-with-logseq.ts`**
   - Add reference count comparison
   - Add feature parity checks

---

## Design Decisions ✅

All open questions resolved. Implementation can proceed.

### Slugification Strategy

**Reference:** [Demystifying Slugification](https://thetexttool.com/blog/demystifying-slugification)

**Rules:**
1. **Lowercase everything** - Avoid routing issues on case-sensitive systems
2. **Hyphens as separators** - Replace spaces with `-`, avoid underscores
3. **Transliterate Unicode to ASCII** - Better portability (`café` → `cafe`)
4. **Remove special chars** - Keep only alphanumeric + hyphens
5. **Collapse multiple hyphens** - `--` → `-`
6. **Trim edge hyphens** - No leading/trailing `-`
7. **Preserve namespace separators** - Keep `/` for folder structure

**Examples:**
```
"Advanced Features" → "advanced-features"
"FAQ & Help" → "faq-help"
"What's Next?" → "whats-next"
"guides/Getting Started" → "guides/getting-started"
"Café Guide" → "cafe-guide"
"C++ Tutorial" → "c-tutorial"
```

**Implementation:**
- No length limit initially (add 60-80 char limit if needed)
- Remove common stopwords only if they don't damage meaning
- Treat slugs as permanent (add redirects if changes needed)
- CI guardrails: Block spaces, uppercase, stray punctuation

**Files:**
- `lib/slugify.ts` - Core slugification function
- `lib/slugify.test.ts` - Edge case tests
- Migration to re-slug all existing pages

---

### References System

**Architecture:**
- ✅ **Compute dynamically** - No page_references table
- ✅ **Real-time queries** - No caching (rely on PPR + indexes)
- ✅ **Show page link only** - No context snippets (simplified UX)

**Implementation:**
```typescript
// Query +1 refs (Cited By)
SELECT DISTINCT page_name
FROM nodes
WHERE html LIKE '%[[Target Page]]%'
  AND workspace_id = ?

// Query +2 refs (Related)
SELECT DISTINCT n2.page_name
FROM nodes n1
JOIN nodes n2 ON n2.html LIKE '%[[' || n1.page_name || ']]%'
WHERE n1.html LIKE '%[[Target Page]]%'
  AND n1.workspace_id = ? AND n2.workspace_id = ?
```

**UI:**
- CitedBySection: Collapsible, open by default, just page links
- RelatedSection: Collapsible, closed by default, just page links
- Use PPR skeleton for loading state

**Performance:**
- Composite indexes on (workspace_id, page_name)
- No pagination (acceptable for Logseq graph sizes)
- Server Component rendering

---

### Sidebar Structure

**Layout:**
```
┌─────────────────────────┐
│ [Placeholder Area]      │ ← Empty div (graph logo? search?)
├─────────────────────────┤
│ ← Back to Tutorial      │ ← Last visited page (n-1)
├─────────────────────────┤
│ 📄 All Pages            │ ← Button to show all pages
├─────────────────────────┤
│ Table of Contents       │ ← Current page TOC
│ ▾ Getting Started       │
│   • Installation        │
│   • Quick Start         │
└─────────────────────────┘
```

**Decisions:**
- ✅ **Persist n-1 only** - Just last visited page (session storage)
- ✅ **"All Pages" button** - Shows modal/panel with old sidebar index
- ✅ **TOC by default** - Sidebar shows current page TOC, not index
- ✅ **Client-side TOC** - Extract headings from rendered HTML

**Implementation:**
- `components/viewer/Sidebar.tsx` - 4-section layout
- `components/viewer/AllPagesModal.tsx` - Full page index
- `components/viewer/TableOfContents.tsx` - Auto-generated from headings
- Use sessionStorage for back button state

---

### Default Page

**Decisions:**
- ✅ **User configurable** - Set in repo setup/settings
- ✅ **Fallback to "contents"** - If user choice doesn't exist
- ❌ **No complex fallback chain** - Just user choice → contents → 404

**Implementation:**
```typescript
// app/[workspaceSlug]/page.tsx
const defaultPage = workspace.defaultPage || 'contents';
redirect(`/${workspaceSlug}/${defaultPage}`);
```

**Database:**
- Add `defaultPage` field to workspaces table
- Default value: `'contents'`
- UI in repo setup: "Default homepage" input

---

### Performance Strategy

**Decisions:**
- ✅ **No pagination** - Logseq graphs small enough (<1000 pages)
- ✅ **Client-side TOC** - Extract from DOM, no server processing
- ✅ **Server Components** - References computed server-side
- ✅ **PPR skeletons** - Loading states for dynamic content

**Optimizations:**
- Composite indexes: `(workspace_id, page_name)`, `(workspace_id, slug)`
- React cache() for request deduplication
- "use cache" for static queries
- No N+1 queries (batch fetches)

---

**Status:** ✅ Decisions Finalized - Implementation Starting
**Estimated Time:** 2-3 weeks
**Next Step:** Start Phase 4.6 - Slugification

---

**Last Updated:** 2025-11-17
**Owner:** Engineering
**Blocker for:** Phase 5 - Deployment Pipeline
