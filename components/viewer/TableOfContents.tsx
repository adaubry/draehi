"use client";

import { useState } from "react";
import type { Node } from "@/modules/content/schema";

type TOCProps = {
  blocks: Node[];
  pageUuid: string;
  pageTitle: string;
  workspaceSlug: string;
};

type HeadingItem = {
  uuid: string;
  title: string;
  level: number; // 1 = h1, 2 = h2, etc
};

type TOCItem = {
  uuid: string;
  title: string;
  level: number;
  children: TOCItem[];
};

/**
 * Extract headings from HTML content
 * Looks for h2, h3, h4 tags with uuid attributes
 */
function extractHeadingsFromHTML(html: string): HeadingItem[] {
  const headings: HeadingItem[] = [];
  const parser = new DOMParser();

  try {
    const doc = parser.parseFromString(html, "text/html");
    const elements = doc.querySelectorAll("h2, h3, h4");

    elements.forEach((el) => {
      const uuid = el.getAttribute("uuid"); // Changed from data-uuid to uuid
      const text = el.textContent || "";
      const level = parseInt(el.tagName[1]);

      if (uuid && text) {
        headings.push({ uuid, title: text, level });
      }
    });
  } catch (e) {
    console.error("Error parsing HTML for TOC:", e);
  }

  return headings;
}

/**
 * Build nested TOC structure from flat heading list
 * h2 = level 1, h3 = level 2, h4 = level 3
 */
function buildTOCTree(headings: HeadingItem[]): TOCItem[] {
  if (headings.length === 0) return [];

  const stack: TOCItem[] = [];
  const root: TOCItem[] = [];

  headings.forEach((heading) => {
    const item: TOCItem = {
      uuid: heading.uuid,
      title: heading.title,
      level: heading.level,
      children: [],
    };

    // h2 = level 2 = tree level 0
    const treeLevel = heading.level - 2;

    // Remove items from stack that are at same or higher level
    while (stack.length > treeLevel) {
      stack.pop();
    }

    if (stack.length === 0) {
      // Top level (h2)
      root.push(item);
    } else {
      // Nested under last item in stack
      stack[stack.length - 1].children.push(item);
    }

    stack.push(item);
  });

  return root;
}

function TOCItemComponent({ item }: { item: TOCItem }) {
  const [isOpen, setIsOpen] = useState(item.level === 2); // h2 expanded by default

  const hasChildren = item.children.length > 0;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const element = document.querySelector(`[uuid="${item.uuid}"]`); // Changed from data-uuid to uuid
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Calculate indentation based on level (h2=0, h3=1, h4=2)
  const indentLevel = item.level - 2;
  const indent = indentLevel * 16;

  return (
    <div>
      <div className="flex items-center space-x-1">
        {hasChildren && (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center justify-center w-4 h-4 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
            aria-label={isOpen ? "Collapse" : "Expand"}
          >
            <svg
              className={`w-3 h-3 transition-transform ${
                isOpen ? "rotate-90" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        )}
        {!hasChildren && <div className="w-4 shrink-0" />}

        <button
          onClick={handleClick}
          className="text-left text-sm text-gray-700 hover:text-blue-600 transition-colors truncate flex-1"
        >
          {item.title}
        </button>
      </div>

      {hasChildren && isOpen && (
        <div className="space-y-1 mt-1" style={{ marginLeft: `${indent + 8}px` }}>
          {item.children.map((child) => (
            <TOCItemComponent key={child.uuid} item={child} />
          ))}
        </div>
      )}
    </div>
  );
}

export function TableOfContents({
  blocks,
  pageUuid,
  pageTitle,
}: TOCProps) {
  // Concatenate HTML from all blocks
  const allHTML = blocks
    .filter((b) => b.uuid && b.html)
    .map((b) => b.html)
    .join("");

  // DEBUG: Log what we're receiving
  console.log("=== TOC Debug ===");
  console.log("Blocks received:", blocks.length);
  console.log("Blocks with HTML:", blocks.filter((b) => b.html).length);
  console.log("Total HTML length:", allHTML.length);

  // Sample first block's HTML
  if (blocks.length > 0 && blocks[0].html) {
    console.log(
      "Sample HTML (first 500 chars):",
      blocks[0].html.substring(0, 500)
    );
  }

  if (!allHTML) {
    return (
      <div className="px-3 py-4 text-sm text-gray-500 italic">
        <div className="mb-2">No table of contents</div>
        {/* DEBUG INFO */}
        <div className="text-xs bg-gray-100 p-2 rounded mt-2">
          <div>Debug Info:</div>
          <div>• Blocks: {blocks.length}</div>
          <div>• With HTML: {blocks.filter((b) => b.html).length}</div>
          <div>• Total HTML: {allHTML.length} chars</div>
        </div>
      </div>
    );
  }

  // Extract headings from HTML
  const headings = extractHeadingsFromHTML(allHTML);

  console.log("Headings extracted:", headings.length);
  if (headings.length > 0) {
    console.log("First heading:", headings[0]);
  }

  if (headings.length === 0) {
    return (
      <div className="px-3 py-4 text-sm text-gray-500 italic">
        <div className="mb-2">No table of contents</div>
        {/* DEBUG INFO */}
        <div className="text-xs bg-gray-100 p-2 rounded mt-2">
          <div>Debug Info:</div>
          <div>• Blocks: {blocks.length}</div>
          <div>• With HTML: {blocks.filter((b) => b.html).length}</div>
          <div>• Total HTML: {allHTML.length} chars</div>
          <div>• Headings: {headings.length}</div>
        </div>
      </div>
    );
  }

  // Build nested TOC tree from flat heading list
  const tocItems = buildTOCTree(headings);

  return (
    <nav className="space-y-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        On This Page
      </h3>
      <div className="space-y-1 text-sm">
        {tocItems.map((item) => (
          <TOCItemComponent key={item.uuid} item={item} />
        ))}
      </div>
    </nav>
  );
}
