# Changelog

All notable changes to Draehi will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
- Initial project scaffolding with Next.js 16, TypeScript, Tailwind CSS v4
- Comprehensive documentation structure:
  - CLAUDE.md with AI agent instructions (completed with project overview, schema, structure)
  - ROADMAP.md with 7-phase development plan
  - CHANGELOG.md for tracking changes
  - DIRECTORY.md with complete project navigation guide
  - CRUD_GUIDELINES.md for data operations
  - PERFORMANCE_GUIDELINES.md for optimization patterns
- Modular monolith folder structure created:
  - modules/ (auth, workspace, content, git, logseq)
  - components/ (ui, workspace, content, dashboard)
  - lib/ for shared utilities
  - drizzle/ for migrations
- Database schema implementation (Drizzle ORM + PostgreSQL):
  - users table (username/password auth)
  - workspaces table (one per user)
  - git_repositories table (repo tracking)
  - deployment_history table (deployment logs)
  - nodes table (content with namespace hierarchy)
- Core dependencies installed:
  - drizzle-orm, drizzle-kit (database)
  - postgres (PostgreSQL client)
  - zod (validation)
  - bcryptjs (password hashing)
  - iron-session (sessions)
  - clsx, tailwind-merge (styling utilities)
- Database client setup (lib/db.ts)
- Shared utilities (lib/utils.ts, lib/types.ts)
- Drizzle configuration (drizzle.config.ts)
- Environment variables template (.env.example)
- npm scripts added: type-check, db:generate, db:migrate, db:push, db:studio
- Module queries and actions implemented:
  - auth module (queries.ts, actions.ts)
  - workspace module (queries.ts, actions.ts)
  - content module (queries.ts, actions.ts)
  - git module (queries.ts, actions.ts)
  - logseq module (types.ts)
- README.md updated with project overview and setup instructions
- **Phase 1 Complete**: Authentication & Basic UI
  - Session management with iron-session (lib/session.ts)
  - Login page (/login) with form action
  - Signup page (/signup) with workspace creation
  - Dashboard layout with nav and logout
  - Dashboard page showing workspace + git status
  - Landing page with hero, features, how-it-works
  - Middleware for protected routes
  - Session actions (login, signup, logout)
- Next.js configuration updated (disabled cacheComponents temporarily for auth)
- Database client allows build without DATABASE_URL (warns instead of erroring)
- **Phase 2 Complete**: Git Integration
  - Settings page for repository connection (/dashboard/settings)
  - GitHub repository connection form (URL, branch, token)
  - Git clone logic using shell commands (modules/git/clone.ts)
  - Repository sync system (modules/git/sync.ts)
  - GitHub webhook endpoint (/api/webhooks/github)
  - Manual deployment trigger button
  - Background sync on repository connection
  - Deployment history tracking
  - Error logging and status display

### Changed
- Landing page completely redesigned with Vercel-style UI
- App directory structure expanded with auth and dashboard route groups
- Git repository connection triggers initial sync automatically

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- N/A

---

## [0.1.0] - 2025-11-16

### Added
- Initial Next.js project setup
- ESLint configuration
- Turbopack support
- Basic app directory structure

---

**Version Format:** [MAJOR.MINOR.PATCH]
- MAJOR: Breaking changes
- MINOR: New features, backward compatible
- PATCH: Bug fixes, backward compatible

**Last Updated:** 2025-11-16
