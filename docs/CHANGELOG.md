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
- **Git Sync Improvements**:
  - Auto-detection of default branch (getDefaultBranch function)
  - Branch validation before clone (validateBranch function)
  - Improved error messages (auth failed, repo not found, branch mismatch)
  - Security guide for GitHub Personal Access Tokens (README.md#github-personal-access-token-setup)
  - Settings page links to PAT security guide
  - Branch auto-detection message in settings UI
- **Account Management**:
  - Danger zone in settings page for account deletion
  - Username confirmation required for deletion
  - Cascading deletes (workspace, repos, nodes, deployment history)
  - Session destruction and redirect on account deletion
- **Phase 3: Logseq Processing** (In Progress):
  - Storage module with S3-compatible abstraction (modules/storage/)
  - S3 client for MinIO (local) and AWS S3 (prod)
  - Asset upload functionality for images/attachments
  - Rust tool integration (modules/logseq/export.ts)
  - Shell execution wrapper for export-logseq-notes CLI
  - JSON output parser (modules/logseq/parse.ts)
  - LogseqPage to NewNode conversion
  - Namespace extraction and depth calculation
  - Journal page detection (YYYY_MM_DD pattern)
  - Asset processing in HTML (upload to S3, replace refs)
  - Content ingestion action (modules/content/actions.ts)
  - ingestLogseqGraph() server action
  - Batch node insertion with idempotent deletes
  - Sync pipeline integration (modules/git/sync.ts)
  - Deployment build logs tracking
  - AWS SDK client-s3 dependency added
  - Environment variables for S3 configuration
  - Last error timestamp in settings UI
- **Setup Scripts Module**:
  - Automated setup scripts in scripts/ directory
  - install-rust-tools.sh (Rust + export-logseq-notes + CARGO_BIN_PATH config)
  - setup-minio.sh (MinIO Docker container + bucket)
  - setup-database.sh (Drizzle schema push)
  - setup.sh (master script, runs all steps)
  - SCRIPTS.md documentation with troubleshooting
  - All scripts idempotent, Unix-compatible, error-safe
- **Shell Execution Utilities**:
  - lib/shell.ts module for Next.js server execution
  - execWithPath() - Execute commands with extended PATH
  - findBinary() - Locate binaries in common locations
  - binaryExists() - Fast binary existence check
  - Fixes "command not found" errors in Next.js server environment
  - All execAsync usages migrated to execWithPath

### Changed
- README Quick Start now references automated scripts
- Documentation order prioritizes SCRIPTS.md
- Landing page completely redesigned with Vercel-style UI
- App directory structure expanded with auth and dashboard route groups
- Git repository connection triggers initial sync automatically
- Git clone now validates branch exists before attempting clone
- Settings page placeholder updated from "ghp_..." to "github_pat_..." for fine-grained tokens
- **Auto-correction behavior**: Git sync now automatically detects and uses default branch if specified branch doesn't exist, then persists correct branch (no manual user intervention required per CRUD guidelines)

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- Removed `revalidateTag` from sync function (was causing "used during render" error)
- Dashboard and settings pages now use `dynamic = "force-dynamic"` for live status updates
- Status badges (idle/syncing/success/error) now update in real-time when user refreshes page
- Removed `revalidatePath` from async promise handlers to prevent render errors
- Renamed middleware.ts to proxy.ts (Next.js 16 convention)
- export-logseq-notes installation (builds from GitHub source, not crates.io)
- Rust time crate compilation (auto-updates to stable toolchain)
- Docker group missing (creates group on Linux before adding user)
- Docker permission denied (auto-detects, adds user to docker group)
- All bash scripts rewritten with cleanup traps (prevent broken state)
- SCRIPTS.md updated with comprehensive troubleshooting
- BASH_GUIDELINES.md added with industry best practices
- setup-minio.sh Docker permissions refactored to use helper functions with proper error handling
- BASH_GUIDELINES.md Docker pattern updated with complete error handling and platform detection
- **Phase 3: Shell execution in Next.js server** - Fixed "export-logseq-notes not found" error
  - Node.js doesn't inherit shell PATH, cargo bin directory not accessible
  - Created lib/shell.ts with execWithPath() and findBinary() utilities
  - All shell commands now use extended PATH (cargo, git, user binaries)
  - install-rust-tools.sh now configures CARGO_BIN_PATH in .env.local
  - .env.example updated with CARGO_BIN_PATH=$HOME/.cargo/bin
  - BASH_GUIDELINES.md updated with "Next.js Server Execution Pattern" section
  - Covers development, production, CI/CD PATH issues
  - modules/logseq/export.ts migrated to shell utilities
  - modules/git/clone.ts migrated to shell utilities (all execAsync calls)
- **Phase 3: export-logseq-notes configuration** - Fixed TOML config format errors
  - Tool outputs HTML files to directory, not JSON to stdout
  - Fixed config: `template` expects file path string, not TOML table (`[template]` syntax error)
  - Fixed config: `script` field is required - created minimal Rhai script to include all pages
  - Updated export.ts to use proper config format (data, product, output, script, extension)
  - Created minimal .draehi-script.rhai that includes all pages without filtering
  - Updated parse.ts to read HTML files from output directory instead of JSON parsing
  - Decodes URL-encoded filenames (e.g., "some%20page.html" → "some page")
  - modules/content/actions.ts updated to use outputDir instead of output string
  - Cleanup both config and script files after execution

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
