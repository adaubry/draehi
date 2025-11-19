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
  console.log("Extracting headings from HTML...");
  try {
    const doc = parser.parseFromString(html, "text/html");
    const elements = doc.querySelectorAll("h2, h3, h4");

    elements.forEach((el) => {
      const uuid = el.getAttribute("uuid");
      const text = el.textContent || "";
      const level = parseInt(el.tagName[1]);

      if (uuid && text) {
        headings.push({ uuid, title: text, level });
        console.log("Found heading:", { uuid, title: text, level });
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
    const element = document.querySelector(`[uuid="${item.uuid}"]`);
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
        <div
          className="space-y-1 mt-1"
          style={{ marginLeft: `${indent + 8}px` }}
        >
          {item.children.map((child) => (
            <TOCItemComponent key={child.uuid} item={child} />
          ))}
        </div>
      )}
    </div>
  );
}

export function TableOfContents({ blocks, pageUuid, pageTitle }: TOCProps) {
  // Concatenate HTML from all blocks
  const allHTML = blocks
    .filter((b) => b.uuid && b.html)
    .map((b) => b.html)
    .join("");

  if (!allHTML) return null;

  // Extract headings from HTML
  const headings = extractHeadingsFromHTML(allHTML);

  if (headings.length === 0) return null;

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
