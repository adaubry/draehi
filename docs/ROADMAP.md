# Draehi Roadmap

**Vision:** Deploy your Logseq graph to the web in 60 seconds.

**Status:** Phase 4 Complete - Public Viewer live

---

## Phase 0: Foundation - COMPLETE

**Goal:** Establish project structure, docs, and dev environment

- [x] Initialize Next.js project with TypeScript + Tailwind
- [x] Create documentation structure
- [x] Define CRUD and Performance guidelines
- [x] Set up database schema with Drizzle ORM
- [x] Create modular monolith folder structure

---

## Phase 1: Core Infrastructure - COMPLETE

**Goal:** Database, auth, basic workspace functionality

- [x] Create Drizzle schema for all tables
- [x] Set up PostgreSQL (Neon database)
- [x] Implement iron-session for auth
- [x] User signup/login routes
- [x] Protected routes middleware
- [x] One workspace per user constraint
- [x] Workspace creation on signup

---

## Phase 2: Git Integration - COMPLETE

**Goal:** Connect Git repos, clone Logseq graphs

- [x] UI to connect Git repository
- [x] Support GitHub personal access tokens
- [x] Clone repository logic (shell commands)
- [x] Error handling for invalid repos
- [x] Sync status tracking
- [x] GitHub webhook endpoint
- [x] Manual deployment trigger

---

## Phase 3: Logseq Processing - COMPLETE

**Goal:** Process Logseq graphs into HTML

- [x] Install/bundle export-logseq-notes
- [x] Call Rust tool from Node.js
- [x] Parse Rust tool output
- [x] Extract namespace from page names
- [x] Store pre-rendered HTML in database
- [x] Extract metadata (tags, properties)
- [x] Detect and parse journal pages
- [x] S3-compatible storage abstraction
- [x] MinIO local setup for MVP
- [x] Asset upload and URL replacement

---

## Phase 4: Public Viewer - COMPLETE

**Goal:** Display Logseq content on public URLs

- [x] Catch-all route `[workspaceSlug]/[...path]`
- [x] Namespace-based URL generation
- [x] Default page redirect
- [x] Breadcrumb generation
- [x] Render pre-compiled HTML
- [x] Style Logseq content
- [x] Sidebar with page index
- [x] Collapsible blocks
- [x] Block navigation
- [x] Mobile-responsive design
- [x] Page references `[[page]]`
- [x] Block references `((uuid))`
- [x] Task markers (TODO/DOING/DONE)
- [x] Priority badges
- [x] Block hierarchy with parent_id

---

## Phase 5: Deployment Pipeline - NEXT

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

---

## Phase 6: Polish & MVP Launch

**Goal:** Production-ready MVP

### 6.1 UI Polish
- [ ] Vercel-style components (shadcn/ui)
- [ ] Dashboard redesign
- [ ] Error states
- [ ] Loading states

### 6.2 Documentation
- [ ] User-facing README
- [ ] Setup guide
- [ ] Deployment guide

### 6.3 Testing
- [ ] Manual testing all flows
- [ ] Performance testing
- [ ] Mobile testing

### 6.4 Production Setup
- [ ] Deploy to production
- [ ] Set up production database
- [ ] Set up monitoring

---

## Future Features

**Post-MVP:**
- Custom domains
- Multiple workspaces per user
- Preview deployments
- Scheduled syncs
- Rollback deployments
- Sitemap generation
- Analytics

---

## Success Metrics

**MVP Success Criteria:**
- Users can sign up in < 30 seconds
- Users can connect Git repo in < 60 seconds
- First deployment completes in < 2 minutes
- Public site loads in < 100ms TTFB
- PageSpeed score 90+

**Performance Targets:**
- TTFB: < 100ms
- FCP: < 500ms
- LCP: < 1.5s
- CLS: < 0.1

---

**Last Updated:** 2025-11-23
