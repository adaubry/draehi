# Navigation System Guidelines

**Status:** Implementation Phase
**Updated:** 2025-01-19

## Overview

Complete navigation revamp with intelligent breadcrumbs, three-part sidebar, and mobile-first responsive design.

## Core Principles

1. **History-Aware Breadcrumbs** - n-2 tracking for smart back navigation
2. **Contextual Sidebar** - Different behavior for /all-pages vs regular pages
3. **Mobile-First** - Hamburger drawer, 320px viewport minimum
4. **No Search** - Simple navigation, no search functionality

---

## A) Breadcrumbs System

### Format

Always 3 segments: `homepage / last page / current page`

```
../<n-2-page>/<current-page>
```

### Navigation History (n-2 Tracking)

**Storage:** `sessionStorage` (cleared on tab close)

**Structure:**
```typescript
// Key: 'draehi-nav-history'
{
  currentPath: string,      // Current URL path
  previousPath: string | null,  // n-1
  n2Path: string | null          // n-2 for breadcrumbs
}
```

**Update Logic:**
- On every navigation click → shift paths
- Direct landing (bookmark/refresh) → n-2 = null
- Show only `../<current>` when n-2 is null

### Examples

**Scenario 1: From homepage**
```
Navigate: / → /contents
Breadcrumbs: ../contents
History: { current: '/contents', prev: null, n2: null }
```

**Scenario 2: Second navigation**
```
Navigate: /contents → /docs
Breadcrumbs: ../contents/docs
History: { current: '/docs', prev: '/contents', n2: null }
```

**Scenario 3: Third navigation (n-2 appears)**
```
Navigate: /docs → /web
Breadcrumbs: ../docs/web
History: { current: '/web', prev: '/docs', n2: '/contents' }
```

**Scenario 4: Click ".." or back from /web**
```
Navigate: /web → /docs
Breadcrumbs: ../contents/docs
History: { current: '/docs', prev: '/contents', n2: null }
```

### ".." Behavior

- Always links to workspace root `/{workspaceSlug}` (which redirects to `/contents`)
- Or to n-2 if available (user preference based on context)
- Recommendation: Link to n-2 if available, else workspace root

### Browser Back Button

- Detect navigation via `usePathname()` hook
- Update history when path changes
- Works with browser forward/back

---

## B) Sidebar - Three-Part Structure

### 1. Placeholder Section (Top)

**Purpose:** Reserved for future integrations

**Specs:**
- Height: 48px
- Background: light gray (`bg-gray-50`)
- Text: "Reserved for integrations" (center aligned, `text-gray-400`)
- Border bottom: 1px gray-200

### 2. Navigation Buttons (Middle)

**Purpose:** Quick access to main views

**Buttons:**
1. **Contents** - `/contents` page (workspace default)
2. **All Pages** - `/all-pages` (new route, full page tree)

**Specs:**
- Sticky section below placeholder
- Full width buttons
- Active state styling (current route)
- Icons optional (folder + list icons)

**Example:**
```tsx
<div className="sticky top-0 z-10 bg-white border-b px-3 py-2 space-y-1">
  <Link href={`/${slug}/contents`} className={activeClass}>
    📄 Contents
  </Link>
  <Link href={`/${slug}/all-pages`} className={activeClass}>
    📚 All Pages
  </Link>
</div>
```

### 3. Dynamic Content Section (Bottom)

**Two Modes:**

#### Mode 1: On /all-pages Route
- Show full page tree (current Sidebar behavior)
- Hierarchical structure based on `pageName`
- All pages visible, nested by namespace

#### Mode 2: On Regular Page Routes
- Show **Table of Contents (TOC)**
- Display page blocks as collapsible tree
- Max 3 levels depth
- 3rd level NOT collapsed by default

**TOC Specs:**
- Query: `getAllBlocksForPage(workspace.id, node.pageName)`
- Build tree: Use `parentUuid` hierarchy
- Max depth: 3 levels
- Default state:
  - Level 1: Collapsed
  - Level 2: Collapsed
  - Level 3: Expanded (NOT collapsible)
- Empty state: "No table of contents"
- Smooth expand/collapse animation

**TOC Tree Structure:**
```typescript
type TocNode = {
  block: Node;
  depth: number;        // 1, 2, or 3
  children: TocNode[];  // Empty at depth 3
  collapsed: boolean;   // false for depth 3
};
```

---

## C) Mobile Responsiveness

### Viewport: 320px minimum

**Desktop (≥768px):**
- Sidebar always visible (left side, 256px width)
- Breadcrumbs in header
- Standard layout

**Mobile (<768px):**
- Hamburger menu (top-left header)
- Sidebar → sliding drawer from left
- Breadcrumbs sticky header (always visible)
- Touch targets: 44x44px minimum
- Drawer overlay with backdrop blur

**Drawer Behavior:**
- Open: slide in from left (300px width)
- Close: tap backdrop, hamburger, or navigate
- Animation: 200ms ease-out
- Z-index: 40 (below header z-50)

---

## D) Technical Implementation

### New Components

**1. NavigationProvider**
```typescript
// lib/navigation-context.tsx
"use client";

type NavHistory = {
  currentPath: string;
  previousPath: string | null;
  n2Path: string | null;
};

export function NavigationProvider({ children, workspaceSlug }) {
  // sessionStorage management
  // usePathname tracking
  // updateHistory function
}
```

**2. Breadcrumbs (Revamped)**
```typescript
// components/viewer/Breadcrumbs.tsx
"use client";

export function Breadcrumbs({ currentPage, n2Page }) {
  // Format: ../<n2>/<current>
  // Link to n2 or workspace root
}
```

**3. MobileSidebar**
```typescript
// components/viewer/MobileSidebar.tsx
"use client";

export function MobileSidebar({ isOpen, onClose, children }) {
  // Drawer with backdrop
  // Animation with framer-motion or CSS
}
```

**4. TableOfContents**
```typescript
// components/viewer/TableOfContents.tsx
"use client";

export function TableOfContents({ blocks, maxDepth = 3 }) {
  // Build tree from blocks
  // Collapsible components (depth 1-2)
  // Level 3 always expanded
}
```

**5. Sidebar (Updated)**
```typescript
// components/viewer/Sidebar.tsx
"use client";

export function Sidebar({ mode, nodes, blocks, workspaceSlug }) {
  // mode: "all-pages" | "toc"
  // Three sections: placeholder + buttons + dynamic
}
```

### New Routes

**1. All Pages Route**
```typescript
// app/[workspaceSlug]/all-pages/page.tsx

export default async function AllPagesPage({ params }) {
  // Fetch all nodes
  // Display sidebar in "all-pages" mode
  // Main content: page count, stats
}
```

### Updated Routes

**1. Workspace Layout**
```typescript
// app/[workspaceSlug]/layout.tsx

- Add NavigationProvider wrapper
- Add Breadcrumbs component to header
- Add MobileSidebar for mobile
- Pass mode prop to Sidebar based on route
```

**2. Page Route**
```typescript
// app/[workspaceSlug]/[...path]/page.tsx

- Pass blocks to Sidebar for TOC mode
```

### Database Queries

**No new queries needed** - use existing:
- `getAllNodes(workspaceId)` for all-pages mode
- `getAllBlocksForPage(workspaceId, pageName)` for TOC mode

### State Management

**1. Navigation History**
- sessionStorage with custom hook
- Key: `draehi-nav-history-${workspaceSlug}`
- Update on pathname change

**2. Mobile Drawer State**
- Local state in layout component
- Close on navigation (useEffect on pathname)

**3. TOC Collapse State**
- Local state in TableOfContents
- Persist per-page in sessionStorage (optional)

---

## E) Implementation Order

1. **Phase 1: Core Components**
   - NavigationProvider with sessionStorage
   - Breadcrumbs revamp with n-2 logic
   - Test history tracking

2. **Phase 2: Sidebar Structure**
   - Three-section layout (placeholder + buttons + dynamic)
   - Mode switching logic
   - All-pages route creation

3. **Phase 3: Table of Contents**
   - Build TOC tree from blocks
   - Collapsible components (depth 1-2)
   - Level 3 expanded by default

4. **Phase 4: Mobile Responsive**
   - Hamburger menu + drawer
   - Backdrop overlay
   - Touch-friendly sizing

5. **Phase 5: Polish**
   - Animations
   - Active states
   - Loading states

---

## F) Edge Cases

**1. Direct Landing**
- n-2 = null → show `../current`
- Initialize history on mount

**2. Bookmark/Refresh**
- Clear stale sessionStorage
- Reinitialize from current URL

**3. Multiple Tabs**
- Each tab has independent sessionStorage
- No cross-tab sync needed

**4. Deep Nesting (>3 levels)**
- TOC cuts off at depth 3
- Show "..." indicator if more levels exist
- No expansion beyond level 3

**5. Empty TOC**
- Page with no blocks → show message
- "No table of contents for this page"

**6. /all-pages on Mobile**
- Same drawer behavior
- Show full page tree in drawer

---

## G) Testing Checklist

**Breadcrumbs:**
- [ ] Direct landing shows `../current`
- [ ] Navigation populates n-2 correctly
- [ ] Click ".." goes to correct page
- [ ] Browser back/forward updates history
- [ ] sessionStorage persists across refreshes

**Sidebar:**
- [ ] Placeholder visible and styled
- [ ] Navigation buttons active state works
- [ ] All-pages mode shows full tree
- [ ] TOC mode shows blocks (max depth 3)
- [ ] Level 3 not collapsed by default
- [ ] Empty TOC shows message

**Mobile:**
- [ ] Hamburger toggles drawer
- [ ] Drawer closes on navigation
- [ ] Backdrop closes drawer
- [ ] Touch targets ≥44px
- [ ] Works on 320px viewport

**Routes:**
- [ ] /all-pages route renders
- [ ] Regular pages show TOC
- [ ] Workspace root redirects to /contents

---

## H) Performance Considerations

**1. TOC Building**
- Build tree on server (getAllBlocksForPage)
- Pass to client component
- Memoize tree structure

**2. Sidebar Caching**
- Cache getAllNodes with "use cache"
- Revalidate on content sync

**3. sessionStorage**
- Minimal writes (only on navigation)
- No performance impact

**4. Mobile Drawer**
- CSS transforms (GPU accelerated)
- No JS animation (prefer CSS)

---

## I) Future Enhancements (Out of Scope)

- Search functionality (explicitly excluded)
- TOC scroll spy (highlight current section)
- Breadcrumbs history dropdown (show full path)
- TOC depth preference (user setting)
- Keyboard shortcuts (j/k navigation)

---

## Summary

**What Changes:**
- ✅ Breadcrumbs with n-2 history tracking
- ✅ Three-part sidebar (placeholder + buttons + dynamic)
- ✅ TOC mode vs all-pages mode
- ✅ Mobile drawer with hamburger
- ✅ New /all-pages route

**What Stays:**
- ✅ Current routing structure
- ✅ Database schema
- ✅ BlockTree component
- ✅ Page content rendering

**Key Files to Modify:**
- `components/viewer/Breadcrumbs.tsx` - Revamp
- `components/viewer/Sidebar.tsx` - Three sections + modes
- `app/[workspaceSlug]/layout.tsx` - Add breadcrumbs + mobile
- `lib/navigation-context.tsx` - NEW (history tracking)
- `components/viewer/TableOfContents.tsx` - NEW (TOC tree)
- `components/viewer/MobileSidebar.tsx` - NEW (drawer)
- `app/[workspaceSlug]/all-pages/page.tsx` - NEW (route)

**Estimated Complexity:** Medium (2-3 sessions)
**Breaking Changes:** None (additive only)
**Mobile Impact:** High (new drawer pattern)
