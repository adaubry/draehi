# Sidebar Component Documentation

**Status:** Implemented
**Updated:** 2025-01-19
**Component:** `components/viewer/Sidebar.tsx`

## Overview

The Sidebar is a three-section navigation component with dynamic behavior based on current route. It provides workspace navigation, table of contents, and quick access to main views.

## Architecture

### Three-Section Layout

```
┌─────────────────────────────┐
│  1. Placeholder (48px)      │  Future integrations
├─────────────────────────────┤
│  2. Navigation Buttons      │  Quick links (sticky)
│     • Dashboard             │
│     • Home                  │
│     • All Pages             │
├─────────────────────────────┤
│  3. Dynamic Content         │  TOC or Page Tree
│     (scrollable)            │
│                             │
│                             │
└─────────────────────────────┘
```

### Two Modes

**Mode 1: Table of Contents (Default)**
- Shown on all regular page routes
- Displays headings (h2, h3, h4) from current page
- Async fetched via `/api/toc`
- Collapsible tree (max 3 levels)

**Mode 2: All Pages**
- Shown on `/all-pages` route
- Hierarchical page tree
- Based on `pageName` structure
- Full workspace navigation

---

## Component Structure

### File: `components/viewer/Sidebar.tsx`

```typescript
export function Sidebar({
  nodes: Node[],        // All nodes in workspace
  workspaceSlug: string // Workspace identifier
})
```

**Key Features:**
- Client component ("use client")
- Auto-detects mode from pathname
- No server dependencies (layout-compatible)
- Mobile responsive (hidden on mobile, drawer instead)

### Dependencies

- `TableOfContents.tsx` - Async TOC component
- `usePathname()` - Route detection
- `buildTree()` - Page hierarchy builder

---

## Section 1: Placeholder

**Purpose:** Reserved for future integrations (search, filters, etc.)

**Specs:**
```tsx
<div className="h-12 bg-gray-50 border-b border-gray-200 shrink-0" />
```

- Fixed height: 48px (h-12)
- Background: light gray
- Border bottom: 1px gray-200
- No interactivity (placeholder only)

---

## Section 2: Navigation Buttons

**Purpose:** Quick access to main workspace views

**Buttons:**
1. **Dashboard** - `/dashboard` (global)
2. **Home** - `/{workspaceSlug}` (workspace root)
3. **All Pages** - `/{workspaceSlug}/all-pages` (active state)

**Implementation:**
```tsx
<div className="sticky top-0 z-10 flex flex-col gap-1 p-3 bg-white border-b border-gray-200 shrink-0">
  <Link href="/dashboard" className="...">
    Dashboard
  </Link>
  <Link href={`/${workspaceSlug}`} className="...">
    Home
  </Link>
  <Link href={`/${workspaceSlug}/all-pages`} className="...">
    All Pages
  </Link>
</div>
```

**Styling:**
- Sticky positioning (top: 0)
- White background
- Border bottom
- Active state: `bg-gray-100 text-gray-900`
- Hover: `hover:bg-gray-50`

---

## Section 3: Dynamic Content

### Mode Detection

```typescript
const isOnAllPagesRoute =
  pathname === `/${workspaceSlug}/all-pages` ||
  pathname === `/${workspaceSlug}/all-pages/`;

const mode: SidebarMode = isOnAllPagesRoute ? "all-pages" : "toc";
```

### Mode 1: All Pages (Page Tree)

**When:** User is on `/all-pages` route

**Display:**
- Full hierarchical page tree
- Based on `pageName` structure
- Nested by namespace (e.g., `docs/getting-started`)
- Indented by depth
- Active page highlighted

**Tree Building:**
```typescript
function buildTree(nodes: Node[]): TreeNode[] {
  // Groups pages by pageName hierarchy
  // Parent-child based on path segments
  // e.g., "docs/api" is child of "docs"
}
```

**Rendering:**
```tsx
<nav className="space-y-6 p-3">
  <div>
    <h3 className="...">Pages</h3>
    <div className="space-y-0.5">
      {tree.map(treeNode => (
        <TreeItem
          treeNode={treeNode}
          workspaceSlug={workspaceSlug}
        />
      ))}
    </div>
  </div>
</nav>
```

### Mode 2: Table of Contents (TOC)

**When:** User is on any regular page route

**Display:**
- "On This Page" heading
- Headings from current page (h2, h3, h4)
- Collapsible tree (2 levels)
- Skeleton loading state
- Empty state if no headings

**Data Fetching:**
- Async client-side fetch to `/api/toc`
- URL params: `?workspace={slug}&path={pagePath}`
- Returns: `{ blocks: Node[] }`

**Component:**
```tsx
<TableOfContents workspaceSlug={workspaceSlug} />
```

See [TableOfContents](#table-of-contents-component) section below.

---

## Table of Contents Component

**File:** `components/viewer/TableOfContents.tsx`

### How It Works

**1. Pathname Detection**
```typescript
useEffect(() => {
  const segments = pathname.split("/").filter(Boolean);
  const pagePath = segments.slice(1).join("/");
  // Fetch blocks for this page
}, [pathname, workspaceSlug]);
```

**2. Async Data Fetch**
```typescript
fetch(`/api/toc?workspace=${workspaceSlug}&path=${pagePath}`)
  .then(res => res.json())
  .then(data => {
    // Extract headings from HTML
    // Build TOC tree
    // Update state
  })
```

**3. HTML Parsing**
```typescript
function extractHeadingsFromHTML(html: string): HeadingItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const elements = doc.querySelectorAll("h2, h3, h4");

  elements.forEach(el => {
    const uuid = el.getAttribute("uuid");  // From ingestion
    const text = el.textContent;
    const level = parseInt(el.tagName[1]); // 2, 3, or 4

    headings.push({ uuid, title: text, level });
  });
}
```

**4. Tree Building**
```typescript
function buildTOCTree(headings: HeadingItem[]): TOCItem[] {
  // h2 = root level
  // h3 = nested under h2
  // h4 = nested under h3
  // Max 2 levels of nesting
}
```

**5. Rendering**
```tsx
<TOCItemComponent item={item} />
// Recursive component
// Collapsible with arrow icon
// Click → smooth scroll to heading
```

### States

**Loading:**
```tsx
<div className="space-y-2">
  {[1, 2, 3].map(i => (
    <div className="h-6 bg-gray-200 animate-pulse rounded" />
  ))}
</div>
```

**Error:**
```tsx
<div className="text-red-600">
  Error loading TOC: {error}
</div>
```

**Empty:**
```tsx
<div className="text-gray-500 italic">
  No table of contents
</div>
```

**Success:**
- Collapsible heading tree
- Smooth scroll on click
- Active state (optional)

### Collapsible Behavior

- **h2 (level 2):** Collapsed by default, can expand
- **h3 (level 3):** Collapsed by default, can expand
- **h4 (level 4):** Always visible under parent
- Arrow icon rotates on expand/collapse

### Scroll to Heading

```typescript
const handleClick = (e: React.MouseEvent) => {
  e.preventDefault();
  const element = document.querySelector(`[uuid="${item.uuid}"]`);
  if (element) {
    element.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
};
```

**Note:** Requires headings to have `uuid` attribute (added during ingestion)

---

## API Route

**File:** `app/api/toc/route.ts`

### Endpoint

```
GET /api/toc?workspace={slug}&path={pagePath}
```

**Query Params:**
- `workspace` - Workspace slug (required)
- `path` - Page path segments joined with `/` (required)

**Response:**
```json
{
  "blocks": [
    {
      "uuid": "...",
      "html": "<h2 uuid='...'>Heading</h2><p>Content</p>",
      "pageName": "...",
      ...
    }
  ]
}
```

### Implementation

```typescript
export async function GET(request: NextRequest) {
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  const node = await getNodeByPath(workspace.id, pathSegments);
  const blocks = await getAllBlocksForPage(workspace.id, node.pageName);

  return NextResponse.json({ blocks });
}
```

**Queries Used:**
- `getWorkspaceBySlug(slug)` - Find workspace
- `getNodeByPath(workspaceId, path)` - Find current page
- `getAllBlocksForPage(workspaceId, pageName)` - Get all blocks

---

## Sticky Behavior

**Layout Wrapper:**
```tsx
<aside className="hidden lg:block w-64 shrink-0">
  <div className="sticky top-20 h-[calc(100vh-5rem)] overflow-y-auto">
    <Sidebar nodes={nodes} workspaceSlug={workspaceSlug} />
  </div>
</aside>
```

**Key CSS:**
- `sticky top-20` - Sticks 5rem below viewport top (header height)
- `h-[calc(100vh-5rem)]` - Full height minus header
- `overflow-y-auto` - Scrollable if content overflows
- `hidden lg:block` - Hidden on mobile, visible desktop

**Scrolling:**
- Placeholder: Fixed at top
- Nav buttons: Sticky within sidebar
- Dynamic content: Scrollable

---

## Mobile Responsive

**Desktop (≥1024px):**
- Sidebar visible (left side, 256px width)
- Sticky positioning
- Scrollable content

**Mobile (<1024px):**
- Sidebar hidden (`hidden lg:block`)
- Replaced with drawer (see `MobileSidebar.tsx`)
- Hamburger trigger in header

**Breakpoint:** Tailwind `lg` = 1024px

---

## Performance

### Optimizations

1. **Server Data in Layout**
   - `getAllNodes()` fetched once in layout
   - Passed as prop to Sidebar
   - Cached by Next.js

2. **Client-Side TOC Fetch**
   - Only fetches blocks for current page
   - Cached by browser
   - Updates on pathname change

3. **Tree Memoization**
   - `buildTree()` runs client-side
   - Could be memoized with `useMemo()`
   - Low impact (runs once per navigation)

4. **Conditional Rendering**
   - Only renders active mode
   - No unused components in DOM

### Debug Logging

**Console Output:**
```
=== TOC Async Fetch ===
Blocks fetched: 15
Total HTML length: 12500
Headings extracted: 8
```

**Remove in production** (lines 177-190 in TableOfContents.tsx)

---

## Edge Cases

### Empty Workspace
- No nodes → empty page tree
- Shows "No pages yet" message

### Page Without Blocks
- TOC fetch returns empty array
- Shows "No table of contents"

### Page Without Headings
- Blocks exist but no h2/h3/h4
- Shows "No table of contents"

### Deep Page Nesting
- Page tree supports unlimited depth
- Each level indented by 12px
- No max depth limit

### Special Characters in pageName
- Slugified for URLs
- Original name in tree display
- Matches handled by `getNodeByPath()`

### Direct URL Access
- TOC fetches on mount
- Works with bookmarks
- No dependency on navigation history

---

## Future Enhancements

**Planned:**
- [ ] TOC active heading highlight (scroll spy)
- [ ] Search in page tree
- [ ] Keyboard navigation (j/k)
- [ ] Collapse all / Expand all
- [ ] TOC depth preference (user setting)

**Out of Scope:**
- Global search (deliberately excluded)
- TOC for blocks (only page headings)

---

## Troubleshooting

### TOC Not Rendering

**Check:**
1. Console logs - "TOC Async Fetch" output
2. Network tab - `/api/toc` request status
3. Blocks have HTML content
4. Headings have `uuid` attribute
5. Pathname matches page path

**Common Issues:**
- Blocks: 0 → Page has no content
- Headings: 0 → No h2/h3/h4 tags in HTML
- uuid missing → Re-sync needed (ingestion adds uuid)

### All-Pages Mode Not Working

**Check:**
1. Pathname ends with `/all-pages`
2. `isOnAllPagesRoute` detects correctly
3. Page tree has nodes
4. Tree building succeeds

### Sidebar Not Sticky

**Check:**
1. Layout has `sticky top-20`
2. Parent has height constraint
3. `overflow-y-auto` allows scrolling
4. No CSS conflicts

---

## Related Files

**Components:**
- `components/viewer/Sidebar.tsx` - Main component
- `components/viewer/TableOfContents.tsx` - TOC component
- `components/viewer/MobileSidebar.tsx` - Mobile drawer
- `components/viewer/MobileMenuTrigger.tsx` - Hamburger button

**Routes:**
- `app/[workspaceSlug]/layout.tsx` - Sidebar placement
- `app/[workspaceSlug]/all-pages/page.tsx` - All pages view
- `app/api/toc/route.ts` - TOC API endpoint

**Queries:**
- `modules/content/queries.ts` - `getAllBlocksForPage()`
- `modules/workspace/queries.ts` - `getWorkspaceBySlug()`

**Documentation:**
- `docs/NAVIGATION_GUIDELINES.md` - Full navigation spec
- `docs/SIDEBAR.md` - This file

---

## Testing Checklist

- [ ] TOC renders on page load
- [ ] TOC updates on navigation
- [ ] Headings click → smooth scroll
- [ ] Collapsible arrows work
- [ ] All-pages mode shows tree
- [ ] Nav buttons highlight active
- [ ] Sticky scrolling works
- [ ] Mobile hides sidebar
- [ ] Loading skeleton shows
- [ ] Empty state displays
- [ ] Error state handles failures

---

## Code Examples

### Adding a New Button

```tsx
// In Section 2: Navigation Buttons
<Link
  href={`/${workspaceSlug}/search`}
  className="block px-3 py-1.5 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors text-center"
>
  Search
</Link>
```

### Changing TOC Depth

```tsx
// In extractHeadingsFromHTML()
const elements = doc.querySelectorAll("h2, h3"); // Only h2 and h3
```

### Customizing Tree Indentation

```tsx
// In TreeItem component
style={{ paddingLeft: `${depth * 20 + 12}px` }} // 20px per level
```

---

## Summary

**Sidebar = 3 Sections + 2 Modes**

**Sections:**
1. Placeholder (48px, future use)
2. Navigation (sticky buttons)
3. Dynamic (TOC or tree)

**Modes:**
1. TOC - Current page headings (default)
2. All Pages - Workspace tree (on /all-pages)

**Key Tech:**
- Async client-side TOC fetch
- DOMParser for heading extraction
- Sticky positioning with overflow scroll
- Mode detection via pathname
- No server context dependencies

**Working Features:**
- ✅ Three-section layout
- ✅ Async TOC with skeleton
- ✅ All-pages tree view
- ✅ Sticky behavior
- ✅ Mobile responsive
- ✅ Active states
- ✅ Empty/error states
