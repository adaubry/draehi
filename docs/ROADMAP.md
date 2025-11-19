# Draehi Roadmap

**Vision:** Deploy your Logseq graph to the web in 60 seconds.

**Status:** Phase 4 Complete → Phase 4 bis planning

---

## Phase 0: Foundation ✅ COMPLETE

**Goal:** Establish project structure, docs, and dev environment

**Tasks:**
- [x] Initialize Next.js project with TypeScript + Tailwind
- [x] Create documentation structure (CLAUDE.md, ROADMAP, CHANGELOG, DIRECTORY)
- [x] Define CRUD and Performance guidelines
- [x] Set up database schema with Drizzle ORM
- [x] Create modular monolith folder structure
- [x] Add core dependencies (Drizzle, Zod, iron-session, etc)
- [x] Configure Turbopack and build pipeline
- [x] Set up type-check script

**Duration:** 1 day

---

## Phase 1: Core Infrastructure ✅ COMPLETE

**Goal:** Database, auth, basic workspace functionality

### 1.1 Database Layer
- [x] Create Drizzle schema for all tables
  - `users`, `workspaces`, `git_repositories`, `nodes`, `deployment_history`
- [x] Set up PostgreSQL (Neon database)
- [x] Create migrations
- [x] Add composite indexes for performance
- [x] Implement queries in modules

### 1.2 Authentication Module
- [x] Implement iron-session for auth
- [x] User signup/login routes
- [x] Session management
- [x] Protected routes middleware
- [x] One workspace per user constraint

### 1.3 Workspace Module
- [x] Workspace creation on signup
- [x] Workspace slug generation
- [x] Basic workspace settings page
- [x] Workspace dashboard UI

**Deliverable:** Users can sign up, log in, and have a workspace created automatically ✅

---

## Phase 2: Git Integration ✅ COMPLETE

**Goal:** Connect Git repos, clone Logseq graphs

### 2.1 Git Connection
- [x] UI to connect Git repository
- [x] Support GitHub personal access tokens
- [x] Store repo credentials securely
- [x] Settings page with connection form

### 2.2 Git Operations
- [x] Clone repository logic (shell commands)
- [x] Pull updates logic
- [x] Error handling for invalid repos
- [x] Sync status tracking
- [x] Background sync on connection
- [x] Cleanup temp directories

### 2.3 Webhook System
- [x] GitHub webhook endpoint
- [x] Webhook validation structure
- [x] Trigger deployment on push
- [x] Manual deployment trigger

**Deliverable:** Users can connect a Git repo and have it cloned ✅

---

## Phase 3: Logseq Processing ✅ COMPLETE

**Goal:** Process Logseq graphs into HTML

### 3.1 Rust Tool Integration
- [x] Install/bundle export-logseq-notes
- [x] Call Rust tool from Node.js
- [x] Parse Rust tool output
- [x] Extract HTML, metadata, frontmatter
- [x] Handle errors gracefully

### 3.2 Content Ingestion
- [x] Parse Logseq pages into nodes
- [x] Extract namespace from page names
- [x] Calculate depth automatically
- [x] Store pre-rendered HTML in database
- [x] Store original markdown as backup
- [x] Extract metadata (tags, properties)

### 3.3 Journal Pages
- [x] Detect journal pages
- [x] Parse journal dates
- [x] Create journal navigation (implemented in Phase 4)
- [x] Sort by date (implemented in Phase 4)

### 3.4 Asset Storage
- [x] S3-compatible storage abstraction
- [x] MinIO local setup for MVP
- [x] Asset upload from Logseq repos
- [x] S3 URL replacement in HTML
- [ ] Production AWS S3 setup (when deploying)

**Deliverable:** Logseq graphs are processed and stored as nodes ✅

---

## Phase 4: Public Viewer 🚧 IN PROGRESS (Issues Found)

**Goal:** Display Logseq content on public URLs

**Status Update (2025-11-17):** Phase 4 marked INCOMPLETE after discovering 9 critical issues. See [PHASE4_ISSUES.md](./PHASE4_ISSUES.md) for detailed repair roadmap.

### 4.1 Routing (Partial - Issues Found)
- [x] Catch-all route `[workspaceSlug]/[...path]`
- [x] Namespace-based URL generation
- [ ] ❌ **BROKEN:** Multi-word page slugs (spaces cause 404s)
- [ ] ❌ **BROKEN:** Case-sensitive URLs (should be case-insensitive)
- [ ] ❌ **MISSING:** Default page redirect (/{workspace} → /contents)
- [ ] ❌ **MISSING:** Breadcrumb generation
- [x] 404 handling

### 4.2 Content Rendering (Partial - Issues Found)
- [x] Render pre-compiled HTML
- [x] Style Logseq content (Vercel aesthetic)
- [x] Image optimization (via S3 URLs)
- [x] Code syntax highlighting (via Tailwind prose)
- [x] Block references display (basic)
- [x] Page references display (basic)
- [ ] ❌ **MISSING:** Reference sections (+1 Cited By, +2 Related)
- [ ] ❌ **MISSING:** Empty pages show nothing (should show refs)

### 4.3 Navigation (Partial - Issues Found)
- [ ] ❌ **BROKEN:** Sidebar (shows index, should show TOC)
- [ ] ❌ **MISSING:** Breadcrumbs for hierarchy
- [ ] ❌ **BROKEN:** Collapsible blocks not clickable/navigable
- [ ] ❌ **BROKEN:** Some blocks missing collapse functionality
- [x] Mobile-responsive design
- [ ] Search functionality (deferred to Phase 6)

### 4.4 Performance (Partial)
- [x] Implement PPR (Partial Pre-rendering)
- [x] Add React cache to queries
- [x] Optimized database indexes
- [ ] Prefetch links (future optimization)
- [ ] Image lazy loading (future optimization)
- [ ] Measure TTFB, FCP, LCP (when deployed)

### 4.5 Logseq Features (Partial - Issues Found)
- [x] Page references `[[page]]`
- [x] Block references `((uuid))`
- [x] Task markers (TODO/DOING/DONE)
- [x] Priority badges ([#A]/[#B]/[#C])
- [ ] ❌ **MISSING:** Hashtag links `#tag`
- [ ] Page embeds (deferred to Phase 4.7)
- [ ] Block embeds (deferred to Phase 4.8)

**Deliverable:** ❌ INCOMPLETE - 9 critical issues found, blocks production

---

## Phase 4.6: Core Fixes 🚧 PLANNED (Week 1)

**Goal:** Fix critical navigation & routing issues

### Tasks
- [ ] Slugification overhaul (Google-style, URL-safe)
- [ ] Case-insensitive URL routing
- [ ] Block click navigation (bullet → scroll to #block)
- [ ] Block collapse fix (detect children correctly)
- [ ] Default page redirect logic

**Deliverable:** All pages accessible, blocks navigable/collapsible

**Estimated Time:** 1 week

---

## Phase 4.7: References System 🚧 PLANNED (Week 1-2)

**Goal:** Implement Logseq-style backlinks

### Tasks
- [ ] Database: page_references table
- [ ] Backlink queries (+1 Cited By, +2 Related)
- [ ] CitedBySection component (collapsible, open by default)
- [ ] RelatedSection component (collapsible, closed by default)
- [ ] Context snippets for each reference
- [ ] Integration into page layout

**Deliverable:** All pages show references, no empty pages

**Estimated Time:** 1 week

---

## Phase 4.8: Missing Features 🚧 PLANNED (Week 2)

**Goal:** Hashtags, sidebar, breadcrumbs

### Tasks
- [ ] Hashtag links (`#tag` → page link)
- [ ] Sidebar rebuild (3-section: placeholder, back, TOC)
- [ ] Table of Contents component (auto-generated from headings)
- [ ] Breadcrumbs component (namespace path)
- [ ] Default page configuration in settings

**Deliverable:** Complete navigation UX matching Logseq

**Estimated Time:** 1 week

---

## Phase 4.9: Testing & Validation 🚧 PLANNED (Week 2-3)

**Goal:** Ensure all fixes work end-to-end

### Tasks
- [ ] Create test-slugification.ts
- [ ] Create test-references.ts
- [ ] Create test-navigation.ts
- [ ] Create test-features.ts
- [ ] Update test-phase4.sh
- [ ] Update validate-content.ts
- [ ] Update compare-with-logseq.ts
- [ ] Manual E2E validation
- [ ] Documentation updates

**Deliverable:** Full test suite passing, Phase 4 complete

**Estimated Time:** 1 week

**See:** [PHASE4_TEST_PLAN.md](./PHASE4_TEST_PLAN.md) for detailed test updates

---

## Phase 5: Deployment Pipeline (Week 5-6) ⏸️ BLOCKED

**Status:** Blocked by Phase 4 issues - deferred until Phase 4.6-4.9 complete

**Goal:** Automatic deployments on Git push

### 5.1 Deployment Logic
- [ ] Trigger deployment on webhook
- [ ] Pull latest changes from Git
- [ ] Run Rust export tool
- [ ] Update database with new content
- [ ] Track deployment history
- [ ] Show deployment status in UI

### 5.2 Build Logs
- [ ] Store deployment logs
- [ ] Display logs in dashboard
- [ ] Show errors clearly
- [ ] Retry failed deployments

### 5.3 Cache Invalidation
- [ ] Invalidate cache on deployment
- [ ] Use revalidateTag() properly
- [ ] Clear stale content

**Deliverable:** Push to Git → auto-deploy → live site

---

## Phase 6: Polish & MVP Launch (Week 6-7)

**Goal:** Production-ready MVP

### 6.1 UI Polish
- [ ] Vercel-style components (shadcn/ui)
- [ ] Dashboard redesign
- [ ] Settings page
- [ ] Deployment history UI
- [ ] Error states
- [ ] Loading states

### 6.2 Documentation
- [ ] User-facing README
- [ ] Setup guide
- [ ] Deployment guide
- [ ] Troubleshooting guide
- [ ] API documentation (if needed)

### 6.3 Testing
- [ ] Manual testing all flows
- [ ] Test with real Logseq graphs
- [ ] Performance testing
- [ ] Mobile testing
- [ ] Cross-browser testing

### 6.4 Production Setup
- [ ] Deploy to Vercel
- [ ] Set up production database
- [ ] Configure environment variables
- [ ] Set up monitoring
- [ ] Set up error tracking (Sentry)

**Deliverable:** MVP live, users can deploy Logseq graphs

---

## Phase 7: Post-MVP Features (Week 8+)

### 7.1 Advanced Features
- [ ] Custom domains
- [ ] Multiple workspaces per user
- [ ] Preview deployments (draft branches)
- [ ] Scheduled syncs
- [ ] Manual sync button
- [ ] Rollback deployments

### 7.2 Performance Optimization
- [ ] Edge runtime for auth
- [ ] Advanced caching strategies
- [ ] Image CDN
- [ ] Lazy loading improvements

### 7.3 SEO Features
- [ ] Sitemap generation
- [ ] robots.txt
- [ ] Meta tags customization
- [ ] Open Graph images
- [ ] Structured data

### 7.4 Analytics
- [ ] Page view tracking
- [ ] Popular pages
- [ ] User analytics dashboard

---

## Future Considerations

**Not prioritized, but ideas:**
- Real-time editing (breaks Git model)
- Collaboration features
- Comments on pages
- Dark mode toggle
- Custom themes
- Plugin system
- API for external integrations
- Export to other formats
- Logseq plugin for one-click deploy

---

## Success Metrics

**MVP Success Criteria:**
- [ ] Users can sign up in < 30 seconds
- [ ] Users can connect Git repo in < 60 seconds
- [ ] First deployment completes in < 2 minutes
- [ ] Public site loads in < 100ms TTFB
- [ ] PageSpeed score 90+
- [ ] 10 beta users successfully deploy

**Performance Targets:**
- TTFB: < 100ms
- FCP: < 500ms
- LCP: < 1.5s
- CLS: < 0.1

**Cost Targets:**
- < $1/month per workspace (1000 pageviews)
- Scale to 1000 users on < $500/month

---

**Last Updated:** 2025-11-17
**Current Phase:** Phase 4.6-4.9 (Repair) - Fixing Critical Issues Before Phase 5

---

## Phase 4 bis: Rich Content Support 📋 PLANNED

**Goal:** Add asset handling, flashcards, and embedded media

### 4b.1 Asset Management
- [ ] S3/MinIO integration for images, PDFs, videos
- [ ] Asset upload during Git sync
- [ ] Optimize images (WebP conversion, responsive sizes)
- [ ] CDN integration for fast delivery
- [ ] Asset versioning and cache busting

### 4b.2 Flashcard Support
- [ ] Parse Logseq flashcard syntax (cloze, basic, reversed)
- [ ] Flashcard review UI with spaced repetition
- [ ] Progress tracking per workspace
- [ ] Mobile-friendly swipe interface
- [ ] Export to Anki format

### 4b.3 Embedded Media
- [ ] YouTube embed support (parse URLs → iframe)
- [ ] Twitter/X embed support
- [ ] Vimeo embed support
- [ ] Audio file playback
- [ ] PDF viewer integration

**Duration:** 2-3 weeks

