# CRUD Guidelines for Draehi

Modern conventions and best practices for Create, Read, Update, Delete operations in this codebase.

> **Next.js Version:** 16 (using `"use cache"` directive)
> **Last Updated:** 2025-11-16

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Design Principles](#design-principles)
- [CREATE Operations](#create-operations)
- [READ Operations](#read-operations)
- [UPDATE Operations](#update-operations)
- [DELETE Operations](#delete-operations)
- [Error Handling](#error-handling)
- [Performance & Caching](#performance--caching)
- [Security & Authorization](#security--authorization)

---

## Architecture Overview

### Data Layer Structure

```
modules/*/queries.ts        ← Read operations per module
modules/*/actions.ts        ← Write operations per module
modules/*/schema.ts         ← Database schema definitions
app/api/*/route.ts          ← API endpoints
drizzle/                    ← Migrations
```

**Key Principle:** All database operations go through module queries/actions files.

### Database Schema

**Core Tables:**

- `users` - User accounts
- `workspaces` - Top-level workspaces (one per user)
- `nodes` - Unified content (Logseq pages + virtual folders)

---

## Design Principles

### 1. Query Centralization

✅ **DO:** Define read queries in `modules/*/queries.ts`
❌ **DON'T:** Scatter database queries across components

```typescript
// ✅ GOOD - Centralized query
export async function getNodeByPath(workspaceSlug: string, pathSegments: string[]) {
  return await db.query.nodes.findFirst({
    where: and(
      eq(nodes.workspace_id, workspaceId),
      eq(nodes.namespace, namespace),
      eq(nodes.slug, slug)
    ),
  });
}

// ❌ BAD - Query in component
const MyComponent = async () => {
  const data = await db.query.nodes.findFirst({ ... }); // Don't do this!
}
```

### 2. Optimistic Updates with Backups

✅ **DO:** Save backups before mutations, apply changes immediately
❌ **DON'T:** Use pessimistic locking or complex rollback logic

```typescript
// ✅ GOOD - Backup-before-modify pattern
await db.insert(nodeBackups).values({
  node_id: nodeId,
  original_data: JSON.stringify(currentState),
  session_id: sessionId,
});
await db.update(nodes).set({ ...changes });

// ❌ BAD - No backup
await db.update(nodes).set({ ...changes }); // Can't undo!
```

### 3. Performance-First with Caching

✅ **DO:** Cache reads aggressively, invalidate on mutations
❌ **DON'T:** Skip caching or use stale data

```typescript
// ✅ GOOD - Cached query (Next.js 16)
"use cache";

export async function getCachedNodes(workspaceId: string) {
  return await db.query.nodes.findMany({
    where: eq(nodes.workspace_id, workspaceId),
  });
}

// Configure cache behavior
export const revalidate = 7200; // 2 hours

// Then invalidate on mutation
await db.update(nodes).set({ ... });
revalidateTag("nodes");
```

---

## CREATE Operations

### Modern Conventions

1. **Idempotent Upsert** - Check exists before insert/update
2. **Pre-rendered Content** - Store html from Rust export tool
3. **Automatic Fields** - Set `created_at`, `updated_at`, `depth` automatically
4. **Namespace Extraction** - Extract from `page_name` or file path

### Validation Rules

**Required Fields:**

- `workspace_id` - Must be a valid workspace ID the user owns
- `page_name` - Logseq page identifier (e.g., "guides/setup")
- `slug` - Extracted from page_name
- `html` - Pre-rendered HTML content

**Optional Fields:**

- `namespace` - Extracted from page_name (defaults to "")
- `is_journal` - Boolean, true for journal pages
- `journal_date` - Date for journal pages
- `metadata` - Extracted from frontmatter

**Page Name Validation:**

```typescript
// Logseq page_name convention: hierarchical with /
// Example: "guides/setup/intro"
function extractNamespaceAndSlug(pageName: string) {
  const segments = pageName.split("/");
  return {
    slug: segments[segments.length - 1],
    namespace: segments.slice(0, -1).join("/"),
    depth: segments.length - 1,
  };
}
```

---

## READ Operations

### Modern Conventions

1. **Centralized Queries** - All in `src/lib/queries.ts`
2. **Aggressive Caching** - Cache with 2-hour default
3. **Composite Indexes** - Leverage `(workspace_id, namespace, slug)` for O(1) lookups
4. **Lazy Loading** - Load only what's needed, when needed
5. **Breadcrumb Building** - Reconstruct hierarchy from namespace

### Query Patterns

#### Pattern 1: Get Node by Path (O(1) Lookup)

```typescript
export async function getNodeByPath(
  workspaceSlug: string,
  pathSegments: string[]
): Promise<Node | undefined> {
  const workspace = await getworkspaceBySlug(workspaceSlug);
  if (!workspace) return undefined;

  const slug = pathSegments.at(-1) || "";
  const namespace = pathSegments.slice(0, -1).join("/");

  return await db.query.nodes.findFirst({
    where: and(
      eq(nodes.workspace_id, workspace.id),
      eq(nodes.namespace, namespace),
      eq(nodes.slug, slug)
    ),
  });
}
```

**Why O(1)?** Uses composite index, no recursion needed.

#### Pattern 2: Get Children (Single Level)

```typescript
export async function getNodeChildren(
  workspaceId: string,
  namespace: string,
  type?: "file" | "folder"
): Promise<Node[]> {
  const whereConditions = [
    eq(nodes.workspace_id, workspaceId),
    eq(nodes.namespace, namespace),
  ];

  if (type) {
    whereConditions.push(eq(nodes.type, type));
  }

  return await db.query.nodes.findMany({
    where: and(...whereConditions),
    orderBy: [asc(nodes.order), asc(nodes.title)],
  });
}
```

#### Pattern 3: Build Breadcrumbs

```typescript
export async function getNodeBreadcrumbs(node: Node): Promise<Breadcrumb[]> {
  if (!node.namespace) return []; // Root level

  const segments = node.namespace.split("/");
  const breadcrumbs: Breadcrumb[] = [];

  for (let i = 0; i < segments.length; i++) {
    const slug = segments[i];
    const namespace = segments.slice(0, i).join("/");

    const breadcrumbNode = await db.query.nodes.findFirst({
      where: and(
        eq(nodes.workspace_id, node.workspace_id),
        eq(nodes.namespace, namespace),
        eq(nodes.slug, slug)
      ),
    });

    if (breadcrumbNode) {
      breadcrumbs.push({
        title: breadcrumbNode.title,
        slug: breadcrumbNode.slug,
        href: buildNodeHref(node.workspace_id, [...segments.slice(0, i), slug]),
      });
    }
  }

  return breadcrumbs;
}
```

### Caching Strategy

```typescript
// Next.js 16: Use "use cache" directive
"use cache";

export async function getCachedworkspaces() {
  return await db.query.workspaces.findMany({
    orderBy: (workspaces, { asc }) => [asc(workspaces.created_at)],
  });
}

// Configure cache behavior at file level
export const revalidate = 7200; // 2 hours

// Invalidate on mutation
await db.update(nodes).set({ ... });
revalidateTag("workspaces");
```

---

## UPDATE Operations

### Modern Conventions

1. **Backup-Before-Modify** - Always create backup before updates
2. **Cascade Namespace Changes** - Update entire subtree when slug changes
3. **Partial Updates** - Only update provided fields
4. **Metadata Merging** - Merge new metadata with existing

### Example: Updating a Node

**API Endpoint:** `PUT /api/nodes/[id]`

```typescript
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  // 1. Authentication
  const user = await getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Get existing node
  const nodeId = parseInt(params.id);
  const existingNode = await db.query.nodes.findFirst({
    where: eq(nodes.id, nodeId),
  });

  if (!existingNode) {
    return Response.json({ error: "Node not found" }, { status: 404 });
  }

  // 3. Parse updates
  const updates = await req.json();
  const { slug, content, metadata, title } = updates;

  // 4. Create backup
  await db.insert(nodeBackups).values({
    node_id: nodeId,
    workspace_id: existingNode.workspace_id,
    session_id: session.id,
    original_data: JSON.stringify(existingNode),
    created_at: new Date(),
  });

  // 5. Handle slug change (cascades to children)
  if (slug && slug !== existingNode.slug) {
    const oldNamespace = existingNode.namespace
      ? `${existingNode.namespace}/${existingNode.slug}`
      : existingNode.slug;
    const newNamespace = existingNode.namespace
      ? `${existingNode.namespace}/${slug}`
      : slug;

    // Update all children's namespaces
    await db
      .update(nodes)
      .set({
        namespace: sql`replace(${nodes.namespace}, ${oldNamespace}, ${newNamespace})`,
      })
      .where(
        and(
          eq(nodes.workspace_id, existingNode.workspace_id),
          like(nodes.namespace, `${oldNamespace}%`)
        )
      );
  }

  // 6. Update node
  const [updatedNode] = await db
    .update(nodes)
    .set({
      slug: slug || existingNode.slug,
      title: title || existingNode.title,
      content: content !== undefined ? content : existingNode.content,
      metadata: metadata
        ? { ...existingNode.metadata, ...metadata }
        : existingNode.metadata,
      updated_at: new Date(),
    })
    .where(eq(nodes.id, nodeId))
    .returning();

  // 7. Invalidate cache
  revalidateTag(`workspace-${existingNode.workspace_id}`);

  return Response.json(updatedNode);
}
```

### Cascade Update Pattern

When updating a folder's slug, all descendant nodes' namespaces must update:

```typescript
// Old namespace: courses/cs101
// New namespace: courses/cs102

// Before:
// - courses/cs101/week1 → namespace: "courses/cs101"
// - courses/cs101/week1/lecture1 → namespace: "courses/cs101/week1"

// After slug change from cs101 → cs102:
UPDATE nodes
SET namespace = replace(namespace, 'courses/cs101', 'courses/cs102')
WHERE workspace_id = ? AND namespace LIKE 'courses/cs101%';

// After:
// - courses/cs102/week1 → namespace: "courses/cs102"
// - courses/cs102/week1/lecture1 → namespace: "courses/cs102/week1"
```

---

## DELETE Operations

### Modern Conventions

1. **Backup-Before-Delete** - Create backup before deletion
2. **Cascade Deletes** - Database handles child deletion via constraints
3. **Soft Delete Option** - Use `deleted_at` field for soft deletes (future)
4. **Ownership Validation** - Verify user owns the resource

### Example: Deleting a Node

**API Endpoint:** `DELETE /api/nodes/[id]`

```typescript
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  // 1. Authentication
  const user = await getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Get node
  const nodeId = parseInt(params.id);
  const node = await db.query.nodes.findFirst({
    where: eq(nodes.id, nodeId),
  });

  if (!node) {
    return Response.json({ error: "Node not found" }, { status: 404 });
  }

  // 3. Create backup (for undo)
  await db.insert(nodeBackups).values({
    node_id: nodeId,
    workspace_id: node.workspace_id,
    session_id: session.id,
    original_data: JSON.stringify(node),
    operation_type: "delete",
    created_at: new Date(),
  });

  // 4. Delete node (cascades to children via DB constraints)
  await db.delete(nodes).where(eq(nodes.id, nodeId));

  // 5. Invalidate cache
  revalidateTag(`workspace-${node.workspace_id}`);

  return Response.json({ success: true });
}
```

### Soft Delete Pattern (Alternative)

For important data that shouldn't be permanently deleted:

```typescript
// Add to schema
export const nodes = pgTable("nodes", {
  // ... other fields
  deleted_at: timestamp("deleted_at"),
});

// Soft delete
await db
  .update(nodes)
  .set({ deleted_at: new Date() })
  .where(eq(nodes.id, nodeId));

// Filter out soft-deleted in queries
export async function getActiveNodes(workspaceId: string) {
  return await db.query.nodes.findMany({
    where: and(
      eq(nodes.workspace_id, workspaceId),
      isNull(nodes.deleted_at) // Only active nodes
    ),
  });
}
```

---

## Error Handling

### Standard Error Responses

```typescript
// 400 - Bad Request
return Response.json({ error: "Invalid slug format" }, { status: 400 });

// 401 - Unauthorized
return Response.json({ error: "Authentication required" }, { status: 401 });

// 403 - Forbidden
return Response.json({ error: "No active editing session" }, { status: 403 });

// 404 - Not Found
return Response.json({ error: "Node not found" }, { status: 404 });

// 409 - Conflict
return Response.json(
  { error: "Node with this slug already exists" },
  { status: 409 }
);

// 500 - Server Error
return Response.json(
  { error: "Internal server error", details: error.message },
  { status: 500 }
);
```

### Try-Catch Pattern

```typescript
export async function POST(req: Request) {
  try {
    // ... operation
    return Response.json(result);
  } catch (error) {
    console.error("Error creating node:", error);
    return Response.json(
      {
        error: "Failed to create node",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
```

---

## Performance & Caching

### Cache Levels

1. **Function Cache** - `"use cache"` directive (Next.js 16)
2. **React Server Component Cache** - Automatic per-request deduplication
3. **Partial Pre-rendering (PPR)** - Static shell + dynamic content

### Performance Targets

- **Time to First Byte (TTFB):** < 100ms
- **First Contentful Paint (FCP):** < 500ms
- **Largest Contentful Paint (LCP):** < 0.8s
- **API Response Time:** < 100ms

### Optimization Patterns

```typescript
// ✅ Parallel queries
const [workspace, nodes, siblings] = await Promise.all([
  getworkspace(workspaceId),
  getNodes(workspaceId),
  getSiblings(nodeId),
]);

// ❌ Sequential queries (slow)
const workspace = await getworkspace(workspaceId);
const nodes = await getNodes(workspaceId);
const siblings = await getSiblings(nodeId);
```

### Index Strategy

**Required Indexes:**

```sql
-- Composite index for O(1) path lookups
CREATE INDEX idx_nodes_workspace_namespace_slug
ON nodes(workspace_id, namespace, slug);

-- Full-text search
CREATE INDEX idx_nodes_title_gin ON nodes USING GIN(to_tsvector('english', title));
CREATE INDEX idx_nodes_content_gin ON nodes USING GIN(to_tsvector('english', content));

-- Common filters
CREATE INDEX idx_nodes_type ON nodes(type);
CREATE INDEX idx_nodes_updated_at ON nodes(updated_at DESC);
```

---

## Security & Authorization

### Authentication Flow

1. User signs in → creates session cookie
2. Every request checks `getUser()` from session
3. Past user creation there is no user mutation possible

### Authorization Layers

```typescript
// Layer 1: User authentication
const user = await getUser();
if (!user) {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

// Layer 2: Resource ownership
const workspace = await getworkspaceById(workspaceId);
if (workspace.user_id !== user.id) {
  return Response.json({ error: "Forbidden" }, { status: 403 });
}
```

### No Manual CRUD for Users

**CRITICAL PRINCIPLE**: Users cannot manually update resources after creation (except account deletion).

✅ **Allowed Operations:**
- CREATE: User signup (creates user + workspace)
- DELETE: Account deletion (cascades to all data)

❌ **Forbidden Operations:**
- UPDATE: No manual editing of workspace, repository, or node data
- No settings forms for updating existing data

**Auto-Correction Pattern:**

When the system detects incorrect configuration (e.g., wrong Git branch), it must **automatically fix** the issue, not show an error asking the user to update settings.

```typescript
// ❌ BAD - Asking user to fix
if (branchNotFound) {
  return { error: "Branch 'main' not found. Please update your settings." };
}

// ✅ GOOD - Auto-fixing
if (branchNotFound) {
  const defaultBranch = await getDefaultBranch(repoUrl, token);
  if (defaultBranch.success) {
    // Auto-correct and persist
    await updateRepository(workspaceId, { branch: defaultBranch.branch });
    console.log(`Auto-corrected branch to '${defaultBranch.branch}'`);
    // Continue with correct branch
  }
}
```

**Git Sync Example:**

When user connects repository with branch "main" but repository uses "master":
1. System detects branch mismatch
2. Auto-detects default branch ("master")
3. Uses correct branch for clone
4. Persists corrected branch to database
5. Logs correction for transparency
6. ✅ User never sees error or settings form

### Input Sanitization

```typescript
import { sanitizeHtml } from "@/lib/sanitize";

// Sanitize user input before storage
const sanitizedContent = sanitizeHtml(content);

// Validate slugs
function validateSlug(slug: string): boolean {
  if (slug.length > 100) return false;
  if (!/^[a-z0-9-]+$/.test(slug)) return false;
  if (slug.startsWith("-") || slug.endsWith("-")) return false;
  if (slug.contains(" ")) return false;
  return true;
}
```

## Quick Reference

### CRUD Checklist

**CREATE:**

- [ ] Validate authentication
- [ ] Validate input (slug format, required fields)
- [ ] Calculate depth from namespace
- [ ] Use upsert pattern
- [ ] Create backup
- [ ] Invalidate cache
- [ ] Return created resource

**READ:**

- [ ] Define query in `queries.ts`
- [ ] Use composite indexes
- [ ] Wrap with relevant cache
- [ ] Set appropriate revalidation time
- [ ] Add cache tags for invalidation
- [ ] Handle not found cases
- [ ] Return typed data

**UPDATE:**

- [ ] Validate authentication
- [ ] Verify resource exists
- [ ] Create backup before update
- [ ] Handle slug changes (cascade)
- [ ] Merge metadata (don't overwrite)
- [ ] Update `updated_at` timestamp
- [ ] Invalidate cache
- [ ] Return updated resource

**DELETE:**

- [ ] Validate authentication
- [ ] Verify resource exists
- [ ] Create backup
- [ ] Delete resource (cascades handled by DB)
- [ ] Invalidate cache
- [ ] Return success confirmation

---

## Additional Resources

- [Performance Optimization Guide](./PERFORMANCE_REVAMP.md)

---

**Last Updated:** 2025-11-23
