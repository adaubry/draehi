# Node Architecture Revamp - Remaining Issues & Implementation Plan

## Current Status

The revamp architecture is **partially implemented** but has critical gaps preventing pages from rendering their blocks. The foundation is solid but execution has 3 major issues.

---

## Critical Issues Discovered

### **Issue 1: getPageTree() Graph Query Failing** 🔴 CRITICAL
**What's happening:**
```
Server [Display] getPageTree: Building tree for page nodes:⟨uuid⟩
Server [Display] getPageTree: Page node not found: nodes:⟨uuid⟩
```

**Root Cause:** The `selectOne()` function is failing to retrieve page nodes by UUID, even though they exist in the database.

**Why This Matters:**
- Without getPageTree() working, pages cannot render their block hierarchy
- This is the core query for the entire revamp
- Graph traversal depends on starting from a valid page node

**File Affected:** `modules/content/queries.ts` lines 161-199

---

### **Issue 2: TOC API Not Fetching HTML** 🔴 CRITICAL
**What's happening:**
```
[Display] TOC: Blocks fetched: 73
[Display] TOC: Total HTML length: 0
[Display] TOC: Blocks with HTML: 0
[Display] TOC: Headings extracted: 0
```

**Root Cause:** The `/api/toc` route calls `getAllBlocksForPage()` (structure only) instead of `getAllBlocksForPageWithHTML()` (with HTML).

**Why This Matters:**
- Page headings (TOC) cannot be extracted without HTML
- TableOfContents component receives nodes without `html` field
- The HTML is in KeyDB but never fetched

**Files Affected:**
- `app/api/toc/route.ts` line 34
- `components/viewer/TableOfContents.tsx` lines 183-186

---

### **Issue 3: Node Metadata Empty** 🟡 MAJOR
**What's happening:**
- Database shows nodes with empty `metadata` field
- TableOfContents and other features need metadata to extract properties

**Root Cause:** Ingestion doesn't populate metadata with:
- Block properties (tags, created-at, etc.)
- Reference list
- Frontmatter
- Heading markers

**Why This Matters:**
- TOC extracts headings from HTML, but metadata should store them structured
- Tags/properties not available for display
- No way to query nodes by tag or property

**Files Affected:**
- `modules/content/actions.ts` (lines 301-313 create blocks but don't populate metadata)
- `modules/logseq/markdown-parser.ts` (extracts properties but doesn't structure them)

---

## Implementation Plan

### **Phase 1: Fix getPageTree() - Graph Traversal (DFS/BFS Approach)** (PRIORITY 1)
**Goal:** Implement efficient O(V + E) graph traversal for complete tree construction

**Problem Analysis:**
- Current query tries `<-parent AS children` in single query (may not work with SurrealDB)
- Root cause: selectOne() fails or graph traversal syntax incompatible
- Need: Recursive tree building via multiple queries (DFS/BFS pattern)

**Implementation Strategy (DFS - Depth First Search):**
```
1. Fetch page node by UUID (start node)
2. Recursively fetch children: SELECT * FROM nodes WHERE parent = $nodeId ORDER BY order
3. For each child, recursively call step 2
4. Build tree structure as we traverse back up
```

Time complexity: O(V + E) where V = all nodes, E = parent-child relationships

**Steps:**
1. **Fix selectOne() call**
   - The page node exists but selectOne() returns null
   - First: Debug why selectOne() fails for valid UUID
   - Check if nodes table has correct record ID format: `nodes:{uuid}`
   - Add logging to selectOne() to see actual SDK response

2. **Implement recursive tree builder**
   - Create helper function `buildTreeRecursively(nodeId, workspaceId): Promise<TreeNode>`
   - Fetch node: `SELECT * FROM nodes WHERE id = $nodeId`
   - Fetch children: `SELECT * FROM nodes WHERE parent = $nodeId ORDER BY order`
   - Recursively call for each child
   - Combine into tree structure

3. **Optimize with parallel fetch**
   - After getting children list, fetch ALL children in parallel: `Promise.all(children.map(...))`
   - Reduces round-trips from N sequential to ~log(N) parallel levels

4. **Test with real data**
   - Load `/contents` page
   - Should see: `[Display] getPageTree: Tree built with X total nodes`

**Files to modify:**
- `modules/content/queries.ts` - Rewrite getPageTree() with recursive helper
- Debug `lib/surreal.ts` selectOne() if needed

**Success criteria:**
- Tree built successfully with all children
- Log shows: `Tree built with X total nodes` (should be 73 for contents page)
- No "Page node not found" error

---

### **Phase 2: Fix TOC API - Fetch HTML from KeyDB** (PRIORITY 1)
**Goal:** Make `/api/toc` fetch and return block HTML

**Steps:**
1. **Update API route**
   - Change line 34: `getAllBlocksForPage()` → `getAllBlocksForPageWithHTML()`
   - This already exists and batch-fetches from KeyDB
   - Return `html` field in the response

2. **Fix TableOfContents component**
   - Component already expects `html` field (line 183: `b.html`)
   - Once API returns HTML, TOC extraction will work automatically
   - Headings will be extracted from `<h1><h2><h3>` tags

3. **Test TOC extraction**
   - Verify that blocks with HTML produce extracted headings
   - Confirm TOC renders in the page sidebar

**Files to modify:**
- `app/api/toc/route.ts` line 34 and response structure

**Success criteria:**
- `[Display] TOC: Blocks with HTML: 73` (was 0)
- `[Display] TOC: Headings extracted: X` (was 0)
- TOC renders in page view

---

### **Phase 3: Populate Node Metadata** (PRIORITY 2)
**Goal:** Populate `metadata` field during ingestion with structured data

**Steps:**
1. **Define metadata structure** (TYPE: options<object>)
   - Extract headings from HTML (if available)
   - Extract properties from block properties (created-at, tags, etc.)
   - Extract references from content (processed [[links]] and ((embeds)))
   - Store frontmatter if present

2. **Update ingestion logic**
   - After HTML rendering, extract headings: `/<h[1-3].*?>(.*?)<\/h[1-3]>/g`
   - Merge Logseq properties from `block.properties`
   - Extract references from `processLogseqReferences()` output
   - Populate `metadata` object in node creation (currently lines 310-312)

3. **Test metadata population**
   - Verify nodes have populated metadata in database
   - Confirm metadata is accessible in queries

**Files to modify:**
- `modules/content/actions.ts` - Populate metadata during block creation
- `modules/logseq/process-references.ts` - Return reference list for metadata
- May need new utility to extract headings from HTML

**Success criteria:**
- Database shows nodes with non-empty `metadata` containing headings, properties, refs
- Metadata accessible via queries

---

### **Phase 4: Fix Sidebar Over-fetching** (PRIORITY 3)
**Goal:** Only fetch page nodes for sidebar, not blocks

**Current state:**
- `getAllNodes()` query correctly filters `parent IS NONE`
- But sidebar receives 313 nodes and filters client-side
- This suggests 313 includes blocks despite server-side filtering

**Steps:**
1. **Verify getAllNodes() filtering**
   - Test query manually: `SELECT * FROM nodes WHERE parent IS NONE`
   - Count should match page count, not include blocks

2. **Remove redundant filtering**
   - Sidebar should trust server-provided nodes are all pages
   - Remove `const pageNodes = nodes.filter((n) => n.parentUuid === null)` if getAllNodes() is correct

3. **Optimize sidebar tree building**
   - Currently rebuilds tree from flat page list
   - If pages are already all root nodes, just render them

**Files to modify:**
- `components/viewer/Sidebar.tsx` - Remove redundant filtering or fix getAllNodes()

**Success criteria:**
- Sidebar receives only page nodes (313)
- No filtering needed on client side

---

## Execution Order

### **Must Fix First (Blocks Pages):**
1. **getPageTree()** - Without this, pages can't show blocks
2. **TOC API HTML** - Without this, no headings/content displayed

### **Should Fix Next (Polish):**
3. **Node metadata** - Needed for features like tags, properties search
4. **Sidebar efficiency** - Optimization, not critical

---

## Questions Needing Clarification

1. **For getPageTree() debugging:**
   - Should we use iterative tree-building as fallback if graph queries don't work?
   - Do you want me to add verbose logging to debug selectOne()?

2. **For metadata population:**
   - What structure should metadata have? (simple object with heading array + properties + references?)
   - Should we extract headings from HTML or treat markdown as source of truth?
   - Do we need to store original Logseq properties separately from extracted ones?

3. **For overall approach:**
   - Should we fix these in priority order (1→4) or tackle blockers first then parallelized work?
   - Are there other issues you've noticed that should go in this plan?

---

## Summary Table

| Phase | Issue | Priority | Time Est. | Files |
|-------|-------|----------|-----------|-------|
| 1 | getPageTree() failing | P1 🔴 | 1-2h | queries.ts, surreal.ts |
| 2 | TOC missing HTML | P1 🔴 | 30m | route.ts, queries.ts |
| 3 | Metadata empty | P2 🟡 | 1h | actions.ts, process-references.ts |
| 4 | Sidebar inefficient | P3 🟢 | 30m | Sidebar.tsx |

**Total estimated effort:** 3-4 hours for all phases
