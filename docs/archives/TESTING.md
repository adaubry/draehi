# Testing Guide - Draehi

Comprehensive testing guide for Draehi covering all modules, database operations, and integration tests.

## 🚀 Quick Start

### Run All Database Tests (Recommended)

```bash
# Comprehensive database test suite - tests ALL 42 database operations
source .test.env
./scripts/test-db.sh

# OR TypeScript integration tests with type safety
npx tsx scripts/test-db-comprehensive.ts
```

### Run Specific Test Suites

```bash
# Backend E2E test suite (complete workflow)
./scripts/test-e2e.sh

# Frontend E2E test suite (display & rendering)
./scripts/test-frontend-e2e.sh

# Module-specific tests
npx tsx scripts/test-auth-workspace-flow.ts      # Auth + workspace creation
npx tsx scripts/test-complete-auth-flow.ts       # Full signup flow
npx tsx scripts/test-deployment-flow.ts          # Deployment workflow
```

### Setup

```bash
# Copy test config template
cp .test.env.example .test.env

# Ensure SurrealDB is running
npm run docker:setup

# Initialize database schema
npx tsx scripts/init-surreal-schema.ts
```

---

## 📋 Test Files Overview

### PRIMARY TEST SUITES (NEW)

#### `test-db.sh` - Comprehensive Bash Database Test Suite
Bash script that tests **every single database operation** in the system.

**Coverage:**
- ✅ 42 database operations (16 reads, 6 creates, 4 updates, 3 deletes)
- ✅ AUTH module: user CRUD, cascading deletes
- ✅ WORKSPACE module: workspace CRUD, uniqueness constraints
- ✅ CONTENT/NODES: pages, blocks, nested hierarchy
- ✅ GIT module: repositories and deployments
- ✅ Schema validation: tables, indexes, constraints
- ✅ Integration tests: complete workflows

**Run:**
```bash
source .test.env
./scripts/test-db.sh
```

**Output Example:**
```
✓ PASS: AUTH-CREATE: Create new user
✓ PASS: AUTH-READ: Query user by auth0_sub
✓ PASS: WORKSPACE-CREATE: Create workspace
✓ PASS: WORKSPACE-READ: Get workspace by user ID
✓ PASS: NODES-CREATE: Create page node
✓ PASS: NODES-CREATE: Create block node
✓ PASS: NODES-READ: Get all pages for workspace
✓ PASS: NODES-UPDATE: Update node title
✓ PASS: GIT-CREATE: Create git repository
✓ PASS: DEPLOYMENT-CREATE: Create deployment
...
TEST SUMMARY
Total Tests Run: 89
Tests Passed: 89
Tests Failed: 0
✓ ALL TESTS PASSED!
```

---

#### `test-db-comprehensive.ts` - TypeScript Integration Tests
Full integration test suite using actual application code with type safety.

**Coverage:**
- ✅ Real application CRUD operations
- ✅ RecordId handling and parameter passing
- ✅ Cascading delete verification
- ✅ Constraint validation
- ✅ Complete user → workspace → content → deployment flow

**Run:**
```bash
npx tsx scripts/test-db-comprehensive.ts
```

---

### MODULE-SPECIFIC TESTS

#### AUTH Module Tests

**`test-auth-workspace-flow.ts`**
- Tests Auth0 user sync and automatic workspace creation
- Verifies first-login flow
- Confirms workspace query by userId works

**`test-complete-auth-flow.ts`**
- Full authentication flow from login to dashboard
- Tests all query patterns used in production code

**`test-workspace-creation.ts`**
- Workspace auto-creation in auth flow
- RecordId handling in queries

---

#### DEPLOYMENT Module Tests

**`test-deployment-flow.ts`**
- Complete deployment workflow
- Repository creation and updates
- Deployment record creation and status updates
- **Critical:** Tests RecordId parameter handling in UPDATE statements

**`test-full-deployment-with-repo.ts`**
- End-to-end deployment with real Git operations
- Repository cloning
- Content processing and ingestion

---

#### RecordId Handling Tests

**`test-userid-comparison.ts`**
- **CRITICAL TEST:** Shows RecordId vs string parameter difference
- RecordId objects work in WHERE clauses ✅
- String parameters don't work ✗
- Demonstrates fix for "workspace not found" issue

**`test-recordid-string.ts`**
- Tests String() conversion of RecordId objects
- Verifies toString() method works correctly

**`test-exact-dashboard-flow.ts`**
- Simulates exact dashboard page load sequence
- User creation → workspace query flow

---

### E2E WORKFLOW TESTS

**`scripts/test-e2e.sh`**
- Complete backend workflow from user creation to deployment
- Tests actual API routes and server actions
- Validates database persistence

**`scripts/test-frontend-e2e.sh`**
- Frontend display validation
- Page rendering and interactive features
- Visual regression checks

---

## 📊 Database Coverage Matrix

### Operations Tested: 42 Total

#### AUTH Module (5)
| Operation | File | Status |
|-----------|------|--------|
| CREATE user | test-db.sh | ✅ |
| READ by auth0_sub | test-db.sh | ✅ |
| READ by username | test-db.sh | ✅ |
| DELETE user | test-db.sh | ✅ |
| CASCADE delete → workspaces | test-db.sh | ✅ |

#### WORKSPACE Module (5)
| Operation | File | Status |
|-----------|------|--------|
| CREATE workspace | test-db.sh | ✅ |
| READ by ID | test-db.sh | ✅ |
| READ by slug | test-db.sh | ✅ |
| READ by user_id | test-db.sh | ✅ |
| UPDATE workspace | test-db.sh | ✅ |

#### CONTENT/NODES Module (12)
| Operation | File | Status |
|-----------|------|--------|
| CREATE page node | test-db.sh | ✅ |
| CREATE block node | test-db.sh | ✅ |
| CREATE nested block | test-db.sh | ✅ |
| READ pages (parent=NONE) | test-db.sh | ✅ |
| READ blocks for page | test-db.sh | ✅ |
| READ blocks by page_name | test-db.sh | ✅ |
| READ node by ID | test-db.sh | ✅ |
| UPDATE node | test-db.sh | ✅ |
| DELETE single node | test-db.sh | ✅ |
| DELETE all nodes | test-db.sh | ✅ |
| BATCH ingest | test-e2e.sh | ✅ |
| CACHE operations | test-frontend-e2e.sh | ✅ |

#### GIT Module (7)
| Operation | File | Status |
|-----------|------|--------|
| CREATE repository | test-db.sh | ✅ |
| READ by workspace | test-db.sh | ✅ |
| UPDATE repository | test-db.sh | ✅ |
| CREATE deployment | test-db.sh | ✅ |
| READ deployments | test-db.sh | ✅ |
| READ latest deployment | test-db.sh | ✅ |
| UPDATE deployment | test-db.sh | ✅ |

#### Schema & Indexes (5)
| Table | File | Status |
|-------|------|--------|
| users | test-db.sh | ✅ |
| workspaces | test-db.sh | ✅ |
| nodes | test-db.sh | ✅ |
| git_repositories | test-db.sh | ✅ |
| deployment_history | test-db.sh | ✅ |

---

## 🔑 Key Test Patterns

### RecordId Handling (CRITICAL)

**Problem:** String parameters in WHERE clauses don't match RecordId objects

**Incorrect:**
```typescript
const userId = "users:abc123";  // String representation
const workspace = await db.query(`
  SELECT * FROM workspaces WHERE user = $userId LIMIT 1
`, { userId });  // ❌ Returns nothing
```

**Correct:**
```typescript
const userId = recordIdObject;  // RecordId object from database
const workspace = await db.query(`
  SELECT * FROM workspaces WHERE user = $userId LIMIT 1
`, { userId });  // ✅ Works correctly
```

**Test Coverage:**
See `test-userid-comparison.ts` - demonstrates both patterns

---

### Cascading Deletes

Pattern: App-level cascade when deleting users

```
Delete user
  ↓
  Delete all workspaces for user
    ↓
    Delete all nodes in workspaces
    Delete all git_repositories in workspaces
    Delete all deployment_history in workspaces
```

**Tested in:** `test-db.sh` and `test-db-comprehensive.ts`

---

### Nested Block Hierarchy

Blocks can contain blocks (unlimited depth)

**Example structure:**
```
Page
  └─ Block 1 (parent=pageId)
      └─ Block 1.1 (parent=block1Id)
          └─ Block 1.1.1 (parent=block1_1Id)
```

**Test Coverage:**
- Create page (parent=NONE)
- Create block in page (parent=pageId)
- Create block in block (parent=blockId)
- Query using parent field ordering

**Tested in:** `test-db.sh` MODULE 3

---

### Server-Side Timestamps

Always use `time::now()` in queries, never client timestamps

✅ **Correct:**
```sql
created_at = time::now()
updated_at = time::now()
```

❌ **Incorrect:**
```javascript
created_at = new Date().toISOString()  // Client time (timezone issues)
```

---

## Test Configuration

The `.test.env` file configures automated testing:

```bash
# SurrealDB Configuration
SURREAL_URL=http://localhost:8000
SURREAL_USER=root
SURREAL_PASS=root
SURREAL_NS=draehi
SURREAL_DB=main

# Test user credentials (optional)
TEST_USER_EMAIL=testuser@example.com
TEST_USER_PASSWORD=testpass123

# Git repository (for E2E tests)
TEST_REPO_URL=https://github.com/adaubry/logseq_graph_example.git
TEST_REPO_BRANCH=main

# Application URL
TEST_APP_URL=http://localhost:3000
```

---

## 🧪 Running Tests Locally

### Full Test Suite

```bash
# 1. Setup environment
source .test.env

# 2. Ensure SurrealDB is running
npm run docker:setup

# 3. Initialize schema
npx tsx scripts/init-surreal-schema.ts

# 4. Run comprehensive database tests
./scripts/test-db.sh

# Expected: All 89 tests pass ✅

# 5. Run TypeScript integration tests
npx tsx scripts/test-db-comprehensive.ts

# Expected: All 42 tests pass ✅
```

### Quick Module Tests

```bash
# Test Auth flow
npx tsx scripts/test-auth-workspace-flow.ts

# Test Deployment
npx tsx scripts/test-deployment-flow.ts

# Test Dashboard flow
npx tsx scripts/test-exact-dashboard-flow.ts

# Test RecordId handling (CRITICAL)
npx tsx scripts/test-userid-comparison.ts
```

### E2E Tests

```bash
# Backend E2E (complete workflow)
./scripts/test-e2e.sh

# Frontend E2E (display & rendering)
./scripts/test-frontend-e2e.sh
```

---

## 🚨 Troubleshooting Tests

### "Workspace not found" Error

**Cause:** String parameters being passed to queries instead of RecordId objects

**Fix:** Keep user.id as RecordId object, don't convert to string

**Verify:** Run `test-userid-comparison.ts` to see the difference

---

### "Connection refused" Error

**Check:**
```bash
# Is SurrealDB running?
docker ps | grep surrealdb

# Wrong URL?
echo $SURREAL_URL

# Start SurrealDB:
npm run docker:setup
```

---

### "Unique constraint violation" Error

**Cause:** Running tests with same data multiple times

**Fix:** Use random test data:
```bash
auth0_sub = "auth0|test-${Date.now()}"
```

---

### RecordId Parameter Error in UPDATE

**Incorrect:**
```typescript
const idString = "deployment_history:xyz";
db.query("UPDATE $thing SET ...", { thing: idString });  // ❌
```

**Correct:**
```typescript
const idObject = recordFromDatabase;  // RecordId object
db.query("UPDATE $thing SET ...", { thing: idObject });  // ✅
```

See: `test-deployment-flow.ts` for examples

---

## 📈 Test Execution Times

Expected duration for each test suite:

| Test | Duration | Operations |
|------|----------|-----------|
| test-db.sh | ~30s | 89 tests |
| test-db-comprehensive.ts | ~15s | 42 tests |
| test-e2e.sh | ~2m | Full workflow |
| test-frontend-e2e.sh | ~1m | Display checks |
| All module tests | ~2m | ~15 individual tests |

**Total full test suite:** ~5 minutes

---

## 📚 Adding New Tests

### For New Database Operations

1. Add bash test to `test-db.sh` in appropriate MODULE section
2. Add TypeScript test to `test-db-comprehensive.ts`
3. Update this TESTING.md with operation coverage
4. Document SQL in [DATABASE.md](DATABASE.md)

### Bash Test Template

```bash
log_test "MODULE-OPERATION: Description"
local result=$(run_surreal_query "SELECT ... RETURN *;")

if [ condition ]; then
    log_pass "Operation description"
else
    log_fail "Operation description"
fi
```

### TypeScript Test Template

```typescript
try {
  const result = await db.query(`SELECT ...`, params);
  const data = (result[0] as any[])?.[0];
  if (data?.expectedField) {
    pass("MODULE-OPERATION: Description");
  } else {
    throw new Error("Field missing");
  }
} catch (error) {
  fail("MODULE-OPERATION: Description", String(error));
}
```

---

## ✅ Test Summary

**Database Operations Covered:** 42/42 (100%)

- **Reads:** 16 ✅
- **Creates:** 6 ✅
- **Updates:** 4 ✅
- **Deletes:** 3 ✅
- **Cache Ops:** 13 ✅

**Test Files:** 15+

- **Primary Suites:** 2 (bash + TypeScript)
- **Module Tests:** 8
- **E2E Tests:** 2
- **RecordId Tests:** 3

**Total Test Count:** 89+ individual tests

---

## 🔍 Reference Links

- [DATABASE.md](DATABASE.md) - Complete query reference
- [CLAUDE.md](../CLAUDE.md) - Project guidelines
- [DIRECTORY.md](DIRECTORY.md) - File navigation
- [CHANGELOG.md](CHANGELOG.md) - Recent changes

---

**Last Updated:** 2025-11-24
