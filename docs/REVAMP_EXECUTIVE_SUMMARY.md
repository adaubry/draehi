# Node Architecture Revamp - Executive Summary

## What's Changing

The fundamental data model is being redesigned to properly represent Logseq's hierarchical block structure instead of treating pages and blocks as separate entities.

### Before (Current - Broken)
```
✗ Pages = special entities
✗ Blocks = second-class content
✗ Hierarchy = encoded in "order" field + "page_name" duplication
✗ Problem: Loses Logseq structure, impossible to support block embeds
```

### After (New - Correct)
```
✓ Everything = nodes (pages are root nodes, blocks are child nodes)
✓ Hierarchy = parent FK relationships (natural graph)
✓ Block embeds work (tree traversal finds any node)
✓ Deep nesting supported (unlimited depth)
```

## Why This Matters

1. **Data Fidelity**: Preserves exact Logseq block hierarchy and indentation
2. **Features**: Enables proper [[page links]] and ((block embeds))
3. **Scalability**: Handles deeply nested structures (50+ levels)
4. **Correctness**: Uses SurrealDB's graph capabilities instead of workarounds

## What's NOT Changing

- ✅ All Logseq processing code (export, parsing, link processing)
- ✅ Asset handling (YouTube embeds, image uploads)
- ✅ UI styling and components (block tree appearance)
- ✅ KeyDB storage for HTML content
- ✅ All existing features (tags, properties, breadcrumbs)

We're only changing **how nodes are organized**, not what content they hold.

## The Work

### 3 Files to Rewrite
1. **modules/content/actions.ts** - Ingestion logic
   - Old: Flat page → blocks
   - New: Recursive hierarchy with parent chain

2. **modules/content/queries.ts** - Query layer
   - Old: Flat list queries
   - New: Tree-building queries

3. **modules/logseq/markdown-parser.ts** - Parsing (adapt)
   - Old: Flatten blocks to array
   - New: Keep hierarchical structure

### 1 Schema Change
1. **scripts/init-surreal-schema.ts**
   - ✅ DONE: Made `title` optional (only pages have titles)
   - ✅ DONE: Confirmed `parent` FK is correct

## Data Flow After Revamp

```
User visits /workspace/advanced-queries

1. QUERY LAYER
   ├─ Find page node: WHERE slug='advanced-queries' AND parent IS NONE
   └─ Get full tree: Recursively fetch all children

2. FETCH CONTENT
   └─ For each node in tree: Fetch HTML from KeyDB by UUID

3. RENDER
   ├─ Generate TOC from tree structure
   ├─ Render blocks with proper indentation
   └─ Display with styling (blocks.css)
```

## Testing Validation

After implementation, these must work:
- [ ] Multi-level nested blocks (10+ levels)
- [ ] YouTube embeds in blocks
- [ ] `[[page-name]]` navigation links
- [ ] `((block-uuid))` block embeds
- [ ] Image uploads to S3
- [ ] Block collapse/expand UI
- [ ] Full page hierarchy display
- [ ] Search across nested content

## Implementation Timeline

### Phase 1: Planning (DONE)
- ✅ Understand Logseq model
- ✅ Design schema changes
- ✅ Document architecture

### Phase 2: Implementation (~1-2 days)
- [ ] Rewrite ingestion with hierarchy
- [ ] Add tree-building queries
- [ ] Update frontend rendering
- [ ] Test with sample graphs

### Phase 3: Validation (~1 day)
- [ ] Run full pipeline tests
- [ ] Verify all features work
- [ ] Performance check
- [ ] Edge case testing

### Phase 4: Deployment (~1 day)
- [ ] Database migration
- [ ] Feature flag rollout
- [ ] Monitor and verify
- [ ] Remove old code

## Key Files Reference

| Document | Purpose |
|----------|---------|
| [NODE_ARCHITECTURE_REVAMP.md](./NODE_ARCHITECTURE_REVAMP.md) | Complete technical specification |
| [INGESTION_IMPLEMENTATION.md](./INGESTION_IMPLEMENTATION.md) | Step-by-step implementation guide |
| [CODE_PRESERVATION_GUIDE.md](./CODE_PRESERVATION_GUIDE.md) | List of code to keep/change |
| [DATABASE.md](./DATABASE.md) | Database schema (update reference) |
| [ROADMAP.md](./ROADMAP.md) | Project phases and status |

## Success Criteria

✅ Implementation succeeds when:
1. All 242 markdown pages are created as nodes (not just 73)
2. Block hierarchy is preserved (tabs → parent relationships)
3. Block embeds `((uuid))` work correctly
4. Page links `[[name]]` navigate correctly
5. All HTML content renders from KeyDB
6. TOC generated correctly from tree
7. Performance is acceptable (~200ms page load)
8. All tests pass
9. No data loss during migration

## Rollback Plan

If issues arise:
1. Keep old code in separate branch
2. Have backup of old database state
3. Feature flag to switch between models
4. Can revert to old ingestion if needed

## Questions/Decisions

None at this time. Architecture is clear, requirements documented, implementation path defined.

## Next Steps

1. Read all three documentation files
2. Start implementation with ingestion rewrite
3. Build tree-building queries
4. Update rendering layer
5. Test thoroughly
6. Deploy with feature flag

---

**Status**: Documentation Complete, Ready for Implementation
**Updated**: 2025-11-26
**Owner**: Architecture Team
