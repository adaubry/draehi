# Database Guide

Comprehensive guide to how Draehi uses PostgreSQL with Drizzle ORM.

**Last Updated:** 2025-11-23

---

## Overview

**Stack:**
- **Database:** PostgreSQL (Neon recommended)
- **ORM:** Drizzle ORM
- **Driver:** postgres.js
- **Migrations:** Drizzle Kit

**Key Principles:**
- Modular schemas (one per module)
- Internal CRUD only (no user-facing DB operations except signup)
- Cascading deletes for data integrity
- React `cache()` for request deduplication
- JSONB for flexible metadata

---

## Configuration

### Drizzle Config

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./modules/*/schema.ts",  // All module schemas
  out: "./drizzle/migrations",       // Migration output
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
});
```

### Database Client

```typescript
// lib/db.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as authSchema from "@/modules/auth/schema";
import * as workspaceSchema from "@/modules/workspace/schema";
import * as contentSchema from "@/modules/content/schema";
import * as gitSchema from "@/modules/git/schema";

const client = postgres(process.env.DATABASE_URL || "");

export const db = drizzle(client, {
  schema: {
    ...authSchema,
    ...workspaceSchema,
    ...contentSchema,
    ...gitSchema,
  },
});

export type DbClient = typeof db;
```

**Build-time Behavior:** Allows build without `DATABASE_URL` (uses placeholder). Fails at runtime if not set.

---

## Schema Architecture

### Tables Overview

```
users
  └── workspaces (1:1, cascade delete)
        ├── git_repositories (1:1, cascade delete)
        ├── deployment_history (1:many, cascade delete)
        └── nodes (1:many, cascade delete)
              └── nodes (self-ref parent_uuid, cascade delete)
```

### Entity Relationship

```
┌─────────┐     ┌─────────────┐     ┌────────────────┐
│  users  │────→│ workspaces  │────→│git_repositories│
└─────────┘     └─────────────┘     └────────────────┘
     1:1              │                    1:1
                      │
            ┌─────────┴─────────┐
            │                   │
            ▼                   ▼
     ┌───────────┐    ┌──────────────────┐
     │   nodes   │    │deployment_history│
     └───────────┘    └──────────────────┘
           │                 1:many
           │ self-ref
           ▼
     ┌───────────┐
     │   nodes   │ (blocks)
     └───────────┘
```

---

## Schema Definitions

### 1. users

```typescript
// modules/auth/schema.ts
export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(), // bcrypt hashed
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

**Notes:**
- Auto-increment ID via `generatedAlwaysAsIdentity()`
- Password stored as bcrypt hash
- One user → one workspace (enforced at workspace level)

### 2. workspaces

```typescript
// modules/workspace/schema.ts
export const workspaces = pgTable("workspaces", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),  // One workspace per user
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  domain: text("domain"),  // Custom domain (future)
  embedDepth: integer("embed_depth").notNull().default(5),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

**Notes:**
- `userId` unique constraint → one workspace per user
- `slug` used in public URLs (`/{slug}/page-name`)
- Cascading delete from users

### 3. nodes

```typescript
// modules/content/schema.ts
export const nodes = pgTable(
  "nodes",
  {
    uuid: text("uuid").primaryKey(),  // UUID as primary key
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    // Hierarchy
    parentUuid: text("parent_uuid").references((): any => nodes.uuid, {
      onDelete: "cascade",
    }),  // NULL = page, NOT NULL = block
    order: integer("order").notNull().default(0),

    // Identification
    pageName: text("page_name").notNull(),  // e.g., "guides/setup/intro"
    slug: text("slug").notNull(),           // e.g., "intro"

    // Content
    title: text("title").notNull(),
    html: text("html"),  // NULL for pages, HTML for blocks
    metadata: json("metadata").$type<{
      tags?: string[];
      properties?: Record<string, unknown>;
      frontmatter?: Record<string, unknown>;
    }>(),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    parentOrderIdx: index("parent_order_idx").on(table.parentUuid, table.order),
    workspacePageNameIdx: index("workspace_pagename_idx").on(
      table.workspaceId,
      table.pageName
    ),
  })
);
```

**Key Design:**
- **UUID as PK:** Stable, deterministic UUIDs based on content (SHA256 hash of `workspaceId::pageName`)
- **Unified pages + blocks:** Same table, differentiated by `parentUuid`
  - `parentUuid = NULL` → page node
  - `parentUuid != NULL` → block node
- **HTML storage:** Pre-rendered HTML for blocks, NULL for pages
- **JSONB metadata:** Flexible storage for tags, properties, frontmatter

### 4. git_repositories

```typescript
// modules/git/schema.ts
export const gitRepositories = pgTable("git_repositories", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: integer("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" })
    .unique(),  // One repo per workspace
  repoUrl: text("repo_url").notNull(),
  branch: text("branch").notNull().default("main"),
  deployKey: text("deploy_key"),  // GitHub token
  lastSync: timestamp("last_sync"),
  syncStatus: text("sync_status").notNull().default("idle"),
  errorLog: text("error_log"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

**Sync Status Values:** `idle`, `syncing`, `success`, `error`

### 5. deployment_history

```typescript
// modules/git/schema.ts
export const deploymentHistory = pgTable("deployment_history", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: integer("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  commitSha: text("commit_sha").notNull(),
  status: text("status").notNull(),
  deployedAt: timestamp("deployed_at").notNull().defaultNow(),
  errorLog: text("error_log"),
  buildLog: json("build_log").$type<string[]>(),
});
```

**Status Values:** `pending`, `building`, `success`, `failed`

---

## Indexes

### Defined Indexes

| Index | Table | Columns | Purpose |
|-------|-------|---------|---------|
| `parent_order_idx` | nodes | (parent_uuid, order) | Sibling ordering |
| `workspace_pagename_idx` | nodes | (workspace_id, page_name) | Page/block lookups |

### Implicit Indexes

- Primary keys (auto-indexed)
- Unique constraints: `users.username`, `workspaces.slug`, `workspaces.user_id`, `git_repositories.workspace_id`

---

## Query Patterns

### File Organization

```
modules/
├── auth/
│   ├── schema.ts    # Table definition
│   ├── queries.ts   # Read operations
│   └── actions.ts   # Write operations
├── workspace/
│   ├── schema.ts
│   ├── queries.ts
│   └── actions.ts
└── ...
```

### Read Operations (queries.ts)

All reads use Drizzle's relational query API with React `cache()`:

```typescript
"use server";

import { db } from "@/lib/db";
import { users } from "./schema";
import { eq } from "drizzle-orm";
import { cache } from "react";

// Basic lookup
export const getUserById = cache(async (id: number) => {
  return await db.query.users.findFirst({
    where: eq(users.id, id),
  });
});

// Multiple conditions
export const getNodeByPath = cache(
  async (workspaceId: number, pathSegments: string[]) => {
    const pages = await db.query.nodes.findMany({
      where: and(
        eq(nodes.workspaceId, workspaceId),
        isNull(nodes.parentUuid)
      ),
    });
    // ... filtering logic
  }
);

// List with ordering and limit
export const getDeployments = cache(async (workspaceId: number, limit = 10) => {
  return await db.query.deploymentHistory.findMany({
    where: eq(deploymentHistory.workspaceId, workspaceId),
    orderBy: [desc(deploymentHistory.deployedAt)],
    limit,
  });
});
```

**Key Patterns:**
- All queries wrapped with `cache()` for request deduplication
- Use `findFirst()` for single records, `findMany()` for lists
- Operators: `eq`, `and`, `isNull`, `isNotNull`, `desc`

### Write Operations (actions.ts)

All writes use Server Actions with idempotent patterns:

```typescript
"use server";

import { db } from "@/lib/db";
import { users } from "./schema";
import { eq } from "drizzle-orm";

// Create with existence check
export async function createUser(username: string, password: string) {
  const existing = await getUserByUsername(username);
  if (existing) {
    return { error: "Username already exists" };
  }

  const [user] = await db
    .insert(users)
    .values({ username, password: hashedPassword })
    .returning();

  return { user };
}

// Update with returning
export async function updateWorkspace(id: number, data: { name?: string }) {
  const [workspace] = await db
    .update(workspaces)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(workspaces.id, id))
    .returning();

  return { workspace };
}

// Delete (cascades handle related records)
export async function deleteUser(userId: number) {
  await db.delete(users).where(eq(users.id, userId));
  return { success: true };
}
```

**Key Patterns:**
- Check existence before insert (idempotent)
- Always use `.returning()` to get inserted/updated record
- Return `{ error }` objects, never throw
- Cascading deletes handle related records automatically

### Batch Operations

For large inserts (nodes), batch to avoid PostgreSQL parameter limit:

```typescript
const BATCH_SIZE = 1000;  // ~15 fields × 1000 = 15000 params (limit: 65534)

for (let i = 0; i < allNodes.length; i += BATCH_SIZE) {
  const batch = allNodes.slice(i, i + BATCH_SIZE);
  await db.insert(nodes).values(batch).returning();
}
```

---

## Cascading Deletes

Deletion cascade chain:

```
DELETE user
  └── DELETE workspaces (ON DELETE CASCADE)
        ├── DELETE git_repositories (ON DELETE CASCADE)
        ├── DELETE deployment_history (ON DELETE CASCADE)
        └── DELETE nodes (ON DELETE CASCADE)
              └── DELETE child nodes (ON DELETE CASCADE via parent_uuid)
```

**Result:** Deleting a user removes all associated data automatically.

---

## Type Safety

### Inferred Types

```typescript
// modules/auth/schema.ts
export type User = typeof users.$inferSelect;    // Read type
export type NewUser = typeof users.$inferInsert; // Insert type
```

### JSONB Typing

```typescript
metadata: json("metadata").$type<{
  tags?: string[];
  properties?: Record<string, unknown>;
  frontmatter?: Record<string, unknown>;
}>(),
```

---

## Migrations

### Commands

```bash
# Generate migration from schema changes
npm run db:generate

# Push schema directly (development)
npm run db:push

# Open Drizzle Studio (database GUI)
npm run db:studio
```

### Migration Files

Located in `drizzle/migrations/`:

```
drizzle/migrations/
├── 0000_simple_giant_man.sql      # Initial schema
├── 0001_special_fabian_cortez.sql # Schema update
├── 0002_drop_namespace_depth.sql  # Remove columns
└── meta/                          # Migration metadata
```

### Migration Workflow

1. Edit schema in `modules/*/schema.ts`
2. Run `npm run db:generate` to create migration
3. Review generated SQL in `drizzle/migrations/`
4. Run `npm run db:push` to apply
5. Commit migration files

---

## Environment Setup

### Required Variables

```bash
# .env.local
DATABASE_URL=postgresql://user:password@host:5432/database
```

### Recommended Providers

| Provider | Best For | Notes |
|----------|----------|-------|
| **Neon** | Development, production | Free tier, serverless |
| **Supabase** | Full-stack needs | Includes auth, storage |
| **Local PostgreSQL** | Offline development | Install via Homebrew/apt |

### Connection String Format

```
postgresql://user:password@host:port/database?sslmode=require
```

---

## Performance Considerations

### Query Optimization

1. **Use indexes:** Queries filter by indexed columns
2. **Limit results:** Always use `limit` on list queries
3. **Cache with React:** All queries wrapped in `cache()`

### Index Usage Examples

```typescript
// Uses workspace_pagename_idx
await db.query.nodes.findMany({
  where: and(
    eq(nodes.workspaceId, workspaceId),  // First column
    eq(nodes.pageName, pageName)          // Second column
  ),
});

// Uses parent_order_idx
await db.query.nodes.findMany({
  where: eq(nodes.parentUuid, pageUuid),
  orderBy: [nodes.order],
});
```

### Batch Insert Performance

```typescript
// BAD: Individual inserts
for (const node of nodes) {
  await db.insert(nodes).values(node);  // N round trips
}

// GOOD: Batch insert
await db.insert(nodes).values(allNodes);  // 1 round trip
```

---

## Common Queries

### Get all pages for a workspace

```typescript
const pages = await db.query.nodes.findMany({
  where: and(
    eq(nodes.workspaceId, workspaceId),
    isNull(nodes.parentUuid)  // Pages have no parent
  ),
  orderBy: [nodes.pageName],
});
```

### Get all blocks for a page

```typescript
const blocks = await db.query.nodes.findMany({
  where: and(
    eq(nodes.workspaceId, workspaceId),
    eq(nodes.pageName, pageName),
    isNotNull(nodes.parentUuid)  // Blocks have parent
  ),
  orderBy: [nodes.order],
});
```

### Find backlinks to a page

```typescript
// Find blocks referencing [[pageName]]
const allBlocks = await db.query.nodes.findMany({
  where: and(
    eq(nodes.workspaceId, workspaceId),
    isNotNull(nodes.parentUuid)
  ),
});

const referencingBlocks = allBlocks.filter(block =>
  block.html?.includes(`data-page="${pageName}"`)
);
```

---

## Troubleshooting

### "Database connection failed"

1. Check `DATABASE_URL` is set
2. Verify database server is running
3. Check credentials and host/port

### "Build fails without DATABASE_URL"

Expected behavior - the app builds with a placeholder. Set `DATABASE_URL` before running.

### "Parameter limit exceeded"

Batch large inserts:
```typescript
const BATCH_SIZE = 1000;
for (let i = 0; i < items.length; i += BATCH_SIZE) {
  await db.insert(table).values(items.slice(i, i + BATCH_SIZE));
}
```

### "Foreign key constraint failed"

Check cascade order - parent records must exist before children.

---

## Summary

| Aspect | Pattern |
|--------|---------|
| **Schema Location** | `modules/*/schema.ts` |
| **Read Operations** | `modules/*/queries.ts` with `cache()` |
| **Write Operations** | `modules/*/actions.ts` with `"use server"` |
| **Type Safety** | `$inferSelect`, `$inferInsert`, `.$type<T>()` |
| **Migrations** | `npm run db:generate`, `npm run db:push` |
| **Cascading** | All FKs use `onDelete: "cascade"` |
| **Batch Inserts** | Batch size 1000 to avoid param limit |

---

**Last Updated:** 2025-11-23
