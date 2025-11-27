# Implementation Plan: Graph Traversal & Page Rendering

## Objective
Enable users to view Logseq graphs on the web:
- Pages display with their full block hierarchy (tree structure)
- Blocks display with pre-rendered HTML content
- Navigation works through sidebar and breadcrumbs
- All 313+ pages are queryable and displayable

## Current Situation (What Doesn't Work)

### Symptoms
1. Pages like `/contents` return data but `/handbook` returns 404
2. Graph traversal queries (`<-parent AS children`) return empty results
3. HTML content stored in KeyDB (6145 blocks) is not being retrieved for display
4. RELATE edge creation fails with: `Found record which is not a relation, but expected a NORMAL`

### Root Causes (Suspected)
1. **Parent field issue** - Parent field may not be compatible with RELATE graph syntax
2. **RELATE table misconfigured** - Table stores regular records instead of graph edges
3. **Ingestion incomplete** - Only 1 page ingested when 313+ should exist
4. **Tree building broken** - buildTreeWithGraphTraversal relies on RELATE, which doesn't work

## Goal
Users can visit `/adamaubrypro/contents` and see:
- Page title and content
- Full tree of blocks in the page
- Each block displays pre-rendered HTML
- Can navigate to other pages via sidebar

## Prerequisites (What Must Be True)

### P1: Data Structure
- ✅ Nodes table exists with page_name, slug, parent, etc.
- ❓ Parent field contains valid RecordId objects pointing to parent nodes
- ❓ For pages: parent = NULL
- ❓ For blocks: parent = RecordId of containing page/block

### P2: Graph Relationship
- ❓ Can we query children via: `SELECT id FROM nodes WHERE parent = $pageId`?
- ❓ Can we do graph traversal: `SELECT <-parent AS children FROM node_id`?
- ❓ RELATE edges exist and are queryable (if using RELATE approach)

### P3: HTML Storage
- ✅ KeyDB has 6145 block HTMLs stored
- ❓ Can we retrieve HTML by UUID: `getBlockHTMLBatch(workspace, [uuid1, uuid2, ...])`?
- ❓ UUID format matches between nodes table and KeyDB keys?

### P4: Ingestion
- ❓ All pages from Logseq graph are ingested into nodes table?
- ❓ Block hierarchy is correct (parent field properly set)?
- ❓ HTML is cached in KeyDB with correct UUIDs?

## Testing Strategy

### Phase 1: Validate Data Structure (P1)
**Test:** `scripts/diagnose-relate-issue.ts`
- DIAGNOSTIC 1: Check parent table definition
- DIAGNOSTIC 3: Inspect actual parent field values
- DIAGNOSTIC 6: Count pages vs blocks

**Expected Results:**
- Parent field contains RecordId objects (not strings)
- We have ~300 pages and many blocks

**Decision Point:**
- If parent field is correct → Move to P2
- If parent field is wrong → Fix ingestion

---

### Phase 2: Validate Graph Relationships (P2)
**Test:** `scripts/diagnose-relate-issue.ts`
- DIAGNOSTIC 2: Try simple RELATE creation
- DIAGNOSTIC 4: Check if any RELATE edges exist
- DIAGNOSTIC 5: Try graph traversal query

**Expected Results (Option A - Use Parent Field Directly):**
```
WHERE parent = $pageId works fine
<-parent returns empty (no RELATE edges)
We don't need RELATE at all
```

**Expected Results (Option B - Use RELATE):**
```
RELATE creation succeeds
RELATE edges are queryable
<-parent AS children returns proper children
```

**Decision Point:**
- If Option A (parent field direct) → Remove RELATE code from actions.ts
- If Option B (RELATE works) → Fix RELATE syntax in actions.ts
- If neither works → Investigate SurrealDB version/config

---

### Phase 3: Validate HTML Storage (P3)
**Test:** `scripts/test-keydb.ts` + new validation
- Check if getBlockHTMLBatch returns HTML for known UUIDs
- Compare UUID format between nodes table and KeyDB

**Expected Results:**
- Can retrieve HTML for blocks: `getBlockHTMLBatch(workspace, ['uuid1', 'uuid2'])`
- UUID format is consistent

**Decision Point:**
- If working → Move to P4
- If failing → Debug UUID extraction/storage

---

### Phase 4: Validate Ingestion (P4)
**Test:** `scripts/test-full-ingestion-flow.ts`
- Count nodes before/after ingestion
- Verify parent field is populated correctly
- Verify HTML is in KeyDB

**Expected Results:**
- 300+ pages ingested (not just 1)
- Parent field populated for blocks
- HTML cached for all blocks

**Decision Point:**
- If working → All prerequisites met, proceed to implementation
- If failing → Fix ingestion pipeline

---

## Implementation (After Prerequisites Met)

### If Prerequisites Pass

**Step 1: Fix/Remove RELATE**
- Location: `modules/content/actions.ts` lines 432-450
- Action: Either use RELATE syntax that works, or remove RELATE code entirely
- Outcome: Ingestion completes without RELATE errors

**Step 2: Fix Tree Building**
- Location: `modules/content/queries.ts` buildTreeWithGraphTraversal
- Action: Use validated graph traversal query from P2
- Outcome: Can build page trees with blocks

**Step 3: Fix HTML Retrieval**
- Location: `modules/content/queries.ts` getPageTreeWithHTML
- Action: Use validated getBlockHTMLBatch from P3
- Outcome: Each block has html field populated

**Step 4: Fix Ingestion Scope**
- Location: `modules/content/actions.ts` ingestLogseqGraph
- Action: Ensure all pages are ingested (not just 1)
- Outcome: All 300+ pages available

### Critical: No Implementation Until Prerequisites Pass

This prevents:
- Silent failures in production
- Debugging in the wrong place
- Wasted implementation effort

---

## Test Execution Order

```
1. Run diagnose-relate-issue.ts
   ↓
2. Analyze output
   ↓
3. Modify tests based on findings
   ↓
4. Iterate until P1 + P2 pass
   ↓
5. Run test-keydb validation
   ↓
6. Run test-full-ingestion-flow.ts
   ↓
7. Once all 4 phases pass → Implement fixes
```

---

## Success Criteria

### After Implementation
✅ Can visit `/adamaubrypro/contents`
✅ Page displays title and breadcrumbs
✅ Full block tree visible with proper hierarchy
✅ Each block shows pre-rendered HTML
✅ Can navigate to other pages via sidebar
✅ All 313+ pages are accessible

### During Testing (Prerequisites)
✅ P1: Parent field structure is correct
✅ P2: Graph relationships are queryable
✅ P3: HTML retrieval works
✅ P4: Ingestion captures all pages

---

## Rollback Plan

If tests reveal we're using the wrong approach:
1. Stop implementation immediately
2. Revert any changes to actions.ts/queries.ts
3. Update tests to explore alternative approaches
4. Document findings in RELATE_DIAGNOSTICS.md

No code changes until tests pass!
