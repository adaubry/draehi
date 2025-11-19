"use client";

import { useState } from "react";
import type { Node } from "@/modules/content/schema";

type TocHeading = {
  uuid: string;
  text: string;
  level: number; // 1, 2, or 3
  children: TocHeading[];
};

type TableOfContentsProps = {
  blocks: Node[];
  maxDepth?: number;
};

function extractHeadings(blocks: Node[], maxDepth: number = 3): TocHeading[] {
  const headings: TocHeading[] = [];
  const stack: TocHeading[] = [];

  for (const block of blocks) {
    if (!block.html) continue;

    // Extract h1, h2, h3 from HTML with data-uuid
    const headingMatches = block.html.matchAll(
      /<h([1-3])[^>]*data-uuid="([^"]+)"[^>]*>(.*?)<\/h\1>/g
    );

    for (const match of headingMatches) {
      const level = parseInt(match[1]);
      const uuid = match[2];
      const text = match[3].replace(/<[^>]+>/g, "").trim(); // Strip HTML tags

      if (level > maxDepth) continue;

      const heading: TocHeading = {
        uuid,
        text,
        level,
        children: [],
      };

      // Build hierarchy
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      if (stack.length === 0) {
        // Root level heading
        headings.push(heading);
      } else {
        // Nested heading
        stack[stack.length - 1].children.push(heading);
      }

      // Don't add level 3 to stack (no children allowed)
      if (level < 3) {
        stack.push(heading);
      }
    }
  }

  return headings;
}

function TocItem({
  heading,
  depth,
}: {
  heading: TocHeading;
  depth: number;
}) {
  const [isCollapsed, setIsCollapsed] = useState(depth < 3);
  const hasChildren = heading.children.length > 0;

  // Level 3 has no collapse (always expanded)
  const canCollapse = depth < 3 && hasChildren;

  return (
    <div>
      <a
        href={`#${heading.uuid}`}
        className={`block py-1.5 text-sm transition-colors hover:text-gray-900 ${
          depth === 1
            ? "font-medium text-gray-900"
            : depth === 2
            ? "text-gray-700 pl-3"
            : "text-gray-600 pl-6"
        }`}
        onClick={(e) => {
          e.preventDefault();
          const el = document.querySelector(`[data-uuid="${heading.uuid}"]`);
          el?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      >
        <span className="flex items-center gap-1.5">
          {canCollapse && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsCollapsed(!isCollapsed);
              }}
              className="hover:text-gray-900"
              aria-label={isCollapsed ? "Expand" : "Collapse"}
            >
              {isCollapsed ? "▸" : "▾"}
            </button>
          )}
          <span>{heading.text}</span>
        </span>
      </a>

      {/* Children - only render if not collapsed and has children */}
      {hasChildren && !isCollapsed && (
        <div className="mt-0.5">
          {heading.children.map((child) => (
            <TocItem key={child.uuid} heading={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function TableOfContents({
  blocks,
  maxDepth = 3,
}: TableOfContentsProps) {
  const headings = extractHeadings(blocks, maxDepth);

  if (headings.length === 0) {
    return (
      <div className="px-3 py-4 text-sm text-gray-500 italic">
        No table of contents
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        On This Page
      </h3>
      <nav className="space-y-1" data-toc="true">
        {headings.map((heading) => (
          <TocItem key={heading.uuid} heading={heading} depth={1} />
        ))}
      </nav>
    </div>
  );
}
