# Code Preservation Guide

## Overview

During the node architecture revamp, we must preserve and integrate existing utility code that handles Logseq-specific features. This guide documents all existing functionality that will be reused.

## Preserved Modules

### 1. modules/logseq/

The entire Logseq processing pipeline is preserved and reused in the new ingestion flow.

#### **modules/logseq/export.ts**
- **Function**: `exportLogseqNotes(repoPath)`
- **Purpose**: Call Rust tool `export-logseq-notes` to render Logseq graph to HTML
- **Status**: ✅ KEEP AS-IS
- **Usage in New Flow**: Called before parsing blocks
- **Keep**: All export logic

#### **modules/logseq/parse.ts**
- **Functions**:
  - `parseLogseqOutput(outputDir)` - Extract page metadata from HTML files
  - `extractMetadata(html)` - Parse title, tags, created-at from meta tags
  - `extractBodyContent(html)` - Extract body HTML from page
  - `processAssets(html, workspaceId, repoPath)` - Handle image assets
- **Status**: ✅ KEEP AS-IS
- **Usage in New Flow**:
  - `processAssets()` called per block during HTML rendering
  - Still used for extracting metadata
- **Important**: Keep exact function signatures

#### **modules/logseq/markdown-parser.ts**
- **Functions**:
  - `parseLogseqDirectory(dirPath)` - Parse markdown files into block structure
  - `flattenBlocks(blocks)` - Convert hierarchical blocks to flat array
- **Status**: ✅ PARTIALLY REUSE, ADAPT
- **Changes Needed**:
  - Keep `parseLogseqDirectory()` for initial file reading
  - DON'T use `flattenBlocks()` (new code builds tree directly)
  - Adapt to return hierarchical structure instead of flat

#### **modules/logseq/process-references.ts**
- **Functions**:
  - `processLogseqReferences(html, workspaceSlug, pageName)` - Handle [[links]] and ((embeds))
  - `processEmbeds(html)` - Process block embeds
- **Status**: ✅ KEEP AS-IS
- **Usage in New Flow**: Called on every block's HTML during rendering
- **Keep**: All reference processing logic

#### **modules/logseq/types.ts**
- **Interfaces**:
  - `LogseqPage`
  - `LogseqBlock`
  - `ParsedPage`
- **Status**: ✅ KEEP, EXTEND
- **Changes**: Add `TreeNode` interface for hierarchical blocks

### 2. modules/logseq/export-tool/

- **Status**: ✅ KEEP AS-IS
- **Location**: Vendored Rust binary
- **No Changes Needed**

### 3. HTML Processing Utilities

#### **modules/logseq/process-references.ts - YouTube Embeds**
```typescript
// This function handles YouTube embeds and other media
export function processLogseqReferences(html, workspaceSlug, pageName) {
  // ... handles [[page links]] → navigation
  // ... handles ((block embeds)) → block references
  // ... handles media embeds
}
```
- **Status**: ✅ KEEP AS-IS
- **Used By**: Block HTML rendering during ingestion
- **Important**: Ensures media embeds work in rendered content

#### **modules/storage/upload.ts - Asset Upload**
```typescript
export async function uploadAsset(...)
```
- **Status**: ✅ KEEP AS-IS
- **Used By**: `processAssets()` in parse.ts
- **Purpose**: Upload images to S3/MinIO during ingestion

### 4. Styling & UI Assets

#### **app/blocks.css**
- **Status**: ✅ KEEP AS-IS
- **Purpose**: Logseq block tree styling (collapsible blocks, indentation, etc.)
- **Used By**: BlockTree component during rendering
- **Important**: Essential for Logseq-like UI experience

#### **components/viewer/BlockTree.tsx**
- **Status**: ✅ KEEP, ADAPT
- **Current**: Renders flat block list
- **New**: Will render hierarchical tree structure
- **Keep**: All existing styling and visual logic
- **Keep**: Collapse/expand functionality
- **Keep**: Block highlighting
- **Adapt**: Accept tree structure instead of flat array

#### **components/viewer/** (all other components)
- Status: ✅ KEEP AS-IS
  - `Breadcrumbs.tsx` - Navigation breadcrumbs
  - `NodeContent.tsx` - Block HTML rendering
  - `Sidebar.tsx` - Page navigation
  - `TableOfContents.tsx` - TOC generation
  - `MobileSidebar.tsx` - Mobile nav drawer

### 5. Reference Processing

#### **Logseq Link Format: [[page-name]]**
```typescript
// From process-references.ts
// Converts [[Advanced Queries]] → /workspace/advanced-queries
// This is CRITICAL functionality that must be preserved
```
- **Status**: ✅ KEEP AS-IS
- **Where**: Processed during block HTML rendering
- **Important**: Enables internal navigation between pages

#### **Block Embed Format: ((uuid))**
```typescript
// From process-references.ts
// Converts ((block-uuid)) → <block-embed>
// This is CRITICAL functionality that must be preserved
```
- **Status**: ✅ KEEP AS-IS
- **Where**: Processed during block HTML rendering
- **Important**: Enables showing referenced blocks inline

### 6. TypeScript Interfaces

#### **modules/content/schema.ts - Node Interface**
```typescript
export interface Node {
  id: string;
  uuid: string;
  workspace: string;
  parent: string | null;      // ← Hierarchy via parent FK
  page_name: string;
  slug: string;
  title?: string;
  order: number;
  metadata?: Node['metadata'];
  created_at: string;
  updated_at: string;
}

// ADD NEW: TreeNode interface
export interface TreeNode {
  node: Node;
  html?: string;              // Fetched from KeyDB
  children: TreeNode[];       // Hierarchical children
}
```
- **Status**: ✅ KEEP, EXTEND
- **Keep**: All existing field definitions
- **Add**: `TreeNode` for hierarchical rendering

## Function Call Chain (Preserved)

### Ingestion Pipeline
```
ingestLogseqGraph()
  ├─ exportLogseqNotes()           ← KEEP EXACT
  │   └─ (Calls Rust tool)
  ├─ parseLogseqOutput()           ← KEEP EXACT
  │   └─ extractMetadata()         ← KEEP EXACT
  │   └─ extractBodyContent()      ← KEEP EXACT
  ├─ parseLogseqDirectory()        ← KEEP, but use for hierarchy building
  │   └─ (Get list of markdown files)
  ├─ FOR EACH BLOCK:
  │   ├─ marked.parse()            ← KEEP markdown → HTML
  │   ├─ processAssets()           ← KEEP AS-IS
  │   ├─ processEmbeds()           ← KEEP AS-IS
  │   ├─ processLogseqReferences() ← KEEP AS-IS
  │   └─ setBlockHTMLBatch()       ← KEEP AS-IS (KeyDB)
  └─ createNodes()                 ← NEW: Hierarchical creation

```

### Rendering Pipeline
```
getNodeByPath()
  ├─ Query page node by slug
  └─ getNodeTree()               ← NEW: Build full tree recursively

BlockTree.tsx
  ├─ Renders tree structure
  ├─ Uses blocks.css styling     ← KEEP EXACT
  ├─ processLogseqReferences()   ← KEEP AS-IS
  └─ For each node, fetch HTML from KeyDB
```

## Critical Functions to Preserve

| Function | Module | Status | Reason |
|----------|--------|--------|--------|
| `exportLogseqNotes()` | logseq/export.ts | ✅ KEEP | Renders markdown to HTML |
| `parseLogseqOutput()` | logseq/parse.ts | ✅ KEEP | Extracts page metadata |
| `processAssets()` | logseq/parse.ts | ✅ KEEP | Handles image uploads |
| `processLogseqReferences()` | logseq/process-references.ts | ✅ KEEP | Converts [[links]] and ((embeds)) |
| `processEmbeds()` | logseq/process-references.ts | ✅ KEEP | Block embed handling |
| `marked.parse()` | library | ✅ KEEP | Markdown → HTML |
| `setBlockHTMLBatch()` | lib/keydb.ts | ✅ KEEP | Store HTML in KeyDB |
| `BlockTree` component | components/viewer/ | ✅ KEEP | Render block hierarchy |
| CSS styling | app/blocks.css | ✅ KEEP | Logseq UI appearance |

## Files NOT Being Rewritten

These files contain useful code that will remain unchanged:

```
modules/logseq/export.ts              (Rust tool integration)
modules/logseq/parse.ts               (HTML extraction)
modules/logseq/process-references.ts  (Link/embed processing)
modules/logseq/types.ts               (TypeScript interfaces)
modules/logseq/export-tool/*          (Vendored Rust binary)
modules/storage/upload.ts             (Asset upload)
modules/storage/s3.ts                 (S3 client)
lib/keydb.ts                          (Redis cache)
app/blocks.css                        (UI styling)
components/viewer/*                   (All display components)
```

## Files Being Rewritten/Extended

```
modules/content/actions.ts            (ingestLogseqGraph rewrite)
modules/content/queries.ts            (Add tree building)
modules/content/schema.ts             (Add TreeNode interface)
modules/logseq/markdown-parser.ts     (Adapt for hierarchy)
```

## Integration Points

### When Rewriting ingestLogseqGraph()

**DO use these functions:**
```typescript
import { exportLogseqNotes } from "./logseq/export";
import { parseLogseqOutput } from "./logseq/parse";
import { parseLogseqDirectory } from "./logseq/markdown-parser";
import { processAssets } from "./logseq/parse";
import { processLogseqReferences } from "./logseq/process-references";
import { processEmbeds } from "./logseq/process-references";
import { setBlockHTMLBatch } from "@/lib/keydb";

// Usage during ingestion
const htmlResult = await exportLogseqNotes(repoPath);
const htmlPages = await parseLogseqOutput(htmlResult.outputDir);

// For each block
const html = await marked.parse(block.content);
const html2 = await processAssets(html, workspaceId, repoPath);
const html3 = processEmbeds(html2);
const html4 = processLogseqReferences(html3, workspaceSlug, pageName);
await setBlockHTMLBatch(workspaceId, blocks);
```

**DO NOT:**
- Rewrite `exportLogseqNotes()` - it's fine as-is
- Remove `processAssets()` calls - needed for images
- Remove `processEmbeds()` - needed for block embeds
- Remove `processLogseqReferences()` - needed for [[links]]
- Change KeyDB storage location or format

### When Rewriting BlockTree Component

**Keep existing:**
```typescript
// Keep exact styling and structure
import "../../app/blocks.css";

// Keep existing props interface
interface BlockTreeProps {
  blocks: Node[];
  workspaceSlug: string;
  pagePath: string;
}
```

**Adapt to:**
```typescript
// New props for tree structure
interface BlockTreeProps {
  tree: TreeNode;              // Changed from flat array
  workspaceSlug: string;
  pagePath: string;
}

// Render recursively
renderTree(node: TreeNode) {
  return (
    <div>
      <NodeContent html={node.html} />
      {node.children.map(child => renderTree(child))}
    </div>
  );
}
```

## Testing Preservation

After rewrite, verify these still work:
- [ ] YouTube embeds render correctly
- [ ] `[[page-name]]` links navigate correctly
- [ ] `((block-uuid))` embeds display inline
- [ ] Images upload to S3/MinIO
- [ ] Block tree styling (collapsible, indented)
- [ ] Logseq reference syntax all supported

## Migration Checklist

- [ ] Read all function signatures in logseq/ modules
- [ ] Document which functions are called from ingestLogseqGraph
- [ ] Verify no breaking changes to function signatures
- [ ] Test export-logseq-notes still works
- [ ] Test processAssets() on new block structure
- [ ] Test processLogseqReferences() on block HTML
- [ ] Verify YouTube embeds, image embeds work
- [ ] Check block tree styling unchanged
- [ ] Verify [[links]] and ((embeds)) still process
- [ ] Run full ingestion test pipeline
