# Directory Structure

Guide to navigating Draehi's modular monolith architecture.

**Last Updated:** 2025-11-16

---

## Root Directory

```
draehi/
├── app/                    # Next.js App Router (frontend layer)
├── modules/                # Modular Monolith (business logic)
├── components/             # React components
├── lib/                    # Shared utilities
├── drizzle/                # Database migrations
├── docs/                   # Documentation
├── public/                 # Static assets
└── [config files]          # Project configuration
```

---

## `/app` - Next.js App Router

**Purpose:** Frontend layer, routing, API endpoints

```
app/
├── (auth)/                 # Auth route group
│   ├── login/             # Login page ✅
│   │   └── page.tsx
│   └── signup/            # Signup page ✅
│       └── page.tsx
├── (dashboard)/           # Dashboard route group (protected) ✅
│   ├── layout.tsx         # Dashboard layout with nav
│   ├── page.tsx           # Main dashboard
│   ├── actions.ts         # Manual deployment trigger
│   └── settings/          # Workspace settings ✅
│       └── page.tsx       # Repository connection form
├── [workspaceSlug]/       # Public workspace viewer ✅ Phase 4
│   ├── layout.tsx         # Workspace layout with sidebar
│   ├── page.tsx           # Index page with auto-redirect
│   └── [...path]/         # Catch-all for nested pages ✅
│       └── page.tsx       # Dynamic page renderer
├── api/                   # API routes
│   └── webhooks/          # Git webhook handlers
│       └── github/        # GitHub webhooks ✅
│           └── route.ts   # Webhook endpoint
├── page.tsx               # Landing page ✅
├── layout.tsx             # Root layout
├── loading.tsx            # Global loading state
└── error.tsx              # Global error boundary
```

**Key Routes:**
- `/` - Landing page (marketing) ✅
- `/login` - User login ✅
- `/signup` - User signup ✅
- `/dashboard` - User dashboard (protected) ✅
- `/dashboard/settings` - Repository connection ✅
- `/api/webhooks/github` - GitHub webhook handler ✅
- `/:workspaceSlug` - Public workspace home ✅ Phase 4
- `/:workspaceSlug/:path1/:path2/...` - Nested pages (unlimited depth) ✅ Phase 4

---

## `/modules` - Modular Monolith

**Purpose:** Business logic, isolated modules

### Overview

Each module is self-contained with:
- `schema.ts` - Database schema (Drizzle)
- `queries.ts` - Read operations
- `actions.ts` - Write operations (Server Actions)
- `types.ts` - TypeScript types
- `utils.ts` - Module-specific utilities

```
modules/
├── auth/                   # Authentication & authorization ✅
│   ├── schema.ts          # users table
│   ├── queries.ts         # getUserById, getUserByUsername, verifyPassword
│   ├── actions.ts         # createUser, hashPassword
│   ├── session-actions.ts # login, signup, logout
│   └── types.ts           # User type
├── workspace/             # Workspace management ✅
│   ├── schema.ts          # workspaces table
│   ├── queries.ts         # getWorkspaceByUserId, getWorkspaceBySlug
│   ├── actions.ts         # createWorkspace, updateWorkspace
│   └── types.ts           # Workspace type
├── content/               # Content/Nodes module ✅
│   ├── schema.ts          # nodes table
│   ├── queries.ts         # getNode, getNodeChildren, getBreadcrumbs
│   ├── actions.ts         # (internal only - no user mutations)
│   └── types.ts           # Node, Breadcrumb types
├── git/                   # Git integration ✅
│   ├── schema.ts          # git_repositories, deployment_history
│   ├── queries.ts         # getRepositoryByWorkspaceId, getDeployments
│   ├── actions.ts         # connectRepository, updateRepository, createDeployment
│   ├── clone.ts           # Git clone/cleanup logic (shell commands)
│   └── sync.ts            # Repository sync orchestration
├── logseq/                # Logseq graph processing ✅ Phase 3
│   ├── export.ts          # Call Rust export-logseq-notes
│   ├── parse.ts           # Parse Rust output
│   └── types.ts           # Logseq-specific types
└── storage/               # Asset storage ✅ Phase 3
    ├── s3.ts              # S3 client (MinIO/AWS)
    └── upload.ts          # Asset upload logic
```

**Module Dependencies:**
- `auth` → no dependencies
- `workspace` → depends on `auth`
- `content` → depends on `workspace`
- `git` → depends on `workspace`, `content`, `logseq`
- `logseq` → depends on `content`

---

## `/components` - React Components

**Purpose:** Reusable UI components

```
components/
├── ui/                     # shadcn/ui base components (Vercel-style)
│   ├── button.tsx         # Button component
│   ├── input.tsx          # Input component
│   ├── card.tsx           # Card component
│   ├── skeleton.tsx       # Loading skeleton
│   └── ...                # Other primitives
├── viewer/                # Public viewer components ✅ Phase 4
│   ├── Sidebar.tsx        # Hierarchical tree navigation
│   ├── Breadcrumbs.tsx    # Path breadcrumb navigation
│   └── NodeContent.tsx    # HTML renderer with prose styling
├── workspace/             # Workspace-specific components (future)
│   ├── page-list.tsx      # List of pages
│   └── search.tsx         # Search component
├── content/               # Content rendering components (future)
│   ├── code-block.tsx     # Syntax-highlighted code
│   └── image-viewer.tsx   # Optimized image display
└── dashboard/             # Dashboard components (future)
    ├── deployment-card.tsx
    ├── repo-connection.tsx
    └── settings-form.tsx
```

**Component Guidelines:**
- Default to Server Components
- Use "use client" only for interactivity
- Follow Vercel design aesthetic
- Mobile-first (320px minimum)

---

## `/lib` - Shared Utilities

**Purpose:** Cross-module utilities, shared logic

```
lib/
├── db.ts                   # Drizzle database client ✅
├── session.ts              # Session management (iron-session) ✅
├── utils.ts                # General utilities (namespace extraction, slug generation) ✅
├── types.ts                # Shared TypeScript types ✅
├── queries.ts              # Centralized query functions (future)
├── cache.ts                # Caching utilities (future)
├── validation.ts           # Zod schemas for validation (future)
└── constants.ts            # App-wide constants (future)
```

**Key Files:**
- `db.ts` - Single database connection, allows build without DATABASE_URL
- `session.ts` - Session helpers (getSession, getCurrentUser, requireAuth)
- `utils.ts` - Namespace extraction, slug generation (cn, extractNamespaceAndSlug)

---

## `/drizzle` - Database Migrations

**Purpose:** Database version control

```
drizzle/
├── migrations/             # Auto-generated migrations
│   ├── 0000_init.sql
│   ├── 0001_add_git.sql
│   └── ...
├── meta/                   # Migration metadata
└── schema.ts               # Aggregated schema (generated)
```

**Migration Workflow:**
1. Edit schema in `modules/*/schema.ts`
2. Run `drizzle-kit generate` to create migration
3. Run `drizzle-kit migrate` to apply
4. Commit migration files

---

## `/docs` - Documentation

**Purpose:** Project documentation for humans and AI

```
docs/
├── CHANGELOG.md            # Version history, changes log
├── ROADMAP.md              # Development phases, future plans
├── DIRECTORY.md            # This file (project navigation)
├── CRUD_GUIDELINES.md      # CRUD operation patterns
├── PERFORMANCE_GUIDELINES.md  # Performance optimization guide
└── conversation.md         # Original vision/conversation
```

**Documentation Philosophy:**
- Precise context for AI agents
- Up-to-date with codebase
- Mandatory updates before commits

---

## `/public` - Static Assets

**Purpose:** Static files served directly

```
public/
├── images/                 # Static images
├── fonts/                  # Custom fonts
└── favicon.ico             # Favicon
```

---

## Configuration Files

**Root-level config files:**

| File | Purpose |
|------|---------|
| `CLAUDE.md` | AI agent instructions (this location) |
| `README.md` | User-facing documentation |
| `package.json` | Dependencies, scripts |
| `tsconfig.json` | TypeScript configuration |
| `next.config.ts` | Next.js configuration |
| `tailwind.config.ts` | Tailwind CSS v4 configuration |
| `drizzle.config.ts` | Drizzle ORM configuration |
| `eslint.config.mjs` | ESLint rules |
| `postcss.config.mjs` | PostCSS configuration |
| `.env.local` | Environment variables (not committed) |
| `.gitignore` | Git ignore rules |

---

## Finding Things

**Looking for...**

- **Database schema?** → `modules/*/schema.ts`
- **Read queries?** → `modules/*/queries.ts` or `lib/queries.ts`
- **Write operations?** → `modules/*/actions.ts`
- **UI components?** → `components/ui/*`
- **API endpoints?** → `app/api/*`
- **Page routes?** → `app/*/page.tsx`
- **Types?** → `modules/*/types.ts` or `lib/types.ts`
- **Utilities?** → `lib/utils.ts`
- **Documentation?** → `docs/*`

**Working on a feature?**

1. Identify the module (e.g., git integration → `modules/git/`)
2. Update schema if needed
3. Add queries/actions
4. Create UI components
5. Wire up in `app/` routes
6. Update CHANGELOG.md

---

## Module Interaction Example

**User triggers deployment:**

1. **User pushes to Git** → Webhook fires
2. **`app/api/webhooks/github/route.ts`** → Receives webhook
3. **`modules/git/webhook.ts`** → Validates webhook
4. **`modules/git/actions.ts`** → Triggers deployment
5. **`modules/git/sync.ts`** → Pulls latest changes
6. **`modules/logseq/export.ts`** → Runs Rust tool
7. **`modules/logseq/parse.ts`** → Parses output
8. **`modules/logseq/ingest.ts`** → Stores in database
9. **`modules/content/actions.ts`** → Updates nodes
10. **Cache invalidation** → `revalidateTag("workspace-123")`
11. **`modules/git/actions.ts`** → Records deployment history

---

**Last Updated:** 2025-11-16
**Status:** Phase 4 Complete - Public Viewer live, Phases 0-4 done
