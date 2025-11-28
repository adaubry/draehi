# Changelog

All notable changes to Draehi will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Fixed - 2025-11-28 (Block Anchor Navigation Header Offset)

- **Header Offset on Hash Navigation**: Blocks scrolled to via URL hash or TOC clicks no longer hidden by sticky header
  - BlockTree: Added useEffect to handle hash-based navigation with 56px header offset
  - TableOfContents: Updated click handler to use same scroll offset calculation
  - Both add 16px additional padding for visual spacing
  - Handles both initial page load with hash and dynamic hashchange events

### Fixed - 2025-11-28 (Table of Contents & Navigation)

- **TOC Hierarchy Rendering**: Implemented `buildTOCHierarchy()` algorithm for proper parent-child heading relationships
  - Stack-based algorithm converts flat heading list to tree structure respecting levels (h1 < h2 < h3)
  - TOC items now render with correct indentation based on heading level
  - Collapse/expand buttons for heading groups (children indented under parent headings)

- **TOC Block Navigation**: Fixed anchor linking from TOC items to blocks
  - Added `data-uuid={node.uuid}` attribute to block `<li>` elements
  - TOC selector now uses `[data-uuid="..."]` instead of invalid `uuid` attribute
  - Clicking TOC items scrolls to block and updates URL hash

- **Sidebar Sticky Positioning**: Fixed sidebar to remain visible during scrolling
  - Changed from relative container positioning to viewport-relative sticky
  - Removed `container` wrapper that constrained sidebar
  - Set `sticky top-14 h-[calc(100vh-3.5rem)]` for proper viewport positioning

### Refactored - 2025-11-27 (Metadata Management)

- **Smart Metadata Creation**: Removed `has_toc_entry` boolean flag from Node schema
  - Implemented `createMetadataIfNeeded()` helper that only creates metadata objects when they have content
  - Prevents empty `metadata: {}` objects cluttering database
  - Filters empty values, tags arrays, and whitespace-only strings

- **Heading Detection**: Added `hasHeading()` utility for checking if node has TOC entry
  - Replaces `getBlocksWithTocEntries` with `getBlocksWithHeadings`
  - Filters full page tree to extract blocks with `metadata.heading.text`
  - Pragmatic in-memory filtering avoids separate database queries

### Added - 2025-11-26 (Surrealist Configuration & WebSocket Connection)

- **Surrealist Auto-Configuration**: Pre-configured database connections via `surrealist-instance.json`
  - Auto-loaded connection: "Local Development" (ws://localhost:8000/rpc)
  - Mounted to Surrealist container at `/home/surrealist/.surrealist/instance.json`
  - Uses `localhost` for browser accessibility (not Docker internal `surrealdb` hostname)
  - Eliminates manual connection setup in UI
  - Credentials: root/root with namespace `draehi` and database `main`

- **WebSocket Connection Verification**: New test script to validate Surrealist connectivity
  - `scripts/test-surrealist-connection.ts` - Tests WebSocket connection end-to-end
  - Verifies: Connection → Authentication → Namespace/DB selection → Query execution
  - Confirms Surrealist can connect using pre-configured settings

- **Surrealist Troubleshooting Guide**: Updated `docs/OPERATIONS.md` with connection debugging
  - Steps to verify WebSocket connectivity
  - Browser cache clearing instructions
  - Manual connection setup fallback
  - Common errors and fixes table
  - Mounted file verification commands

### Added - 2025-11-26 (Docker Dev/Prod Modes & Unified Operations Documentation)

- **Docker Build Modes**: Support for dev and prod container variants
  - Dev mode: Includes bash, curl, wget, nc, vim, htop for debugging
  - Prod mode: Lean containers without debugging tools (security, ~100MB smaller)
  - `npm run docker:setup` - Start with dev mode (default)
  - `npm run docker:setup:prod` - Start with prod mode
  - `BUILD_MODE` environment variable controls mode selection

- **Container Shell Access**: Quick access commands for debugging
  - `npm run docker:shell:surreal` - SurrealDB container bash
  - `npm run docker:shell:keydb` - KeyDB container bash
  - `npm run docker:shell:minio` - MinIO container bash
  - `npm run docker:shell:app` - Next.js app container bash

- **Improved Health Checks**: Added `start_period` grace periods
  - SurrealDB: 30s start period (database initialization)
  - KeyDB: 15s start period
  - MinIO: 15s start period
  - Next.js app: 45s start period (build + startup)
  - Prevents unhealthy container states during startup

- **Unified Documentation**: New `docs/OPERATIONS.md` consolidates all development operations
  - Single comprehensive guide for setup, Docker, and testing
  - Replaced: SCRIPTS.md, TESTING.md (content moved, files kept for reference)
  - Covers: Docker management, test execution, debugging workflows, configuration
  - Includes quick start, common tasks, and troubleshooting reference
  - Updated DIRECTORY.md to point to OPERATIONS.md as entry point

### Changed - 2025-11-23 (SurrealDB + KeyDB Migration)

- **Database Migration**: Switched from PostgreSQL/Drizzle to SurrealDB + KeyDB
  - SurrealDB for structured data (users, workspaces, nodes, git_repositories, deployment_history)
  - KeyDB (Redis-compatible) for pre-rendered HTML cache
  - All services containerized with Docker Compose
  - One-command setup: `npm run docker:setup`

- **New Files**:
  - `lib/surreal.ts` - SurrealDB client with typed query helpers
  - `lib/keydb.ts` - KeyDB client for HTML cache operations
  - `docker-compose.yml` - SurrealDB, KeyDB, MinIO services
  - `Dockerfile` - Multi-stage build for Next.js app
  - `scripts/docker-setup.sh` - One-command Docker setup
  - `scripts/init-surreal-schema.ts` - Schema initialization
  - `.env.docker` - Docker environment template

- **Updated Modules**:
  - All `modules/*/schema.ts` - Now TypeScript interfaces (not Drizzle tables)
  - All `modules/*/queries.ts` - Use SurrealDB client with SurrealQL
  - All `modules/*/actions.ts` - Use SurrealDB + KeyDB for writes
  - IDs changed from `number` to `string` (SurrealDB record IDs)

- **Removed Dependencies**: `drizzle-orm`, `drizzle-kit`, `postgres`
- **Added Dependencies**: `surrealdb`, `redis`

### Added - 2025-11-23

- **DATABASE.md**: Comprehensive database documentation
  - Complete schema docs (users, workspaces, nodes, git_repositories, deployment_history)
  - Query patterns with examples (reads, writes, batch operations)
  - Index documentation and performance considerations
  - Migration workflow and troubleshooting

### Changed - 2025-11-23

- **Documentation Cleanup**: Removed stale/redundant docs, updated remaining for accuracy
  - Removed: PHASE4_FINAL_TEST_RESULTS.md, PROJECT_STATUS.md, NAVIGATION_GUIDELINES.md, SIDEBAR.md
  - Updated: DIRECTORY.md, SCRIPTS.md, TESTING.md, ROADMAP.md, CRUD_GUIDELINES.md, PERFORMANCE_GUIDELINES.md
  - Fixed: Incorrect file paths, non-existent scripts, outdated structure
  - Updated CLAUDE.md to reflect accurate project structure

### Added - 2025-11-19

- **Asset Ingestion**: Integrated S3/MinIO asset upload pipeline
  - Connected existing `processAssets()` to block ingestion flow
  - Automatically uploads local images, PDFs to S3/MinIO during sync
  - Replaces local paths (`../assets/image.png`) with S3 URLs
  - Non-breaking: gracefully skips external URLs
  - Location: `modules/content/actions.ts:281`
- **YouTube Embed Support**: Added automatic video embed conversion
  - New `processEmbeds()` function detects YouTube URLs in content
  - Converts `youtube.com/watch?v=*` and `youtu.be/*` to responsive iframes
  - 16:9 aspect ratio with fullscreen enabled
  - Handles both plain text URLs and markdown links
  - Non-breaking: preserves other URLs unchanged
  - Location: `modules/logseq/process-references.ts:100-171`
- **MinIO Launch Scripts**: Added convenient npm scripts for MinIO management
  - `npm run minio` - Quick start/status check (auto-setup if needed)
  - `npm run minio stop/restart/logs/status` - Container management
  - `scripts/minio.sh` - Wrapper around setup-minio.sh with colored output
  - `scripts/test-asset-upload.ts` - Test suite for asset upload flow (tests both `../assets/` and `assets/` paths)
  - Updated SCRIPTS.md with asset ingestion flow documentation
- **Asset Troubleshooting Guide**: New comprehensive debugging guide
  - MinIO health checks and environment verification
  - Step-by-step asset upload testing
  - Common issues with fixes (403, CORS, local paths)
  - Production AWS S3 migration guide
  - Location: `docs/ASSET_TROUBLESHOOTING.md`

### Changed - 2025-11-19

- **Asset Path Resolution Fix**: Fixed handling of `../assets/` paths from Logseq
  - Normalizes `../assets/image.png` → `assets/image.png` before upload
  - Fixes issue where assets weren't uploading due to incorrect path resolution
  - Logseq markdown files in `pages/` reference `../assets/`, now resolves from repo root
  - S3 keys no longer contain `../` in path
  - Location: `modules/storage/upload.ts:20-24`
- **Asset Upload Logging**: Added debug logging to track upload success/failure
  - Console logs show `[Asset Upload] ✓ path → URL` for successful uploads
  - Console warns `[Asset Upload] ✗ Failed to upload path: error` for failures
  - Helps diagnose why assets remain local instead of S3 URLs
  - Location: `modules/logseq/parse.ts:220-227`
- **S3 Credential Validation**: Added early validation for AWS credentials
  - Validates `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` on S3 client creation
  - Throws helpful error if missing: "Missing S3 credentials in environment: ..."
  - Prevents cryptic MinIO authorization errors
  - Suggests fix: `cp .env.example .env.local`
  - Location: `modules/storage/s3.ts:7-23`
- **S3 URL Generation Fix**: Fixed MinIO URL to include bucket name
  - Local mode: `http://localhost:9000/draehi-assets/key` (path-style)
  - Production mode: `https://draehi-assets.s3.region.amazonaws.com/key` (subdomain-style)
  - Location: `modules/storage/s3.ts:42-43`
- **Prose Typography Integration**: Integrated Tailwind Typography into block rendering
  - Imported and used `NodeContent` component in `BlockTree.tsx` for consistent typography
  - Added `block-content` class to NodeContent for flex layout compatibility
  - Removed redundant typography CSS from `blocks.css` (links, paragraphs)
  - Kept `.block-content` for flex layout only (flex: 1, min-width: 0)
  - Typography now fully controlled by Tailwind prose classes
  - Fixed Sidebar.tsx: replaced ScrollArea with regular div
  - **FIXED**: Installed `@tailwindcss/typography` plugin (was missing!)
  - Added `@plugin "@tailwindcss/typography"` to `globals.css`
  - Prose classes now work - changes to NodeContent.tsx take effect immediately

### Added - 2025-11-19

- **Sidebar Documentation**: Created SIDEBAR.md
  - Complete component architecture documentation
  - Three-section layout explanation
  - TOC async fetching flow with code examples
  - API endpoint documentation
  - Troubleshooting guide and edge cases
  - Performance optimizations
- **Navigation System - Complete 8-Phase Implementation**:
  - Phase 1: NavigationProvider with sessionStorage history + useNavigationHistory hook
  - Phase 2: Breadcrumbs revamp with n-2 tracking and proper link behavior
  - Phase 3: TableOfContents component (max 3 depth levels, level 3 expanded)
  - Phase 4: Three-part sidebar (placeholder + nav buttons + mode switching)
  - Phase 5: Mobile drawer with hamburger menu, overlay, 200ms slide animation
  - Phase 6: /all-pages route showing full page tree with workspace statistics
  - Phase 7: Layout integration of all navigation components
  - Phase 8: Final polish with animations and responsive behavior
- **New Navigation Features**:
  - n-2 breadcrumbs with sessionStorage history tracking
  - TOC mode (max 3 levels) vs all-pages mode toggle in sidebar
  - Mobile drawer with hamburger menu (40x40px, fixed bottom-right)
  - Responsive design with lg: breakpoint (desktop/mobile split)
  - Page hierarchy tree with proper nesting and indentation

### Removed - 2025-11-19

- **Documentation Cleanup**: Removed outdated/duplicate documentation
  - Deleted duplicate docs from root (PHASE4_COMPLETE.md, TEST_SUMMARY.md, ITERATION_SUMMARY.md)
  - Removed Phase 4 planning docs (PHASE4_ISSUES.md, PHASE4_TEST_PLAN.md, FRONTEND_FIX_LOG.md)
  - Removed conversation logs (conversation.md)
  - Removed diagnostic scripts (diagnose-frontend.ts, diagnose-parser.ts, test-block-structure.ts, test-export-output.ts, analyze-missing-pages.ts)
  - Removed duplicate script (validate-content.js, kept .ts version)

### Changed - 2025-11-19

- **Sidebar Sticky Behavior**: Improved sticky positioning
  - Full viewport height calculation: calc(100vh-5rem)
  - Added overflow-y-auto for scrollable content
  - Better scroll experience on long TOC/page lists
  - Maintains position during page scroll
- **Documentation Update**: Aligned all status documentation
  - Updated README.md: Phase 4 complete status
  - Updated ROADMAP.md: Removed Phase 4.6-4.9 planning sections (issues resolved)
  - Updated CLAUDE.md: Current project state, testing commands, architecture notes
  - Updated PROJECT_STATUS.md: Reflects Phase 4 completion
- **Component Flags**: Added TODO comments to viewer components
  - Flagged custom components for potential migration to shadcn/ui
  - BlockTree, Sidebar, Breadcrumbs, NodeContent marked for future refactor

### Fixed - 2025-11-19

- **Slug-based URL Routing**: Fixed page lookup after namespace removal
  - `getNodeByPath()` now slugifies page names and matches against URL slugs
  - URLs like `/test/marketplace-demo` now correctly find pages with spaces like "Marketplace demo"
  - Resolves 404 errors when accessing pages via slugified URLs

### Fixed - 2025-11-18

- **Collapsible Blocks**: Fixed tab indentation parsing in markdown-parser.ts
  - Tabs now correctly count as 1 indent level (previously calculated as 0)
  - All blocks with children (h2, h3, etc.) now properly collapsible
  - Fixes test failure: "Blocks with children are collapsible"
- **Default Page**: Workspace root now redirects to /contents instead of first page
- **Slugification**: All URL slugs now properly lowercase (e.g., "Advanced Queries" → "/advanced-queries")
- **Block Navigation**: Collapsible blocks now support ctrl/cmd+click to navigate to block anchor
- **Backlinks**: Added "Cited by" section showing pages with [[page]] references
- **Backlinks**: Added "Related" section showing pages with ((block-uuid)) references
- **Type Safety**: Fixed TypeScript errors in content ingestion (Node vs NewNode types)
- **Tests**: Comprehensive frontend test suite covering all display requirements

### Changed - 2025-11-18

- BlockTree component: Normal click toggles collapse, ctrl/cmd+click navigates
- extractNamespaceAndSlug() now slugifies all path segments for lowercase URLs
- Page template includes backlinks sections at bottom
- Test suite expanded from 9 to 12 comprehensive tests

### Changed - 2025-11-17

- **Phase 4 Design Decisions Finalized**:
  - All open questions resolved, ready for implementation
  - **Slugification:** Follow industry best practices
    - Lowercase, hyphens, ASCII transliteration, preserve `/` for namespaces
    - Reference: https://thetexttool.com/blog/demystifying-slugification
    - Example: "guides/Getting Started" → "guides/getting-started"
  - **References:** Compute dynamically, no table
    - Use PPR + indexes for performance
    - Real-time queries, page links only (no context snippets)
    - CitedBySection (+1 refs): open by default
    - RelatedSection (+2 refs): closed by default
  - **Sidebar:** 4-section layout
    - Section 1: Placeholder (future: logo/search)
    - Section 2: Back button (sessionStorage, n-1 page)
    - Section 3: "All Pages" button (opens modal with index)
    - Section 4: Table of Contents (client-side, from headings)
  - **Default Page:** User configurable
    - Set in repo setup/settings
    - Fallback: user choice → "contents" → 404
    - No complex fallback chain
  - **Performance:** No pagination, client-side TOC
  - Updated PHASE4_ISSUES.md with decisions
- **Phase 4 Status Update** (2025-11-17):
  - Phase 4 marked INCOMPLETE - discovered 9 critical issues blocking production
  - Created comprehensive repair roadmap (docs/PHASE4_ISSUES.md)
  - Created test plan updates (docs/PHASE4_TEST_PLAN.md)
  - Issues identified:
    1. Collapsible blocks not clickable/redirectable
    2. Blocks missing collapse functionality
    3. Multi-word page slugs broken (404s)
    4. Case-sensitive URLs (diverges from Logseq)
    5. Empty pages (missing reference display)
    6. Missing #hashtag links
    7. No default "contents" page
    8. Broken sidebar structure (should be TOC, not index)
    9. No breadcrumbs
  - Estimated repair time: 2-3 weeks (Phases 4.6-4.9)
  - Blocks Phase 5 deployment pipeline work

### Added

- **Automated E2E Testing**:
  - **.test.env configuration file** - Centralized test configuration (gitignored)
  - **scripts/setup-test-workspace.ts** - Automated test user/workspace creation via direct DB operations
    - Creates user with bcrypt password hash
    - Creates workspace with configured slug
    - Connects Git repository automatically
    - Idempotent (safe to run multiple times)
  - **scripts/trigger-sync.ts** - Trigger Git sync programmatically
  - **Updated test-e2e.sh** - Now fully automated (except sync wait & UI verification)
    - Reads configuration from .test.env
    - Auto-creates test user via DB (no manual signup needed)
    - Auto-connects Git repository (no dashboard interaction needed)
    - Only manual steps: sync wait confirmation + UI visual checks
- **Testing Infrastructure Improvements**:
  - tsx dev dependency for running TypeScript scripts
  - jsdom + @types/jsdom dev dependencies for HTML parsing
  - scripts/validate-content.ts - TypeScript validation script replacing inline Node.js code
  - scripts/compare-with-logseq.ts - Database structure comparison against official Logseq docs
    - Validates: total pages (~917), non-journals (~695), journals (~222), key pages exist
    - **Content validation**: Detects empty/placeholder pages, validates critical pages have meaningful content
    - Checks blocks have substantial HTML (>50 chars), detects "TODO", "placeholder", "coming soon" patterns
    - Fails tests if critical pages (contents, Tutorial, FAQ) lack real content
    - Checks block quality: UUIDs (>90%), HTML rendered (>90%), parent relationships (>80%)
    - Integrated into test-e2e.sh workflow
  - Fixed test-e2e.sh module resolution error (Cannot find module './lib/db.js')
  - Updated TESTING.md with comprehensive comparison test documentation
  - Documented future test improvements roadmap (link integrity, visual comparison, performance tests)
- **Logseq Reference Processing** (Phase 4.5):
  - Page references `[[page]]` → clickable internal links
  - Block references `((uuid))` → hash links to blocks
  - Task markers TODO/DOING/DONE/LATER/NOW → static checkboxes with color coding
  - Priority levels [#A]/[#B]/[#C] → styled badges
  - HTML post-processor (modules/logseq/process-references.ts)
  - cheerio dependency for HTML parsing
- **Workspace Configuration**:
  - embedDepth field (default 5) for future embed rendering
  - Migration 0001_special_fabian_cortez.sql
- **CSS Styling** (app/blocks.css):
  - .page-reference - dashed underline, blue color
  - .block-reference - monospace, gray background
  - .task-marker variants (todo/doing/done/later/now)
  - .priority variants (A/B/C with colors)
  - Dark mode support for all new elements
- **Testing Infrastructure** (Production-Grade):
  - Official Logseq docs graph (test-data/logseq-docs-graph/) - 238 pages, 75 journals
  - Real-world test data from https://github.com/logseq/docs
  - Benchmark against live site: https://docs.logseq.com
  - **Source code verification** (scripts/verify-implementation.sh) - Checks actual implementation
  - **Automated pre-flight test** (scripts/test-phase4.sh) - Validates Phase 4 before changes
  - End-to-end test script (scripts/test-e2e.sh)
  - Content validation script (scripts/validate-content.js)
  - Comprehensive testing guide (docs/TESTING.md)
  - UI verification checklist (15+ test cases)
  - 75+ automated checks (35 source + 40 build/files)
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
- **Phase 3 Complete**: Logseq Processing
  - Storage module with S3-compatible abstraction (modules/storage/)
  - S3 client for MinIO (local) and AWS S3 (prod)
  - Asset upload functionality for images/attachments
  - **Proper export-logseq-notes integration** (inspired by dimfeld/website):
    - Template file for HTML output with metadata (title, tags, dates)
    - Comprehensive TOML configuration with Tailwind-compatible CSS classes
    - Rhai script for page processing and custom HTML attributes
    - Template specified in config (fixes "no default template" error)
  - Rust tool integration (modules/logseq/export.ts)
  - Shell execution wrapper for export-logseq-notes CLI
  - HTML output parser with metadata extraction (modules/logseq/parse.ts)
  - Meta tag parsing (title, tags, created/updated dates)
  - Body content extraction (strips HTML wrapper)
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
  - **Export Configuration Features**:
    - Tag collection with omit list
    - Link handling with base URL
    - Code syntax highlighting with class prefix
    - Em dash conversion
    - Header promotion (h1 → h2, etc.)
    - Block and page embeds support
    - Custom wrapper elements and CSS classes via block attributes
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
- **Phase 4 Complete**: Public Viewer
  - Public viewer routing (app/[workspaceSlug]/[...path]/page.tsx)
  - Workspace layout with sticky header (app/[workspaceSlug]/layout.tsx)
  - Workspace index page with auto-redirect to first content
  - Server-side rendering of pre-compiled HTML
  - **Navigation Components** (components/viewer/):
    - Sidebar with hierarchical tree navigation
    - Breadcrumbs for nested page hierarchy
    - Active page highlighting
    - Journal pages section (10 most recent)
  - **Content Rendering**:
    - NodeContent component with Tailwind prose styling
    - Comprehensive typography classes (headings, links, code, blockquotes)
    - Tag display on pages (#hashtag style)
    - Responsive layout with max-width constraints
  - **Performance Optimizations**:
    - Experimental PPR (Partial Pre-rendering) enabled
    - React cache for all queries (workspace, nodes, breadcrumbs)
    - Optimized database queries with proper indexes
  - **User Experience**:
    - Empty state for workspaces without content
    - 404 handling for missing workspaces and nodes
    - Mobile-responsive sidebar and content
    - Clean, minimal design inspired by modern documentation sites
- **Phase 5 Complete**: Deployment Pipeline & Polish
  - **Performance & Caching**:
    - Added "use cache" directive to all content queries
    - React cache for optimal query performance
    - Cache invalidation prepared for deployments
  - **Loading States**:
    - Workspace loading skeleton (app/[workspaceSlug]/loading.tsx)
    - Node page loading skeleton (app/[workspaceSlug]/[...path]/loading.tsx)
    - Animated skeleton screens for better UX
  - **Deployment Pipeline**:
    - Deployment logs already tracked in deployment_history table
    - Build logs stored with each deployment
    - Automatic cache invalidation on successful deployment
    - Console logging for deployment status
- **Logseq Block-Level Integration** (Complete Revamp):
  - **Database Schema Evolution**:
    - Added parentId to nodes table (self-referential foreign key for hierarchy)
    - Added order field (block ordering within siblings)
    - Added nodeType field ('page' | 'block' discriminator)
    - Added blockUuid field (Logseq block UUID from id:: property)
    - Pages have html=null, blocks have rendered HTML
    - Composite indexes for (parentId, order) and (blockUuid)
  - **Markdown Parser** (modules/logseq/markdown-parser.ts):
    - Parses Logseq .md files to extract block structure
    - Extracts block UUIDs from id:: properties
    - Builds parent-child relationships from indentation
    - Flattens block tree for database insertion
    - Preserves block order and hierarchy
  - **Block HTML Rendering**:
    - Uses `marked` library for markdown to HTML conversion
    - Renders each block's markdown independently
    - Preserves formatting (bold, italic, links, code, lists)
    - Simple, reliable, and maintainable approach
  - **Rust Tool Integration**:
    - Forked export-logseq-notes to modules/logseq/export-tool/
    - Vendored as part of codebase (removed .git directory)
    - Built and installed to ~/.cargo/bin/ (108MB release binary)
    - Updated dependencies (cargo update) to fix time crate compatibility
    - Tool used for page-level metadata extraction only
  - **Sync Integration** (modules/content/actions.ts):
    - ingestLogseqGraph() creates both page and block nodes
    - Step 1: Parse markdown for block structure (hierarchy + UUIDs)
    - Step 2: Run Rust tool for page metadata
    - Step 3: Create page nodes (html=null)
    - Step 4: Create block nodes with markdown-rendered HTML
    - Step 5: Update parentId for proper block→block and block→page relationships
    - Step 6: Recalculate depth from actual parent chain in database
    - **Critical Fix**: Blocks now properly linked to parent blocks, not all to page
    - **Critical Fix**: Depth calculated from database parent chain, not markdown structure
  - **BlockTree UI Component** (components/viewer/BlockTree.tsx):
    - Client-side React component for Logseq-style block tree
    - Clickable bullets for navigation (navigate to block via #hash)
    - Collapsible blocks (click bullet with children to expand/collapse)
    - Recursive rendering of block hierarchy
    - Block state management with useState
    - Links to blocks via blockUuid hash
  - **Logseq-Style CSS** (app/blocks.css):
    - Hover effects on blocks (gray-100 background)
    - Bullet point hover effects (blue-500 color, scale transform)
    - Target block highlighting (:target with yellow-100 background)
    - Smooth animations and transitions
    - Indentation for nested blocks
  - **Query Layer**:
    - getAllBlocksForPage() query (modules/content/queries.ts)
    - Fetches all blocks for a page by pageName
    - Ordered by order field
    - Cached with "use cache" directive
  - **Page Viewer Integration**:
    - app/[workspaceSlug]/[...path]/page.tsx now fetches blocks
    - Renders BlockTree if blocks exist
    - Shows "No blocks yet" if empty
    - blocks.css imported in layout.tsx

### Changed

- **Test Data**: Replaced synthetic test graph with official Logseq documentation
  - 238 production pages vs 7 synthetic pages
  - 75 real journal entries
  - Thousands of real-world blocks
  - Can benchmark against docs.logseq.com
- README Quick Start now references automated scripts
- Documentation order prioritizes SCRIPTS.md
- Landing page completely redesigned with Vercel-style UI
- App directory structure expanded with auth and dashboard route groups
- Git repository connection triggers initial sync automatically
- Git clone now validates branch exists before attempting clone
- Settings page placeholder updated from "ghp*..." to "github_pat*..." for fine-grained tokens
- **Auto-correction behavior**: Git sync now automatically detects and uses default branch if specified branch doesn't exist, then persists correct branch (no manual user intervention required per CRUD guidelines)
- **Block HTML rendering approach**: Switched from HTML parsing to direct markdown rendering with `marked` library (simpler, more reliable)
- **Content storage model**: Pages now have html=null (blocks contain the content), following true Logseq architecture
- **Block hierarchy**: Fixed to use proper block→block parent relationships instead of all blocks pointing to page
- **Depth calculation**: Now calculated from actual database parent chain instead of markdown structure

### Deprecated

- N/A

### Removed

- modules/logseq/extract-blocks.ts (HTML extraction module - replaced with markdown rendering)
- node-html-parser dependency (no longer needed)
- backend-services/export-logseq-notes (git submodule - replaced with vendored copy in modules/)

### Fixed

- **Frontend Display: "No blocks yet" Error** (Critical Fix):
  - **Root Cause**: getNodeByPath() missing `nodeType='page'` filter
  - Query was randomly returning block nodes instead of page nodes
  - Both page and block nodes have namespace/slug fields (caused confusion)
  - **Fix**: Added `eq(nodes.nodeType, "page")` to [modules/content/queries.ts:29](modules/content/queries.ts#L29)
  - **Impact**: Pages now display correctly (462 blocks on /contents, 319 on /Queries)
  - **Test Infrastructure**: Created scripts/test-frontend-e2e.sh for browser-based E2E tests
  - **Diagnostic Tool**: Created scripts/diagnose-frontend.ts (found root cause in 30 seconds)
  - **Documentation**: Complete fix log in [docs/FRONTEND_FIX_LOG.md](docs/FRONTEND_FIX_LOG.md)
  - **Cache Clearing**: Must clear .next/ directory after query changes (React "use cache" caching)
- **journals/ directory requirement**: export-logseq-notes expects journals/ to exist
  - Auto-create journals/ directory during export (modules/logseq/export.ts)
  - Prevents "No such file or directory" error
  - Works with graphs that only have pages/ directory
- Removed `revalidateTag` from sync function (was causing "used during render" error)
- **Next.js 16 uncached data errors**: Wrapped ALL async params access in Suspense (cacheComponents compatible)
  - **Critical pattern**: `await params` MUST happen inside Suspense, not before
  - Dashboard page: DashboardContent wrapper inside Suspense
  - Dashboard layout: DashboardLayoutContent wrapper inside Suspense (requireAuth → cookies)
  - Workspace layout: WorkspaceLayoutWrapper inside Suspense (await params)
  - Workspace index: WorkspaceIndexWrapper inside Suspense (await params)
  - Node page: NodePageWrapper inside Suspense (await params)
  - All routes now use Partial Prerender (◐) with proper streaming
- **cacheComponents compatibility**: Replaced `dynamic = "force-dynamic"` with proper Suspense pattern
- **Build failures (Google Fonts)**: Removed Geist/Geist_Mono fonts (network errors), using system fonts
- **Block hierarchy broken (all depth 0)**: Fixed parentId assignment to use block→block relationships, not all→page
- **Block depth incorrect**: Now calculated from actual database parent chain after parentId is set
- **Block HTML not showing**: Switched from fragile HTML parsing to direct markdown rendering with `marked`
- **Performance: N+1 query problem in depth calculation**:
  - Replaced recursive DB queries with in-memory calculation (calculateBlockDepthInMemory)
  - Built parentIdMap and pageIds Set during parentId updates
  - Eliminated individual DB query per block (was causing slow page loads)
  - modules/content/actions.ts: calculateBlockDepthFromParents removed
- **Performance: Missing database index**:
  - Added workspacePageNameNodeTypeIdx index on (workspaceId, pageName, nodeType)
  - Optimizes getAllBlocksForPage query (common read path)
- **BlockTree duplication bug**:
  - Fixed getChildBlocks receiving subset instead of all blocks
  - Removed double-match condition (parentId OR blockUuid)
  - Fixed top-level detection to properly find page node
  - components/viewer/BlockTree.tsx rewritten with simpler logic
- **Query optimization**:
  - getAllNodes now filters nodeType='page' (was returning ALL nodes including blocks)
  - getJournalNodes now filters nodeType='page' (was returning blocks)
  - getAllBlocksForPage now returns page node + blocks (BlockTree needs page node)
  - Sidebar navigation no longer processes thousands of individual blocks
- **Block ID mapping broken (blocks not displaying)**:
  - Root cause: Blocks without explicit `id::` property have uuid=null
  - Previous code skipped blocks without UUIDs when setting parentId
  - Fix: Map blocks by position in insertion order (pageBlocksMap)
  - Blocks without UUIDs now correctly linked to parents via indent level
  - modules/content/actions.ts: Enhanced parentId mapping (lines 218-315)
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
- **Phase 3: Template error** - Fixed "Config has no default template" error by adding proper template file to TOML config
- **Phase 3: Metadata extraction** - Now properly extracts tags, dates, and title from HTML meta tags
- **Phase 3: Configuration** - Comprehensive TOML config with all export-logseq-notes options (inspired by dimfeld/website best practices)
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
