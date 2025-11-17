# Test Data

Test fixtures for Draehi E2E testing.

## Logseq Documentation Graph

**Location:** `logseq-docs-graph/`
**Source:** https://github.com/logseq/docs
**Live Reference:** https://docs.logseq.com

Official Logseq documentation graph - real-world, production-grade test data.

### Statistics

- **Pages:** 238 (complete documentation)
- **Journals:** 75 (real journal entries)
- **Blocks:** Thousands (comprehensive coverage)
- **Block References:** Extensive
- **Page References:** Throughout documentation
- **Real-world structure:** Actual production Logseq graph

### Key Pages for Testing

1. **contents.md** - Homepage
   - Entry point for docs
   - Compare with: https://docs.logseq.com/#/page/contents

2. **Tutorial.md** - Learning guide
   - Complex formatting
   - Nested blocks

3. **Queries.md** - Advanced features
   - Database queries
   - Examples

4. **Shortcuts.md** - Reference tables
   - Complex lists
   - Many cross-references

5. **Journals/** - 75 journal entries
   - Date-based pages
   - Daily notes format

### Git Setup

Already a Git repository (cloned from GitHub):

```bash
cd logseq-docs-graph
git status  # Should show clean working tree
git log -1  # Check latest commit
```

**Default Branch:** `master`

### Usage

**With file:// URL (local testing):**

```
file:///home/adam/markdown_projects/draehi/test-data/logseq-docs-graph
```

**With GitHub (production/CI):**

```
https://github.com/logseq/docs.git
```

## Expected Results

After sync, validate with:

```bash
node scripts/validate-content.js
```

**Expected:**
- Pages: ~238
- Journals: ~75
- Blocks: Thousands
- Page references: Hundreds
- Block references: Many throughout docs

**Benchmark Against Live Site:**

Visit your deployed page and compare with official docs:
- Your site: `http://localhost:3000/{workspace}/contents`
- Reference: `https://docs.logseq.com/#/page/contents`

Should see:
- Same content structure
- Same page references
- Same block hierarchy
- Logseq-style navigation

See [TESTING.md](../docs/TESTING.md) for full validation checklist.
