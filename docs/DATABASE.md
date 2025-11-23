# Database Guide

Comprehensive guide to how Draehi uses SurrealDB + KeyDB for data storage.

**Last Updated:** 2025-11-23

---

## Overview

**Stack:**
- **Structured Data:** SurrealDB (document/graph database)
- **HTML Cache:** KeyDB (Redis-compatible, high-performance)
- **Object Storage:** MinIO (S3-compatible)

**Key Principles:**
- Modular schemas (one per module)
- Internal CRUD only (no user-facing DB operations except signup)
- Graph relations for user → workspace → nodes hierarchy
- HTML content cached in KeyDB for sub-ms reads
- React `cache()` for request deduplication

---

## Architecture

### Why SurrealDB + KeyDB?

1. **SurrealDB** - Document/graph hybrid
   - Record links for relationships (no JOINs needed)
   - Flexible schema with TypeScript typing
   - Graph traversal for hierarchy queries

2. **KeyDB** - Redis fork optimized for speed
   - Pre-rendered HTML stored in memory
   - Multi-threaded (faster than Redis)
   - Batch operations for ingestion

### Data Flow

```
User Request → Next.js → SurrealDB (metadata) + KeyDB (HTML) → Response
                              ↓
                         Record Links
                              ↓
                   users → workspaces → nodes
```

---

## Configuration

### Environment Variables

```bash
# .env.local
SURREAL_URL=http://localhost:8000
SURREAL_USER=root
SURREAL_PASS=root
SURREAL_NS=draehi
SURREAL_DB=main

KEYDB_URL=redis://localhost:6379
```

### SurrealDB Client

```typescript
// lib/surreal.ts
import Surreal from "surrealdb";

export async function getSurreal(): Promise<Surreal>;
export async function query<T>(sql: string, vars?: Record<string, unknown>): Promise<T[]>;
export async function queryOne<T>(sql: string, vars?: Record<string, unknown>): Promise<T | null>;
export async function create<T>(table: string, data: Record<string, unknown>): Promise<T>;
export async function update<T>(thing: string, data: Record<string, unknown>): Promise<T>;
export async function remove(thing: string): Promise<void>;
```

### KeyDB Client

```typescript
// lib/keydb.ts
export async function setBlockHTML(workspaceId: string, uuid: string, html: string): Promise<void>;
export async function getBlockHTML(workspaceId: string, uuid: string): Promise<string | null>;
export async function setBlockHTMLBatch(workspaceId: string, blocks: Array<{uuid: string, html: string}>): Promise<void>;
export async function clearWorkspaceCache(workspaceId: string): Promise<void>;
```

---

## Schema Architecture

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

### SurrealDB Record IDs

SurrealDB uses `table:id` format:
- `users:abc123`
- `workspaces:xyz789`
- `nodes:uuid-here`

---

## Schema Definitions

### 1. users

```typescript
export interface User {
  id: string;       // users:xxx
  username: string;
  password: string; // bcrypt hashed
  created_at: string;
}
```

### 2. workspaces

```typescript
export interface Workspace {
  id: string;          // workspaces:xxx
  user: string;        // Record link to users:xxx
  slug: string;
  name: string;
  domain?: string;
  embed_depth: number;
  created_at: string;
  updated_at: string;
}
```

### 3. nodes

```typescript
export interface Node {
  id: string;          // nodes:uuid
  workspace: string;   // Record link to workspaces:xxx
  parent?: string;     // Record link to nodes:xxx (NULL = page)
  order: number;
  page_name: string;
  slug: string;
  title: string;
  metadata?: {
    tags?: string[];
    properties?: Record<string, unknown>;
  };
  created_at: string;
  updated_at: string;
}

// NOTE: HTML is stored in KeyDB, not SurrealDB!
export interface NodeWithHTML extends Node {
  html?: string | null;
}
```

### 4. git_repositories

```typescript
export interface GitRepository {
  id: string;
  workspace: string;
  repo_url: string;
  branch: string;
  deploy_key?: string;
  sync_status: string; // idle, syncing, success, error
  created_at: string;
  updated_at: string;
}
```

### 5. deployment_history

```typescript
export interface Deployment {
  id: string;
  workspace: string;
  commit_sha: string;
  status: string;    // pending, building, success, failed
  deployed_at: string;
  build_log?: string[];
}
```

---

## KeyDB Key Patterns

| Pattern | Purpose |
|---------|---------|
| `workspace:{id}:block:{uuid}` | Block HTML content |
| `workspace:{id}:page:{name}:blocks` | Ordered block UUIDs |

---

## Query Patterns

### Read Operations

```typescript
"use server";
import { queryOne, selectOne } from "@/lib/surreal";
import { cache } from "react";

export const getUserById = cache(async (id: string): Promise<User | null> => {
  return await selectOne<User>(`users:${id}`);
});

export const getUserByUsername = cache(async (username: string): Promise<User | null> => {
  return await queryOne<User>(
    "SELECT * FROM users WHERE username = $username LIMIT 1",
    { username }
  );
});
```

### Write Operations

```typescript
"use server";
import { create, update, remove } from "@/lib/surreal";

export async function createUser(username: string, password: string) {
  const existing = await getUserByUsername(username);
  if (existing) return { error: "Username exists" };

  const user = await create<User>("users", { username, password: hashedPassword });
  return { user };
}
```

---

## Docker Setup

### One-Command Start

```bash
npm run docker:setup    # Start services
npm run docker:stop     # Stop services
npm run docker:clean    # Reset and restart
```

### Services

| Service | Port | Purpose |
|---------|------|---------|
| SurrealDB | 8000 | Document/graph database |
| KeyDB | 6379 | HTML cache |
| MinIO | 9000/9001 | Object storage |

---

## Summary

| Aspect | Pattern |
|--------|---------|
| **Structured Data** | SurrealDB with record links |
| **HTML Cache** | KeyDB with batch operations |
| **Schema Location** | `modules/*/schema.ts` |
| **Read Operations** | `modules/*/queries.ts` with `cache()` |
| **Write Operations** | `modules/*/actions.ts` |
| **Docker Setup** | `npm run docker:setup` |

---

**Last Updated:** 2025-11-23
