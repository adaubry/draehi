# Draehi Roadmap

**Vision:** Deploy your Logseq graph to the web in 60 seconds.

**Status:** Genesis → MVP in progress

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

## Phase 2: Git Integration ✅ COMPLETE (CURRENT)

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

## Phase 3: Logseq Processing (Week 3-4)

**Goal:** Process Logseq graphs into HTML

### 3.1 Rust Tool Integration
- [ ] Install/bundle export-logseq-notes
- [ ] Call Rust tool from Node.js
- [ ] Parse Rust tool output
- [ ] Extract HTML, metadata, frontmatter
- [ ] Handle errors gracefully

### 3.2 Content Ingestion
- [ ] Parse Logseq pages into nodes
- [ ] Extract namespace from page names
- [ ] Calculate depth automatically
- [ ] Store pre-rendered HTML in database
- [ ] Store original markdown as backup
- [ ] Extract metadata (tags, properties)

### 3.3 Journal Pages
- [ ] Detect journal pages
- [ ] Parse journal dates
- [ ] Create journal navigation
- [ ] Sort by date

**Deliverable:** Logseq graphs are processed and stored as nodes

---

## Phase 4: Public Viewer (Week 4-5)

**Goal:** Display Logseq content on public URLs

### 4.1 Routing
- [ ] Catch-all route `[workspace]/[...slug]`
- [ ] Namespace-based URL generation
- [ ] Breadcrumb generation
- [ ] Sidebar navigation
- [ ] 404 handling

### 4.2 Content Rendering
- [ ] Render pre-compiled HTML
- [ ] Style Logseq content (Vercel aesthetic)
- [ ] Image optimization
- [ ] Code syntax highlighting
- [ ] Block references display
- [ ] Page references display

### 4.3 Navigation
- [ ] Sidebar with all pages
- [ ] Breadcrumbs for hierarchy
- [ ] Search functionality (basic)
- [ ] Mobile-responsive design

### 4.4 Performance
- [ ] Implement PPR (Partial Pre-rendering)
- [ ] Add "use cache" to queries
- [ ] Prefetch links
- [ ] Optimize images (first 15 eager, rest lazy)
- [ ] Measure TTFB, FCP, LCP

**Deliverable:** Public workspace URLs work and display content

---

## Phase 5: Deployment Pipeline (Week 5-6)

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

**Last Updated:** 2025-11-16
**Current Phase:** Phase 2 Complete - Ready for Phase 3 (Logseq Processing)
