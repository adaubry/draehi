# Directory Structure

Guide to navigating Draehi's modular monolith architecture.

**Last Updated:** 2025-11-23

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
├── scripts/                # Setup & test scripts
├── test-data/              # Test fixtures
├── public/                 # Static assets
└── [config files]          # Project configuration
```

---

## `/app` - Next.js App Router

**Purpose:** Frontend layer, routing, API endpoints

```
app/
├── (auth)/                 # Auth route group
│   ├── login/              # Login page
│   │   └── page.tsx
│   └── signup/             # Signup page
│       └── page.tsx
├── (dashboard)/            # Dashboard route group (protected)
│   ├── layout.tsx          # Dashboard layout with nav
│   └── dashboard/
│       ├── page.tsx        # Main dashboard
│       ├── actions.ts      # Manual deployment trigger
│       └── dashboard-client.tsx  # Client-side dashboard UI
├── [workspaceSlug]/        # Public workspace viewer
│   ├── layout.tsx          # Workspace layout with sidebar
│   ├── loading.tsx         # Loading state
│   ├── page.tsx            # Index page with auto-redirect
│   ├── all-pages/          # All pages view
│   │   └── page.tsx
│   └── [...path]/          # Catch-all for nested pages
│       └── page.tsx        # Dynamic page renderer
├── api/                    # API routes
│   ├── toc/                # Table of contents endpoint
│   │   └── route.ts
│   └── webhooks/           # Git webhook handlers
│       └── github/
│           └── route.ts    # GitHub webhooks
├── blocks.css              # Logseq block styling
├── globals.css             # Global styles
├── page.tsx                # Landing page
├── layout.tsx              # Root layout
└── favicon.ico
```

**Key Routes:**
- `/` - Landing page (marketing)
- `/login` - User login
- `/signup` - User signup
- `/dashboard` - User dashboard (protected, includes settings)
- `/api/webhooks/github` - GitHub webhook handler
- `/api/toc` - Table of contents API
- `/:workspaceSlug` - Public workspace home
- `/:workspaceSlug/all-pages` - All pages view
- `/:workspaceSlug/:path...` - Nested pages (unlimited depth)

---

## `/modules` - Modular Monolith

**Purpose:** Business logic, isolated modules

### Overview

Each module is self-contained with:
- `schema.ts` - Database schema (Drizzle)
- `queries.ts` - Read operations
- `actions.ts` - Write operations (Server Actions)
- Additional files as needed

```
modules/
├── auth/                   # Authentication & authorization
│   ├── schema.ts           # users table
│   ├── queries.ts          # getUserById, verifyPassword
│   ├── actions.ts          # createUser, hashPassword
│   └── session-actions.ts  # login, signup, logout
├── workspace/              # Workspace management
│   ├── schema.ts           # workspaces table
│   ├── queries.ts          # getWorkspaceByUserId, getWorkspaceBySlug
│   └── actions.ts          # createWorkspace, updateWorkspace
├── content/                # Content/Nodes module
│   ├── schema.ts           # nodes table
│   ├── queries.ts          # getNode, getNodeChildren, getBreadcrumbs
│   └── actions.ts          # node operations (internal only)
├── git/                    # Git integration
│   ├── schema.ts           # git_repositories, deployment_history
│   ├── queries.ts          # getRepositoryByWorkspaceId
│   ├── actions.ts          # connectRepository, updateRepository
│   ├── clone.ts            # Git clone/cleanup logic
│   └── sync.ts             # Repository sync orchestration
├── logseq/                 # Logseq graph processing
│   ├── export.ts           # Call Rust export-logseq-notes
│   ├── ingest.ts           # Content ingestion pipeline
│   ├── parse.ts            # Parse Rust output
│   ├── markdown-parser.ts  # Parse block structure
│   ├── process-references.ts # Process [[page]] and ((uuid))
│   ├── types.ts            # Logseq-specific types
│   └── export-tool/        # Vendored Rust tool
└── storage/                # Asset storage
    ├── s3.ts               # S3 client (MinIO/AWS)
    └── upload.ts           # Asset upload logic
```

**Module Dependencies:**
- `auth` → no dependencies
- `workspace` → depends on `auth`
- `content` → depends on `workspace`
- `git` → depends on `workspace`, `content`, `logseq`
- `logseq` → depends on `content`
- `storage` → no dependencies

---

## `/components` - React Components

**Purpose:** Reusable UI components

```
components/
├── ui/                     # Base UI components
│   └── ScrollBar.tsx       # Custom scrollbar
└── viewer/                 # Public viewer components
    ├── BlockTree.tsx       # Logseq block tree with collapse
    ├── Breadcrumbs.tsx     # Path breadcrumb navigation
    ├── MobileMenuTrigger.tsx # Mobile hamburger button
    ├── MobileSidebar.tsx   # Mobile drawer sidebar
    ├── NodeContent.tsx     # HTML renderer with prose styling
    ├── PageBlocksContextProvider.tsx # Block context
    ├── Sidebar.tsx         # Hierarchical tree navigation
    └── TableOfContents.tsx # Page TOC component
```

**Component Guidelines:**
- Default to Server Components
- Use "use client" only for interactivity
- Mobile-first (320px minimum)

---

## `/lib` - Shared Utilities

**Purpose:** Cross-module utilities, shared logic

```
lib/
├── db.ts                   # Drizzle database client
├── session.ts              # Session management (iron-session)
├── utils.ts                # General utilities (cn, slug generation)
├── types.ts                # Shared TypeScript types
├── shell.ts                # Shell execution with PATH handling
├── navigation-context.tsx  # Navigation history context
└── page-blocks-context.tsx # Page blocks context
```

**Key Files:**
- `db.ts` - Single database connection, allows build without DATABASE_URL
- `session.ts` - Session helpers (getSession, getCurrentUser, requireAuth)
- `utils.ts` - Utility functions (cn for classnames)
- `shell.ts` - Shell execution with proper PATH for Rust binaries

---

## `/scripts` - Setup & Test Scripts

**Purpose:** Development automation

```
scripts/
├── setup.sh                # Master setup script
├── install-rust-tools.sh   # Install export-logseq-notes
├── setup-database.sh       # DB schema setup
├── setup-minio.sh          # Local S3 setup
├── minio.sh                # MinIO management
├── test-e2e.sh             # Backend E2E tests
├── test-frontend-e2e.sh    # Frontend E2E tests
├── test-asset-upload.ts    # Asset upload testing
├── compare-with-logseq.ts  # Structure comparison
├── cleanup-test-user.ts    # Test cleanup utility
├── setup-test-workspace.ts # Test workspace setup
└── trigger-sync.ts         # Manual sync trigger
```

---

## `/drizzle` - Database Migrations

**Purpose:** Database version control

```
drizzle/
├── migrations/             # Auto-generated migrations
└── meta/                   # Migration metadata
```

**Migration Workflow:**
1. Edit schema in `modules/*/schema.ts`
2. Run `npm run db:generate` to create migration
3. Run `npm run db:push` to apply
4. Commit migration files

---

## `/docs` - Documentation

**Purpose:** Project documentation for humans and AI

```
docs/
├── CHANGELOG.md               # Version history, changes log
├── ROADMAP.md                 # Development phases, future plans
├── DIRECTORY.md               # This file (project navigation)
├── OPERATIONS.md              # ⭐ START HERE: Setup, Docker, testing (unified guide)
├── DATABASE.md                # Database schema and query reference
├── DOCKER_MODES.md            # Dev/prod Docker modes (see OPERATIONS.md)
├── BASH_GUIDELINES.md         # Bash scripting best practices
├── CRUD_GUIDELINES.md         # CRUD operation patterns
├── PERFORMANCE_GUIDELINES.md  # Performance optimization guide
└── ASSET_TROUBLESHOOTING.md   # Asset/MinIO troubleshooting
```

**⭐ Quick Start:** Start with [OPERATIONS.md](OPERATIONS.md) for setup, Docker, and testing.

**Deprecated (consolidated into OPERATIONS.md):**
- `SCRIPTS.md` - Now in OPERATIONS.md § Setup Scripts & Docker Management
- `TESTING.md` - Now in OPERATIONS.md § Testing & Debugging
- `DOCKER_MODES.md` - Referenced in OPERATIONS.md § Dev vs Prod Modes

---

## Configuration Files

**Root-level config files:**

| File | Purpose |
|------|---------|
| `CLAUDE.md` | AI agent instructions |
| `README.md` | User-facing documentation |
| `package.json` | Dependencies, scripts |
| `tsconfig.json` | TypeScript configuration |
| `next.config.ts` | Next.js configuration |
| `drizzle.config.ts` | Drizzle ORM configuration |
| `eslint.config.mjs` | ESLint rules |
| `postcss.config.mjs` | PostCSS configuration |
| `.env.local` | Environment variables (not committed) |
| `.test.env` | Test environment variables |
| `.gitignore` | Git ignore rules |

---

## Finding Things

**Looking for...**

- **Database schema?** → `modules/*/schema.ts`
- **Read queries?** → `modules/*/queries.ts`
- **Write operations?** → `modules/*/actions.ts`
- **UI components?** → `components/viewer/*`
- **API endpoints?** → `app/api/*`
- **Page routes?** → `app/*/page.tsx`
- **Utilities?** → `lib/*.ts`
- **Documentation?** → `docs/*`

**Working on a feature?**

1. Identify the module (e.g., git integration → `modules/git/`)
2. Update schema if needed
3. Add queries/actions
4. Create UI components
5. Wire up in `app/` routes
6. Update CHANGELOG.md

---

**Last Updated:** 2025-11-23
