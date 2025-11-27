# Node Architecture Revamp - Failure Scenarios

## Overview

This document identifies all possible ways the revamp could fail, organized by severity and category. Each scenario includes:
- Root cause
- Detection method
- Prevention strategy
- Recovery procedure

---

## CRITICAL SCENARIOS (Will Break Everything)

### 1. Parent FK Constraint Violations

**Scenario**: Inserting a node with `parent` pointing to non-existent parent node

**Why It Happens**:
```typescript
// If we insert parent AFTER child (wrong order)
await createNode(childNode);      // parent doesn't exist yet
await createNode(parentNode);     // too late
```

**Detection**:
```
Error: Foreign key constraint violation
  parent = nodes:uuid-that-doesnt-exist
```

**Prevention**:
- [ ] Insert nodes in **bottom-up order** (children before parents)
- [ ] OR use **deferred constraints** in SurrealDB (if supported)
- [ ] Validate all parent UUIDs exist before batch insert

**Recovery**:
```sql
-- Find orphaned nodes
SELECT * FROM nodes WHERE parent NOT IN (SELECT id FROM nodes);

-- Delete orphans if intentional
DELETE FROM nodes WHERE parent NOT IN (SELECT id FROM nodes);
```

**Code Protection**:
```typescript
// Validate before insert
const parentIds = new Set(allNodeData.map(n => n.data.parent).filter(Boolean));
const nodeIds = new Set(allNodeData.map(n => n.uuid));

for (const parentId of parentIds) {
  if (!nodeIds.has(parentId)) {
    throw new Error(`Missing parent node: ${parentId}`);
  }
}
```

---

### 2. Infinite Recursion in Tree Building

**Scenario**: Circular parent reference causes infinite recursion

**Example**:
```
Node A → parent = Node B
Node B → parent = Node A
```

**Why It Happens**:
- Data corruption
- Parsing bug creates circular reference
- UUID collision (different blocks with same hash)

**Detection**:
```
Error: Maximum call stack size exceeded
RangeError: Maximum call stack size exceeded
```

**Prevention**:
- [ ] Validate NO circular references before insert
- [ ] Add depth limit to recursive queries (max 100 levels)
- [ ] Hash UUID generation must be deterministic (same input = same UUID)

**Code Protection**:
```typescript
// Detect cycles before insertion
function detectCycles(nodes: NodeData[]) {
  const graph = new Map<string, string>();

  for (const node of nodes) {
    if (node.parent) {
      if (wouldCreateCycle(graph, node.uuid, node.parent)) {
        throw new Error(`Cycle detected: ${node.uuid} → ${node.parent}`);
      }
      graph.set(node.uuid, node.parent);
    }
  }
}

// In queries, add MAX DEPTH
const getNodeTree = async (nodeId: string, depth = 0, maxDepth = 100) => {
  if (depth > maxDepth) {
    throw new Error(`Tree depth exceeded ${maxDepth} levels`);
  }
  // ... rest of logic
};
```

---

### 3. UUID Collision

**Scenario**: Two different blocks end up with same UUID

**Why It Happens**:
```typescript
// Bad: Same content hash = same UUID
block1: "TODO: implement feature"
block2: "TODO: implement feature"
// Both get uuid = hash("TODO: implement feature")

// OR: UUID from Logseq's id:: property is duplicated
```

**Detection**:
```
Error: Duplicate key: nodes:uuid-12345
```

**Prevention**:
- [ ] Include full content path in UUID hash: `hash(pageName + blockPath + content)`
- [ ] Validate UUIDs are globally unique before insert
- [ ] Track UUID→content mapping, warn on duplicates

**Code Protection**:
```typescript
// Better UUID generation
function generateStableUuid(
  pageName: string,
  blockPath: string[],  // Path of block in hierarchy
  content: string
): string {
  const seed = `${pageName}:${blockPath.join(":")}:${content}`;
  return hashToUuid(crypto.createHash('sha256').update(seed).digest('hex'));
}

// Validate uniqueness
const uuidSet = new Set<string>();
for (const node of allNodeData) {
  if (uuidSet.has(node.uuid)) {
    throw new Error(`Duplicate UUID: ${node.uuid}`);
  }
  uuidSet.add(node.uuid);
}
```

---

### 4. Missing HTML in KeyDB

**Scenario**: Node exists in SurrealDB but HTML not in KeyDB

**Why It Happens**:
```typescript
// Inserted node into DB
await createWithId(`nodes:${uuid}`, data);

// But failed to store HTML
try {
  await setBlockHTMLBatch(workspaceId, blocks);
} catch (error) {
  // Exception: blocks inserted but HTML missing
}
```

**Detection**:
```
User visits page → renders but blocks show empty
OR:
getBlockHTML returns null for node that should have content
```

**Prevention**:
- [ ] **Transaction**: Insert node + HTML atomically (or fail both)
- [ ] Verify HTML exists before marking ingestion complete
- [ ] Store "HTML status" field in node metadata

**Code Protection**:
```typescript
// Validate HTML before returning
const missingHtml: string[] = [];
for (const { uuid } of blocks) {
  const html = await getBlockHTML(workspaceId, uuid);
  if (!html) missingHtml.push(uuid);
}

if (missingHtml.length > 0) {
  throw new Error(`Missing HTML for blocks: ${missingHtml.join(', ')}`);
}

return { success: true, blockCount: blocks.length };
```

---

## MAJOR SCENARIOS (Will Break Features)

### 5. Page Node Not Found When Querying by Slug

**Scenario**: `getNodeByPath()` fails to find page node

**Symptoms**:
- 404 on page URLs
- "[Display] NodePage: Node not found for path" error

**Root Causes**:
1. **Slug mismatch**: Page name "Advanced Queries" → slug "advanced-queries"
   - But query uses slug "advanced_queries" (underscore vs hyphen)

2. **Missing normalization**: page_name not cleaned during ingestion
   - Page name has special chars: "Advanced! Queries?" → won't match URL slug

3. **Wrong parent filter**: Query for parent != null instead of IS NONE

**Detection**:
```typescript
// Add debugging
console.log(`Looking for: slug="${slug}", parent IS NONE`);
const pages = await query(...);
console.log(`Found: ${pages.length} pages`);
```

**Prevention**:
- [ ] Consistent slug generation everywhere (normalize function)
- [ ] Test slug matching logic before ingestion
- [ ] Verify `parent IS NONE` (not `parent = null`)

**Code Protection**:
```typescript
// Centralized slug generation
function generateSlug(pageName: string): string {
  return pageName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '');
}

// Test matching
test('slug matching', () => {
  const pageName = "Advanced Queries";
  const slug = generateSlug(pageName);
  expect(slug).toBe('advanced-queries');

  // Simulate query
  const querySlug = slug;
  expect(querySlug).toBe(generateSlug(pageName));
});
```

---

### 6. BlockTree Component Fails with New Data Structure

**Scenario**: Frontend renders empty or crashes with tree structure

**Symptoms**:
- Blocks don't render on page
- Component errors in console
- "Cannot read property 'children' of undefined"

**Root Causes**:
1. **Interface change**: BlockTree expects flat array, gets tree
   ```typescript
   // OLD: blocks: Node[]
   // NEW: tree: TreeNode
   ```

2. **Missing HTML field**: Node has no `html` property
   ```typescript
   // Component tries: node.html (undefined)
   ```

3. **Incorrect recursion**: Component doesn't recurse on children

**Detection**:
```
Browser console errors
Component doesn't render children
```

**Prevention**:
- [ ] Update BlockTree interface FIRST before ingestion change
- [ ] Make BlockTree backward compatible (detect old vs new structure)
- [ ] Test rendering with sample tree data

**Code Protection**:
```typescript
// Backward compatibility
type BlocksInput = Node[] | TreeNode;

function isTreeNode(data: BlocksInput): data is TreeNode {
  return 'node' in data && 'children' in data;
}

if (isTreeNode(blocks)) {
  // New tree structure
  return renderTree(blocks);
} else {
  // Old flat structure
  return renderFlat(blocks);
}
```

---

### 7. TOC Generation Fails

**Scenario**: Table of Contents doesn't generate or generates incorrectly

**Current Code** (in app/api/toc/route.ts):
```typescript
const blocks = await getAllBlocksForPage(workspace.id, pageName);
// Assumes flat list, extracts headings
```

**Why It Breaks**:
- `getAllBlocksForPage` returns flat array ✓ still works
- But needs to process tree structure for correct nesting
- TOC should show hierarchy, not flat list

**Detection**:
```
TOC missing nested structure
All items at same level
```

**Prevention**:
- [ ] Rewrite TOC generation to use tree traversal
- [ ] Keep existing API endpoint working (no breaking changes)
- [ ] Test with nested headings

**Code Protection**:
```typescript
// New TOC generation
function generateTocFromTree(tree: TreeNode[]): TocEntry[] {
  const entries: TocEntry[] = [];

  function traverse(node: TreeNode, depth: number) {
    if (isHeading(node)) {
      entries.push({
        level: extractHeadingLevel(node.html) || depth,
        title: node.title,
        id: node.uuid,
      });
    }
    for (const child of node.children || []) {
      traverse(child, depth + 1);
    }
  }

  for (const node of tree) {
    traverse(node, 1);
  }

  return entries;
}
```

---

## MODERATE SCENARIOS (Will Break Specific Features)

### 8. Block Embed Resolution Fails

**Scenario**: `((uuid))` embeds don't resolve or show wrong content

**Why It Happens**:
- Old code searches flat array for UUID
- New code needs to traverse entire tree
- Query doesn't return all descendants

**Detection**:
```
Embeds show [block-not-found]
OR show content from wrong block
```

**Prevention**:
- [ ] Update `processLogseqReferences()` to query by UUID
- [ ] Ensure all nodes are queryable by UUID
- [ ] Test with nested block embeds

**Code Protection**:
```typescript
// Make processLogseqReferences UUID-aware
function processEmbeds(html: string, getNodeByUuid: (uuid: string) => Promise<Node>) {
  return html.replace(/\(\(([a-f0-9\-]+)\)\)/g, async (match, uuid) => {
    try {
      const node = await getNodeByUuid(uuid);
      if (node) {
        const html = await getBlockHTML(node.workspace, uuid);
        return `<div class="block-embed">${html}</div>`;
      }
    } catch (error) {
      console.warn(`Failed to resolve embed: ${uuid}`, error);
    }
    return match;  // Return original if failed
  });
}
```

---

### 9. Sidebar Navigation Shows Wrong Pages

**Scenario**: Sidebar doesn't display full page hierarchy or shows duplicates

**Current Code** (app/[workspaceSlug]/layout.tsx):
```typescript
const nodes = await getAllNodes(workspace.id);
// Sidebar builds tree from flat array
```

**Why It Breaks**:
- Current code filters `parentUuid === null` to get pages
- If `parentUuid` not properly normalized, pages don't show
- Duplicates if same page_name appears multiple times

**Detection**:
- Sidebar shows 0 pages (when should show many)
- Duplicate page entries
- Pages nested under wrong parents

**Prevention**:
- [ ] Ensure `normalizeNode()` always populates `parentUuid`
- [ ] Validate no duplicate page_names in same workspace
- [ ] Test sidebar rendering with sample data

**Code Protection**:
```typescript
// Validate normalization
const nodes = await getAllNodes(workspaceId);
for (const node of nodes) {
  if (node.parentUuid === undefined) {
    throw new Error(`Node ${node.uuid} missing parentUuid after normalization`);
  }
}

// Check for duplicates
const pageNames = new Set<string>();
for (const node of nodes) {
  if (node.parentUuid === null) {  // Page node
    if (pageNames.has(node.page_name)) {
      throw new Error(`Duplicate page: ${node.page_name}`);
    }
    pageNames.add(node.page_name);
  }
}
```

---

### 10. Workspace with 0 Pages After Ingestion

**Scenario**: Ingestion completes but creates no page nodes

**Symptoms**:
- Sidebar empty
- /all-pages shows 0 pages
- No nodes queryable

**Root Causes**:
1. **No top-level headings**: Markdown has no `# Title` lines
   - All blocks are children of implicit parent
   - No page nodes created

2. **Parser ignores top-level blocks**: Logic looks for headings only
   - Regular blocks at indent level 0 not treated as pages

3. **All blocks skipped**: HTML matching fails for all pages
   - Old code skipped pages without HTML (might be reintroduced bug)

**Detection**:
```sql
SELECT COUNT(*) FROM nodes WHERE workspace = $ws AND parent IS NONE;
-- Returns 0
```

**Prevention**:
- [ ] Handle markdown with no headings (create implicit page)
- [ ] Test with various markdown structures
- [ ] Count pages, assert > 0 before completing ingestion

**Code Protection**:
```typescript
// Validate result
const result = await ingestLogseqGraph(workspaceId, repoPath);

if (result.success && result.pageCount === 0) {
  // This is suspicious - investigate
  console.warn(`Warning: Ingestion created 0 pages`);
  throw new Error(`Ingestion created 0 pages - likely parsing error`);
}

// In ingestion
if (totalPages === 0) {
  throw new Error(`No page nodes created from ${markdownFiles.length} files`);
}
```

---

## SUBTLE SCENARIOS (Hard to Detect)

### 11. Order Field Becomes Inconsistent

**Scenario**: Block `order` field doesn't match actual position

**Why It Happens**:
```typescript
// Blocks created as:
Block 1, order=0
Block 2, order=1
Block 3, order=2

// Then delete Block 1 (in reality)
// But database still has order=0,1,2 with gap
// OR order values are duplicated among siblings
```

**Detection**:
- Blocks render in wrong order
- Order field doesn't match visual appearance
- Gaps in order values

**Prevention**:
- [ ] Regenerate order values from ingestion (0, 1, 2, ...)
- [ ] Order is position among siblings with same parent
- [ ] Validate: no duplicate order values for same parent

**Code Protection**:
```typescript
// Recalculate order from position
let order = 0;
for (const child of block.children) {
  child.order = order++;
  await createNode(child);
  // Recurse to set order for grandchildren
  await createChildrenWithOrder(child.children);
}

// Validation
const childrenByParent = new Map<string, Node[]>();
for (const node of allNodes) {
  const parent = node.parent || 'ROOT';
  if (!childrenByParent.has(parent)) {
    childrenByParent.set(parent, []);
  }
  childrenByParent.get(parent)!.push(node);
}

for (const [parent, children] of childrenByParent) {
  const orders = children.map(c => c.order).sort();
  for (let i = 0; i < orders.length; i++) {
    if (orders[i] !== i) {
      throw new Error(`Order gap for parent ${parent}: expected ${i}, got ${orders[i]}`);
    }
  }
}
```

---

### 12. KeyDB Cache Inconsistency

**Scenario**: HTML exists in KeyDB but references are stale

**Why It Happens**:
- Pages with `[[links]]` updated but don't re-render
- Embed references point to old UUIDs
- HTML cached, references not updated

**Detection**:
- Broken links in rendered pages
- Old content showing up in embeds
- Inconsistent display between reloads

**Prevention**:
- [ ] Invalidate KeyDB cache on every ingestion
- [ ] Store hash of content in node metadata
- [ ] Detect when references become invalid

**Code Protection**:
```typescript
// Clear old cache before new ingestion
await clearWorkspaceCache(workspaceId);

// Store content hash
const contentHash = crypto
  .createHash('sha256')
  .update(html)
  .digest('hex')
  .slice(0, 8);

node.metadata.html_hash = contentHash;

// On query, verify hash matches
const cachedHtml = await getBlockHTML(uuid);
const currentHash = node.metadata.html_hash;
if (cachedHtml && hashContent(cachedHtml) !== currentHash) {
  console.warn(`Cache mismatch for ${uuid}`);
  // Invalidate and regenerate
}
```

---

### 13. Duplicate Block Content (Same page_name)

**Scenario**: Same page appears multiple times in nodes table

**Why It Happens**:
```
File: "Advanced Queries.md"
  Contains: # Advanced Queries (creates page node)
  Contains: Block with: "# Advanced Queries" (creates another page node)

Both have page_name="Advanced Queries" but different UUIDs
```

**Detection**:
```sql
SELECT page_name, COUNT(*)
FROM nodes
WHERE workspace = $ws AND parent IS NONE
GROUP BY page_name
HAVING COUNT(*) > 1;
```

**Prevention**:
- [ ] Parse only file name, not content, for page_name
- [ ] OR: Page name = first heading found in file
- [ ] Validate no duplicate page_names per workspace

**Code Protection**:
```typescript
// Page name from file, not content
const pageName = path.basename(filePath, '.md');  // Not from markdown content

// Validate uniqueness
const pageNames = new Set<string>();
for (const node of nodes where parent IS NONE) {
  if (pageNames.has(node.page_name)) {
    throw new Error(`Duplicate page: ${node.page_name}`);
  }
  pageNames.add(node.page_name);
}
```

---

## EDGE CASES (Rare but Possible)

### 14. SurrealDB Query Returns Unordered Results

**Scenario**: Children returned in random order despite `ORDER BY order`

**Why It Matters**: Tree renders in wrong visual order

**Prevention**:
- [ ] Explicitly sort results in code (don't trust DB)
- [ ] Test with large block counts

```typescript
const children = await query(...);
children.sort((a, b) => a.order - b.order);  // Explicit sort
```

---

### 15. Logseq Export Tool Fails for Large Files

**Scenario**: `export-logseq-notes` times out on 10,000+ block files

**Prevention**:
- [ ] Add timeout handling
- [ ] Split large files for processing
- [ ] Add retry logic

---

### 16. BlockTree Component Unmounts During Rendering

**Scenario**: User navigates away while tree is rendering large structure

**Prevention**:
- [ ] Add abort signal for recursion
- [ ] Incremental rendering
- [ ] Render counter to detect stale renders

---

## TESTING MATRIX

| Scenario | Unit Test | Integration Test | E2E Test | Manual |
|----------|-----------|------------------|----------|--------|
| FK violations | ✓ | ✓ | - | - |
| Infinite recursion | ✓ | ✓ | ✓ | - |
| UUID collision | ✓ | ✓ | - | - |
| Missing HTML | ✓ | ✓ | ✓ | ✓ |
| Slug mismatch | ✓ | ✓ | ✓ | ✓ |
| BlockTree failure | - | ✓ | ✓ | ✓ |
| TOC generation | ✓ | ✓ | ✓ | - |
| Block embed fail | ✓ | ✓ | ✓ | ✓ |
| Sidebar wrong | - | ✓ | ✓ | ✓ |
| 0 pages | ✓ | ✓ | ✓ | - |
| Order inconsistent | ✓ | ✓ | - | - |
| Cache stale | - | ✓ | ✓ | ✓ |
| Duplicate pages | ✓ | ✓ | - | - |

---

## Pre-Implementation Checklist

- [ ] Read all 16 scenarios
- [ ] Add unit tests for each prevention strategy
- [ ] Validate error messages are clear
- [ ] Add logging for debugging (DEBUG level)
- [ ] Test with problematic markdown files
- [ ] Have rollback plan ready

---

## Monitoring & Alerts (Post-Deployment)

```typescript
// Log unusual states
if (nodes.length === 0) {
  logger.error('Zero nodes after ingestion', { workspaceId });
}

if (orphanedBlocks.length > 0) {
  logger.warn('Orphaned blocks found', { count: orphanedBlocks.length });
}

// Monitor cache hits
let cacheHits = 0, cacheMisses = 0;
monitor('keydb.hit', cacheHits);
monitor('keydb.miss', cacheMisses);
```

---

**Last Updated**: 2025-11-26
**Status**: 16 failure scenarios identified and documented
