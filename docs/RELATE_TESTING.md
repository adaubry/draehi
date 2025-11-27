# RELATE Query Testing Guide

This document outlines the test queries we need to validate before implementing RELATE edge creation in the ingestion pipeline.

## Problem

Currently, RELATE edge creation is failing with:
```
Can not execute RELATE statement where property 'in' is: 'nodes:475ee89d249445845abb499132f1f8ea'
```

This happens when trying to create parent-child relationships via:
```typescript
await query(`RELATE $from->parent->$to`, { from: childId, to: parentId });
```

## Test Strategy

We'll test 6 different approaches to determine the correct RELATE syntax:

### TEST 1: RELATE with string record IDs (current approach)
**Query:**
```sql
RELATE $from->parent->$to
```
**Parameters:**
- `$from`: RecordId object (e.g., `nodes:⟨uuid⟩`)
- `$to`: RecordId object (e.g., `nodes:⟨uuid⟩`)

**Expected Result:**
- Fails (current error)

**Purpose:**
- Confirm if this is the issue

---

### TEST 2: RELATE with backtick syntax
**Query:**
```sql
RELATE `nodes:uuid`->parent->`nodes:parent_uuid`
```

**Expected Result:**
- Should either succeed or give a different error
- This shows if backtick escaping helps with record IDs

**Purpose:**
- Test if escaping record IDs with backticks allows RELATE to work

---

### TEST 3: Query existing RELATE edges
**Query:**
```sql
SELECT * FROM parent LIMIT 5
```

**Expected Result:**
- Returns array of existing RELATE edges if any were created
- Shows structure: `{ id, in, out }`

**Purpose:**
- Check if any RELATE edges exist
- Understand the edge structure

---

### TEST 4: Graph traversal query
**Query:**
```sql
SELECT <-parent AS children FROM `nodes:uuid`
```

**Expected Result:**
- If RELATE edges exist: Array with `children` field containing child nodes
- If no RELATE edges: Empty array or no `children` field

**Purpose:**
- Validate that graph traversal works once RELATE edges are properly created
- This is the query we use in queries.ts for building page trees

---

### TEST 5: Manual test RELATE creation
**Queries:**
```sql
CREATE nodes:test_parent_1234 SET page_name = 'test_parent'
CREATE nodes:test_child_5678 SET page_name = 'test_child'
RELATE `nodes:test_child_5678`->parent->`nodes:test_parent_1234`
SELECT <-parent AS children FROM `nodes:test_parent_1234`
DELETE nodes:test_parent_1234
DELETE nodes:test_child_5678
```

**Expected Result:**
- RELATE succeeds
- Graph traversal returns test_child_5678 in children array

**Purpose:**
- Full end-to-end test in controlled environment
- Shows both RELATE creation and query verification

---

### TEST 6: Parent field type analysis
**Query:**
```sql
SELECT id, parent, type::of(parent) AS parentType
FROM nodes
WHERE parent IS NOT NONE
LIMIT 3
```

**Expected Result:**
- Shows actual values and types stored in parent field
- Example: `"nodes:⟨uuid⟩"` (string) vs `RecordId` object

**Purpose:**
- Understand what type parent field contains
- Helps determine if issue is data type mismatch

---

## Running the Tests

```bash
source .env.local
npx tsx scripts/test-relate-queries.ts
```

## Expected Output Format

```
=== RELATE Query Testing ===

Parent page found:
  ID (RecordId): nodes:⟨abc123...⟩
  UUID: abc123...

Child block found:
  ID (RecordId): nodes:⟨def456...⟩
  UUID: def456...
  Parent field: nodes:⟨abc123...⟩

--- TEST 1: RELATE with string IDs (current approach) ---
✗ Failed: Can not execute RELATE statement where property 'in' is: 'nodes:⟨...'

--- TEST 2: RELATE with backtick syntax ---
[RESULT PENDING - USER TESTING]

--- TEST 3: Query existing RELATE edges ---
[RESULT PENDING - USER TESTING]

--- TEST 4: Graph traversal (<-parent AS children) ---
[RESULT PENDING - USER TESTING]

--- TEST 5: Manual test RELATE creation ---
[RESULT PENDING - USER TESTING]

--- TEST 6: Parent field type analysis ---
[RESULT PENDING - USER TESTING]
```

## What We're Looking For

✅ **Success Criteria:**
- At least one RELATE approach creates edges without error
- Graph traversal query returns children for nodes with RELATE edges
- Parent field type is consistent throughout

❌ **If All Tests Fail:**
- RELATE may not be the right approach
- May need to use alternative (SET parent_id vs RELATE)
- May need to investigate SurrealDB version/configuration

## Next Steps

1. **User runs the test script** and reports results
2. **Identify which RELATE syntax works**
3. **Update actions.ts** to use the working syntax
4. **Run full ingestion test** to verify end-to-end flow
5. **Validate page rendering** works with proper graph traversal
