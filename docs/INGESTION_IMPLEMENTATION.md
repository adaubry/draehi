# Ingestion Implementation Guide

## Overview

This guide details the complete rewrite of `modules/content/actions.ts:ingestLogseqGraph()` to properly implement the node hierarchy model described in [NODE_ARCHITECTURE_REVAMP.md](./NODE_ARCHITECTURE_REVAMP.md).

## Core Algorithm

### Input
- Logseq repository path containing markdown files
- Workspace ID

### Output
- SurrealDB: Nodes with proper parent relationships
- KeyDB: HTML content by UUID

### Process

```
1. Parse Markdown Files
   ├─ Identify page structure (heading level = nesting)
   ├─ Extract block content and properties
   └─ Build hierarchy tree from indentation

2. Render to HTML
   ├─ Convert markdown → HTML
   ├─ Process Logseq syntax ([[links]], ((embeds)))
   └─ Store in KeyDB keyed by UUID

3. Create Nodes in SurrealDB
   ├─ Create page nodes (parent = null)
   ├─ Create block nodes (parent = parent_uuid)
   └─ Set order based on document order

4. Verify Relationships
   └─ Ensure parent FK references exist
```

## Data Structures

### Parsed Block

```typescript
interface ParsedBlock {
  uuid: string;                    // From id:: property or hashed
  content: string;                 // Markdown content
  title?: string;                  // First line or property
  depth: number;                   // Nesting level (0 = page, 1+ = blocks)
  order: number;                   // Position among siblings
  children: ParsedBlock[];         // Nested blocks
  properties: Record<string, any>;  // Logseq properties (tags, etc.)
}
```

### Node Creation Data

```typescript
interface NodeData {
  workspace: string;        // workspace record ID
  parent: string | null;    // parent node record ID or null
  page_name: string;        // "Advanced Queries"
  slug: string;             // "advanced-queries"
  title?: string;           // Display title (optional)
  order: number;            // Sibling order
  metadata: {
    tags: string[];
    properties: Record<string, any>;
    references: string[];   // [[links]] found in content
  };
}
```

## Step-by-Step Implementation

### 1. Parse Markdown Files

```typescript
// Parse markdown file, respecting Logseq's structure
async function parseLogseqFile(filePath: string): Promise<ParsedBlock[]> {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');

  const pages: ParsedBlock[] = [];
  let currentPage: ParsedBlock | null = null;
  let blockStack: ParsedBlock[] = [];  // Stack of open parents

  for (const line of lines) {
    const depth = getIndentationDepth(line);
    const content = line.trim();

    if (isHeading(line)) {
      // Top-level heading = new page
      currentPage = createPageNode(content);
      blockStack = [currentPage];
      pages.push(currentPage);
    } else if (content.length > 0) {
      // Regular block
      const block = createBlockNode(content, depth);

      // Find correct parent based on depth
      while (blockStack.length > depth) {
        blockStack.pop();  // Go up the tree
      }

      const parent = blockStack[blockStack.length - 1];
      parent.children.push(block);
      blockStack.push(block);
    }
  }

  return pages;
}

function getIndentationDepth(line: string): number {
  const match = line.match(/^(\s*)/);
  return match ? Math.floor(match[1].length / 2) : 0;  // Assume 2-space indent
}

function isHeading(line: string): boolean {
  return /^#+\s/.test(line.trim());
}
```

### 2. Extract Block Properties

```typescript
// Extract Logseq properties like id::, tags, etc.
function extractBlockProperties(
  content: string
): { uuid: string; properties: Record<string, any> } {
  const properties: Record<string, any> = {};
  let uuid = '';

  // Match id:: property for UUID
  const idMatch = content.match(/id::\s*([a-f0-9\-]+)/);
  if (idMatch) {
    uuid = idMatch[1];
  }

  // Extract other properties (tags::, created-at::, etc.)
  const propMatches = content.matchAll(/(\w+)::\s*(.+?)(?=\n|$)/g);
  for (const match of propMatches) {
    properties[match[1]] = match[2];
  }

  // If no UUID, generate deterministic one
  if (!uuid) {
    uuid = hashContent(`${currentPageName}:${content}`);
  }

  return { uuid, properties };
}

function hashContent(content: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(content)
    .digest('hex');

  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}
```

### 3. Render HTML

```typescript
// Render block content to HTML and store in KeyDB
async function renderBlockHtml(
  block: ParsedBlock,
  workspaceId: string,
  htmlList: Array<{ uuid: string; html: string }>
): Promise<void> {
  // Parse markdown to HTML
  let html = await marked.parse(block.content, {
    async: true,
    gfm: true,
  });

  // Process Logseq syntax
  html = processLogseqReferences(html);
  html = processEmbeds(html);
  html = processAssets(html);

  // Store in batch for later KeyDB insertion
  htmlList.push({
    uuid: block.uuid,
    html: html.trim(),
  });

  // Recurse on children
  for (const child of block.children) {
    await renderBlockHtml(child, workspaceId, htmlList);
  }
}
```

### 4. Create Nodes Recursively

```typescript
// Create nodes in SurrealDB maintaining parent relationships
async function createNodesRecursively(
  block: ParsedBlock,
  parentUuid: string | null,
  workspaceId: string,
  pageName: string,
  slug: string,
  allNodeData: Array<{ uuid: string; data: NodeData }>,
  order: number
): Promise<void> {
  const nodeData: NodeData = {
    workspace: workspaceId,
    parent: parentUuid ? `nodes:${parentUuid}` : null,
    page_name: pageName,
    slug: slug,
    title: block.title || null,
    order: order,
    metadata: {
      tags: extractTags(block.properties),
      properties: block.properties,
      references: extractReferences(block.content),
    },
  };

  allNodeData.push({
    uuid: block.uuid,
    data: nodeData,
  });

  // Recurse on children with this block as parent
  for (let i = 0; i < block.children.length; i++) {
    await createNodesRecursively(
      block.children[i],
      block.uuid,           // This block is parent for children
      workspaceId,
      pageName,
      slug,
      allNodeData,
      i                     // Order among siblings
    );
  }
}
```

### 5. Main Ingestion Function (Rewritten)

```typescript
export async function ingestLogseqGraph(
  workspaceId: string,
  repoPath: string
): Promise<{
  success: boolean;
  pageCount?: number;
  blockCount?: number;
  error?: string;
  buildLog?: string[];
}> {
  const buildLog: string[] = [];
  const allNodeData: Array<{ uuid: string; data: NodeData }> = [];
  const allBlockHTML: Array<{ uuid: string; html: string }> = [];

  try {
    // Step 1: Get workspace for slug
    const workspace = await queryOne<{ id: string; slug: string }>(
      "SELECT id, slug FROM workspaces WHERE id = $ws",
      { ws: workspaceId }
    );
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    // Step 2: Parse markdown files
    buildLog.push("Parsing markdown files...");
    const pagesDir = path.join(repoPath, "pages");
    const files = await fs.readdir(pagesDir);
    const markdownFiles = files.filter(f => f.endsWith('.md'));

    let totalPages = 0;
    let totalBlocks = 0;

    for (const file of markdownFiles) {
      const filePath = path.join(pagesDir, file);
      const pageName = path.basename(file, '.md');
      const { slug } = extractNamespaceAndSlug(pageName);

      // Parse file into block tree
      const pages = await parseLogseqFile(filePath);

      for (const pageNode of pages) {
        totalPages++;

        // Step 3: Render HTML for all blocks in this page
        await renderBlockHtml(pageNode, workspaceId, allBlockHTML);

        // Step 4: Create nodes recursively
        await createNodesRecursively(
          pageNode,
          null,             // Page has no parent
          workspaceId,
          pageNode.content, // page_name
          slug,
          allNodeData,
          0
        );

        // Count blocks
        const blockCount = countDescendants(pageNode);
        totalBlocks += blockCount;

        buildLog.push(`Processed page: ${pageName} (${blockCount} blocks)`);
      }
    }

    // Step 5: Deduplicate by UUID
    const seenUuids = new Set<string>();
    const uniqueNodeData = allNodeData.filter(({ uuid }) => {
      if (seenUuids.has(uuid)) {
        console.log(`[Ingestion] Skipping duplicate: ${uuid}`);
        return false;
      }
      seenUuids.add(uuid);
      return true;
    });

    // Step 6: Insert nodes into SurrealDB
    buildLog.push(`Inserting ${uniqueNodeData.length} nodes...`);
    const BATCH_SIZE = 500;
    for (let i = 0; i < uniqueNodeData.length; i += BATCH_SIZE) {
      const batch = uniqueNodeData.slice(i, i + BATCH_SIZE);
      for (const { uuid, data } of batch) {
        await createWithId(`nodes:${uuid}`, data);
      }
      buildLog.push(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(uniqueNodeData.length / BATCH_SIZE)}`);
    }

    // Step 7: Store HTML in KeyDB
    buildLog.push(`Caching ${allBlockHTML.length} block HTMLs in KeyDB...`);
    await setBlockHTMLBatch(workspaceId, allBlockHTML);

    buildLog.push("✓ Ingestion complete!");
    return {
      success: true,
      pageCount: totalPages,
      blockCount: totalBlocks,
      buildLog,
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    buildLog.push(`✗ ERROR: ${errorMsg}`);
    console.error("[Ingestion] Failed:", error);
    return {
      success: false,
      error: errorMsg,
      buildLog,
    };
  }
}
```

## Helper Functions

```typescript
function extractTags(properties: Record<string, any>): string[] {
  const tags = properties['tags'] || '';
  return typeof tags === 'string'
    ? tags.split(/,\s*/)
    : Array.isArray(tags)
      ? tags
      : [];
}

function extractReferences(content: string): string[] {
  const references: string[] = [];

  // [[page references]]
  const pageRefs = content.match(/\[\[([^\]]+)\]\]/g);
  if (pageRefs) {
    references.push(...pageRefs.map(ref => ref.slice(2, -2)));
  }

  // ((block embeds))
  const blockRefs = content.match(/\(\(([a-f0-9\-]+)\)\)/g);
  if (blockRefs) {
    references.push(...blockRefs.map(ref => ref.slice(2, -2)));
  }

  return references;
}

function countDescendants(block: ParsedBlock): number {
  let count = 1;
  for (const child of block.children) {
    count += countDescendants(child);
  }
  return count;
}
```

## Edge Cases

### 1. Deeply Nested Blocks
Logseq supports up to ~50+ levels of indentation. The recursive approach handles this naturally.

### 2. Circular References
If block A embeds block B which embeds block A:
- Store references in metadata
- Detect cycles at query time
- Don't follow circular references in rendering

### 3. Missing UUIDs
If block lacks `id::` property:
- Generate deterministic UUID from hash
- Use: `hashContent(pageName + blockContent)`
- Regenerating same content = same UUID (idempotent)

### 4. Duplicate UUIDs
Deduplication filter handles if same UUID appears twice:
- Log warning
- Keep first occurrence
- Discard subsequent

### 5. Very Large Files
For files with 10,000+ blocks:
- Parse in chunks
- Batch inserts (500 at a time)
- Show progress

## Testing Strategy

```typescript
// Unit tests
test('parseLogseqFile: simple nesting', async () => {
  const blocks = await parseLogseqFile('test.md');
  expect(blocks[0].children).toHaveLength(2);
  expect(blocks[0].children[0].children).toHaveLength(1);
});

test('createNodesRecursively: parent chain', async () => {
  const nodeData: NodeData[] = [];
  const block = createBlockNode('content', 0);
  block.children.push(createBlockNode('child', 1));

  await createNodesRecursively(block, null, 'ws:id', 'page', 'slug', nodeData, 0);

  expect(nodeData).toHaveLength(2);
  expect(nodeData[1].data.parent).toBe(`nodes:${nodeData[0].uuid}`);
});

// Integration tests
test('ingestLogseqGraph: full pipeline', async () => {
  const result = await ingestLogseqGraph('ws:id', '/path/to/repo');

  expect(result.success).toBe(true);
  expect(result.pageCount).toBeGreaterThan(0);
  expect(result.blockCount).toBeGreaterThan(result.pageCount);

  // Verify nodes in DB
  const nodes = await query('SELECT * FROM nodes WHERE workspace = $ws', { ws: 'ws:id' });
  expect(nodes.length).toBe(result.pageCount + result.blockCount);
});
```

## Files to Update

1. **modules/content/actions.ts**
   - Rewrite `ingestLogseqGraph()`
   - Update import statements
   - Keep `upsertNode()` and `deleteNode()` for single-node operations

2. **modules/content/queries.ts**
   - Add `getNodeTree()` - recursive tree building
   - Add `getPageBySlug()` - get page node by slug
   - Update `getAllNodes()` - get all page nodes

3. **modules/content/schema.ts**
   - Add `TreeNode` interface
   - Keep `Node` interface as-is
   - Add `getNodeUuidFromRecord()` helper

4. **lib/keydb.ts**
   - No changes needed (already correct)

## Rollout Plan

1. Keep old code in place
2. Implement new functions in parallel
3. Add feature flag: `USE_NEW_INGESTION`
4. Test with feature flag enabled
5. Switch default to new version
6. Remove old code after validation
