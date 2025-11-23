# Testing Guide

Guide for testing Draehi end-to-end with Logseq features.

## Quick Start

### Automated E2E Tests

**One-time setup:**

```bash
# Copy test config template
cp .test.env.example .test.env

# (Optional) Edit .test.env to customize test credentials
```

**Run tests:**

```bash
# Backend E2E test suite (ingestion & database)
./scripts/test-e2e.sh

# Frontend E2E test suite (display & rendering)
./scripts/test-frontend-e2e.sh
```

**Backend test automates:**
- Database schema setup
- Test user creation
- Test workspace creation
- Git repository connection
- Content validation

**Frontend test validates:**
- Pages load correctly (HTTP 200)
- Blocks display (no errors)
- URL encoding for spaces works
- Page references render as clickable links
- Block hierarchy displays with nesting
- Task markers styled correctly
- CSS stylesheets loaded

---

## Test Configuration

The `.test.env` file configures automated testing:

```bash
# Test user credentials
TEST_USER_EMAIL=testuser@example.com
TEST_USER_PASSWORD=testpass123
TEST_USER_NAME=Test User
TEST_WORKSPACE_SLUG=testuser

# Git repository (points to test data)
TEST_REPO_PATH=/path/to/draehi/test-data/logseq-docs-graph
TEST_REPO_BRANCH=master

# Application URL
TEST_APP_URL=http://localhost:3000
```

---

## Logseq Structure Comparison

**Validate database structure matches Logseq docs:**

```bash
npx tsx scripts/compare-with-logseq.ts
```

**What it checks:**
- Total page count
- Non-journal page count
- Journal count
- Key pages exist (contents, Tutorial, etc.)
- Pages have meaningful content
- Blocks have UUIDs
- Blocks have HTML rendered
- Block parent relationships

---

## Manual Test Flow

### 1. Environment Setup

```bash
# Ensure .env.local is configured
cp .env.example .env.local

# Set DATABASE_URL
echo "DATABASE_URL=postgresql://..." >> .env.local

# Push database schema
npm run db:push
```

### 2. Start Development Server

```bash
npm run dev
```

### 3. Create Test User

1. Visit `http://localhost:3000/signup`
2. Create user with desired credentials
3. Workspace created automatically on signup

### 4. Connect Test Graph

1. Visit dashboard
2. Connect Git repository
3. Wait for sync to complete

### 5. Verify Content

Visit workspace at: `http://localhost:3000/{workspace-slug}`

---

## UI Testing Checklist

### Navigation Tests

- [ ] Sidebar shows all pages
- [ ] Sidebar shows journal section
- [ ] Clicking page in sidebar navigates correctly
- [ ] Breadcrumbs show for nested pages
- [ ] Mobile sidebar toggle works

### Page Reference Tests

- [ ] `[[page]]` renders as blue link
- [ ] Clicking navigates to correct page
- [ ] Hover changes style

### Block Reference Tests

- [ ] `((uuid))` renders as styled reference
- [ ] Clicking scrolls to target block
- [ ] Target block highlights

### Task Marker Tests

- [ ] **TODO** - Yellow background
- [ ] **DOING** - Blue background
- [ ] **DONE** - Green background, strikethrough
- [ ] **LATER** - Gray background
- [ ] **NOW** - Red background

### Block Tree Tests

- [ ] Nested blocks render with indentation
- [ ] Clicking bullet collapses/expands children
- [ ] Block navigation works

---

## Troubleshooting

### Sync Fails

**Check:**
1. Repository URL correct
2. Branch exists
3. View server console for errors

### No Content After Sync

**Check:**
```bash
# Verify export-logseq-notes installed
which export-logseq-notes
```

### Page References Not Clickable

**Check:**
1. View page source for `class="page-reference"`
2. CSS loaded (check Network tab)

---

## Test Coverage

**Current Coverage:**

- Database Layer: CRUD operations, migrations
- Git Integration: Clone, sync, webhooks
- Logseq Processing: Markdown parsing, block hierarchy, references
- Reference Processing: Page refs, block refs, task markers
- UI Rendering: Block tree, breadcrumbs, sidebar, styling

---

**Last Updated:** 2025-11-23
