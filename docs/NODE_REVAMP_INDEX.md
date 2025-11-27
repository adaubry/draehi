# Node Architecture Revamp - Documentation Index

## Quick Links

### For Decision Makers
👉 Start here: **[REVAMP_EXECUTIVE_SUMMARY.md](./REVAMP_EXECUTIVE_SUMMARY.md)**
- What's changing and why
- Timeline and effort estimate
- Success criteria
- Next steps

### For Implementation
👉 Start here: **[NODE_ARCHITECTURE_REVAMP.md](./NODE_ARCHITECTURE_REVAMP.md)**
- Complete technical specification
- Database schema design
- Data flow diagrams
- Examples and use cases

### For Detailed Implementation Steps
👉 Start here: **[INGESTION_IMPLEMENTATION.md](./INGESTION_IMPLEMENTATION.md)**
- Step-by-step algorithm
- Code examples and patterns
- Helper functions
- Testing strategy
- Edge cases and solutions

### For Code Changes & Preservation
👉 Start here: **[CODE_PRESERVATION_GUIDE.md](./CODE_PRESERVATION_GUIDE.md)**
- What code stays, what changes
- Function call chains
- Integration points
- Migration checklist

---

## Document Overview

| Document | Audience | Length | Purpose |
|----------|----------|--------|---------|
| **REVAMP_EXECUTIVE_SUMMARY.md** | Managers, Leads | 5 min read | High-level overview and timeline |
| **NODE_ARCHITECTURE_REVAMP.md** | Architects, Leads | 15 min read | Complete technical spec |
| **INGESTION_IMPLEMENTATION.md** | Engineers | 20 min read | Step-by-step coding guide |
| **CODE_PRESERVATION_GUIDE.md** | Engineers, QA | 10 min read | What to keep/change |

---

## The Core Problem & Solution

### Problem
The current system treats pages and blocks as separate entities with artificial hierarchy encoding. This:
- Loses Logseq data fidelity (block hierarchy is flattened)
- Makes block embeds `((uuid))` impossible to implement
- Can't handle deep nesting (Logseq supports 50+ levels)
- Doesn't use SurrealDB's graph capabilities

### Solution
**Everything is a node.** Pages are root nodes, blocks are child nodes connected via parent FK relationships.

This:
- ✅ Preserves exact Logseq hierarchy
- ✅ Enables block embeds naturally
- ✅ Supports unlimited nesting depth
- ✅ Uses SurrealDB's graph model correctly

---

## Implementation Scope

### Files Being Rewritten
1. `modules/content/actions.ts` - Ingestion logic
2. `modules/content/queries.ts` - Query layer
3. `modules/logseq/markdown-parser.ts` - Parsing (adapt for hierarchy)

### Files Being Extended
1. `modules/content/schema.ts` - Add `TreeNode` interface

### Files Unchanged (but referenced)
- All `modules/logseq/` (export, parse, references)
- All `components/viewer/` (rendering)
- All `lib/` utilities
- All styling and assets

---

## Key Architectural Changes

### Before
```
Nodes Table:
  ┌─ page_name: "Advanced Queries"
  │  ├─ order: 0, parent: null
  │  └─ All blocks duplicating "Advanced Queries" in page_name
  ├─ page_name: "Advanced Queries"
  │  └─ order: 1, parent: null
  └─ No hierarchy relationship
```

### After
```
Nodes Table:
  ┌─ id: uuid1, parent: null, title: "Advanced Queries"
  ├─ id: uuid2, parent: uuid1        (child block)
  │  ├─ id: uuid3, parent: uuid2     (grandchild block)
  │  └─ id: uuid4, parent: uuid2
  └─ id: uuid5, parent: uuid1
```

---

## Data Storage Separation

```
SurrealDB (nodes table)
  └─ Stores: metadata, hierarchy, relationships
  └─ Example: {id, parent, page_name, slug, title, order, metadata}

KeyDB (Redis)
  └─ Stores: rendered HTML content by UUID
  └─ Example: workspace:id:block:uuid → <html>content</html>
```

---

## Query Pattern Changes

### Old Pattern (Flat)
```typescript
// Get all blocks for a page
const blocks = await query(
  "SELECT * FROM nodes WHERE page_name = $name ORDER BY order"
);
```

### New Pattern (Tree)
```typescript
// Get page and all descendants recursively
async function getNodeTree(nodeId: string) {
  const node = await selectOne(nodeId);
  const children = await query(
    "SELECT * FROM nodes WHERE parent = $parent ORDER BY order",
    { parent: nodeId }
  );
  return {
    node,
    children: await Promise.all(children.map(c => getNodeTree(c.id)))
  };
}

const tree = await getNodeTree(pageNodeId);
```

---

## Rendering Pattern Changes

### Old Pattern (Flat List)
```typescript
// BlockTree receives flat array
<BlockTree blocks={allBlocks} />
```

### New Pattern (Tree Structure)
```typescript
// BlockTree receives tree
<BlockTree tree={treeNode} />

// Component renders recursively
function renderTree(node) {
  return (
    <div>
      <Content html={node.html} />
      {node.children.map(child => renderTree(child))}
    </div>
  );
}
```

---

## Testing Coverage

### Unit Tests Needed
- [ ] Block parsing with proper hierarchy
- [ ] Node creation with parent chain
- [ ] Tree traversal and recursion
- [ ] HTML rendering per block

### Integration Tests Needed
- [ ] Full ingestion pipeline
- [ ] Query performance with deep nesting
- [ ] Block embed resolution
- [ ] Link processing

### End-to-End Tests Needed
- [ ] Logseq graph with 10+ levels
- [ ] All block types (text, code, media)
- [ ] [[page links]] and ((block embeds))
- [ ] Asset uploads and image embeds

---

## Migration Checklist

Before implementation:
- [ ] Read all four documents
- [ ] Understand node hierarchy model
- [ ] Review existing code being preserved
- [ ] Plan database migration (if needed)

During implementation:
- [ ] Write new ingestion logic
- [ ] Write tree-building queries
- [ ] Update rendering components
- [ ] Add comprehensive tests

After implementation:
- [ ] Verify all features work
- [ ] Performance benchmarking
- [ ] Data validation
- [ ] Rollback plan ready

---

## Questions to Resolve

### None - Architecture is complete.
All design decisions are documented and rationale is clear.

---

## References

- [CLAUDE.md](../CLAUDE.md) - Project guidelines
- [DATABASE.md](./DATABASE.md) - Database architecture (needs update)
- [ROADMAP.md](./ROADMAP.md) - Project phases
- [NODE_ARCHITECTURE_REVAMP.md](./NODE_ARCHITECTURE_REVAMP.md) - Full spec

---

## Next Action

**Start with**: [REVAMP_EXECUTIVE_SUMMARY.md](./REVAMP_EXECUTIVE_SUMMARY.md)

After reading the summary, proceed to the implementation guide matching your role:
- **Leads/Architects**: [NODE_ARCHITECTURE_REVAMP.md](./NODE_ARCHITECTURE_REVAMP.md)
- **Developers**: [INGESTION_IMPLEMENTATION.md](./INGESTION_IMPLEMENTATION.md)
- **QA/Reviewers**: [CODE_PRESERVATION_GUIDE.md](./CODE_PRESERVATION_GUIDE.md)

---

**Last Updated**: 2025-11-26
**Status**: Documentation Complete, Ready for Implementation
