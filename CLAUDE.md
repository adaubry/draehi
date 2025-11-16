# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Draehi** - Deploy your Logseq graph to the web in 60 seconds.

A "Vercel for Logseq graphs" that transforms your personal knowledge base into a high-performance, SEO-optimized website. Connect your Git repo → push → publish.

**Core Value Proposition:**
- **No Manual Exports**: Git-based workflow, push to deploy
- **High Performance**: Sub-100ms TTFB, pre-rendered HTML
- **SEO-Optimized**: Static HTML generation, perfect for content sites
- **Zero Config**: One workspace per user, automatic deployment

**Architecture:**
- One workspace per user (simplified UX)
- Git repo as source of truth (expected: Logseq graph)
- Rust-based content processing (export-logseq-notes)
- Pre-rendered HTML stored in PostgreSQL
- Namespace-based hierarchy (no recursive queries)

## Key Commands

### Initial Setup

```bash
# Scaffold the project with all modern features
npx create-next-app@latest draehi --typescript --tailwind --eslint --app --src-dir --turbopack

#TODO create a relevant setup


```

### Development

```bash
# Run development server with Turbopack
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint

# Build for production
npm run build
```

### Pre-deployment Workflow (MANDATORY)

```bash
# ALWAYS run these commands before pushing to prevent deployment failures:

# 1. Type check to catch TypeScript errors
npm run type-check

# 2. Build locally to catch compilation issues
npm run build

# 3. Update ALL relevant documentation files:
# - CHANGELOG.md (MANDATORY - log all changes)
# - ROADMAP.md (update phase status if needed)
# - README.md (update features/status if needed)
# - DIRECTORY.md (if structure changed)
# - PROJECT_STATUS.md (update current phase/metrics)
# - Any GUIDELINES files (if patterns changed)

# 4. Only after successful build and docs updates, commit and push
git add .
git commit -m "your commit message"
git push origin main
```

**CRITICAL**:
- Never push without running `npm run build` first
- Never push without updating CHANGELOG.md
- **ALWAYS update all affected markdown documentation after making changes**

### Testing (when implemented)

```bash
# Run tests
npm test

# Run tests in watch mode
npm test:watch

# E2E tests with Puppeteer (via MCP server)
# Use Puppeteer MCP server for browser automation testing
```

## Architecture Overview

### Tech Stack

- **Framework**: Next.js 16+ with App Router, including cacheComponents "use cache"
- **Language**: TypeScript (mandatory, no JavaScript files)
- **Styling**: Tailwind CSS v4 with plagiarized vercel rules
- **UI Components**: shadcn/ui "vercel style"
- **Database**: Drizzle ORM - PostgreSQL

### Project Structure

The following project structure is marked TODO but we keep the following rules in mind:

1. The project is organized in a Modular Monolith fashion.
   A modular monolith uses a monolithic architecture but enforces strict separation of modules,
   allowing for better organization and maintainability.

These modules interact to form a single deployable unit.

By default the root directory acts as a path to the "nextjs frontend layer" but you need to divide the project,
via the different modules it is comprised of, by a dedicated folder locater in the root of the project.

2. The project is documented in a dedicated /docs folder.
   We aim to provide precise context and documentation to both users and the AI agents that will interact with the project.

All markdown files are documentation, all except for CLAUDE.md and README.md are located in /docs,
All changes are logged into /docs/CHANGELOG.md
The current and future things we work on are in the /docs/ROADMAP.md
All guides with "GUIDELINES" in the name explain how we tackle a specific concept in this codebase (example /docs/PERFORMANCE_GUIDELINES.md)
DIRECTORY.md is a file that helps you find everything and labels what parts of the projects are used, for what goal

```
draehi/
├── app/                        # Next.js App Router
│   ├── (auth)/                # Auth routes (login, signup)
│   ├── (dashboard)/           # Dashboard after login
│   ├── [workspace]/           # Public workspace viewer
│   │   └── [...slug]/         # Catch-all for unlimited depth
│   ├── api/                   # API routes
│   └── layout.tsx             # Root layout
├── modules/                   # Modular Monolith Architecture
│   ├── auth/                  # Authentication module
│   │   ├── actions.ts         # Server actions
│   │   ├── queries.ts         # Auth queries
│   │   └── schema.ts          # User schema
│   ├── workspace/             # Workspace module
│   │   ├── actions.ts
│   │   ├── queries.ts
│   │   └── schema.ts
│   ├── content/               # Content/Nodes module
│   │   ├── actions.ts
│   │   ├── queries.ts
│   │   └── schema.ts
│   ├── git/                   # Git integration module
│   │   ├── clone.ts           # Clone repos
│   │   ├── sync.ts            # Sync changes
│   │   ├── webhook.ts         # Handle webhooks
│   │   └── schema.ts          # Git repo tracking
│   └── logseq/                # Logseq processing module
│       ├── export.ts          # Call Rust tool
│       ├── parse.ts           # Parse output
│       └── types.ts           # Logseq types
├── components/                # React components
│   ├── ui/                    # shadcn/ui components
│   └── workspace/             # Workspace-specific
├── lib/                       # Shared utilities
│   ├── db.ts                  # Database client
│   ├── queries.ts             # Centralized queries
│   └── cache.ts               # Caching utilities
├── drizzle/                   # Database migrations
├── docs/                      # Documentation
│   ├── CHANGELOG.md
│   ├── ROADMAP.md
│   ├── DIRECTORY.md
│   ├── CRUD_GUIDELINES.md
│   └── PERFORMANCE_GUIDELINES.md
├── CLAUDE.md                  # AI agent instructions
└── README.md                  # User-facing docs
```

### Database Schema

The database uses Drizzle PostgreSQL with the following main tables:

**Core Tables:**

1. **users** - User accounts
   - `id`, `email`, `name`, `created_at`
   - One user → One workspace (simplified model)

2. **workspaces** - Top-level container
   - `id`, `user_id`, `slug`, `name`, `domain`, `created_at`
   - One workspace per user

3. **git_repositories** - Git repo tracking
   - `id`, `workspace_id`, `repo_url`, `branch`, `deploy_key`, `last_sync`, `sync_status`
   - Source of truth for content

4. **nodes** - Unified content (pages + virtual folders)
   - `id`, `workspace_id`, `page_name`, `slug`, `namespace`, `depth`
   - `html` (pre-rendered), `content` (markdown backup), `metadata` (JSONB)
   - `is_journal`, `journal_date`, `created_at`, `updated_at`
   - **Virtual namespace hierarchy** - no parent_id foreign keys

5. **deployment_history** - Track deployments
   - `id`, `workspace_id`, `commit_sha`, `status`, `deployed_at`, `error_log`

**Key Design: Internal CRUD Only**
- No user-facing CRUD operations (except signup)
- All content changes via Git push → webhook → auto-deploy
- Users edit in Logseq, not in Draehi UI
- Better security, simpler UX

### Key Design Patterns

# Database

1. Virtual Namespace Hierarchy
   No parent_id foreign keys - use namespace strings
   O(1) indexed lookups via (workspace_id, namespace, slug)
   No recursive CTEs or depth limits

2. JSONB for Flexibility
   metadata field with TypeScript types via .$type<T>()
   Store frontmatter, tags, dynamic fields
   No JSON validation at DB level

3. Pre-Rendered Content
   Store html in database
   Process during ingestion with unified/remark
   Read-optimized storage

4. Cascading Deletes (User → Workspace → Nodes → Links)

# CRUD / Data Layer

1. Centralized Queries
   All DB queries in src/lib/queries.ts
   Use Drizzle relational API
   No inline queries in components/routes

2. Idempotent Operations
   Check existence before insert
   Update if exists, insert if not
   Never rely on database errors

3. Server Actions with Validation
   "use server" + Zod schemas
   validatedAction() middleware wrapper
   Return { error } objects, never throw

4. Only internal
   no users can do CRUD operations apart from creating a user
   all is done internally for better security and UX

# Frontend

1. Server Components by Default
   Data fetching in Server Components
   "use client" only for interactivity
   Catch-all routes for unlimited depth

2. Type Safety
   Drizzle $inferSelect / $inferInsert
   Strict TypeScript mode
   No any types

# Performance

1. Multi-Layer Caching (Next.js 16)
   "use cache" directive for static data
   React cache() for request deduplication
   revalidateTag() for invalidation

2. Optimized Queries
   Composite indexes: (workspace_id, namespace), (workspace_id, page_name)
   Folders-first ordering with custom SQL
   LIMIT on all list queries

3. Content Delivery
   Pre-rendered HTML from database
   Eager loading for first 15 images
   Lazy loading for rest

## Important Implementation Notes

### Design wise

You should aim to create a vercel clone, in term of UI and UX

### Mobile-First Responsive Design

- Minimum viewport: 320px
- Touch targets: minimum 44x44px
- Should still always work for desktop web

## CRUCIAL Guidelines

1. **Keep It Simple**: In all interaction and and commit messages, be extremely concise and sacrifice grammar for the sake of concision
2. **Mobile First**: Test all features on 320px viewport
3. **Type Everything**: No implicit any, proper types for all data
4. **Use Modern Patterns**: App Router, Server Components, streaming
5. **Keep Codebase Lean**: Never re-write what you can re-use

## GitHub

Your primary way of interacting with github should be the GitHub CLI

## Git

When creating branches, prefix them with adaubry/ to indicate they came from me

## Plans

At the end of each plan, give me a list of unresolved questions to answer, if any.
Make the questions concise, sacrifice grammar for the sake of concision.
