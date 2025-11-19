"use client";

import { useState } from "react";
import Link from "next/link";
import type { Node } from "@/modules/content/schema";

type TOCProps = {
  blocks: Node[];
  pageUuid: string;
  workspaceSlug: string;
};

type TOCItem = {
  uuid: string;
  title: string;
  depth: number;
  children: TOCItem[];
  parentUuid: string | null;
};

/**
 * Build table of contents tree with max 3 levels
 * Levels 1-2 collapsed, level 3 expanded
 */
function buildTOCTree(blocks: Node[], pageUuid: string): TOCItem[] {
  const itemMap = new Map<string, TOCItem>();
  const rootItems: TOCItem[] = [];

  // Create items for all blocks (max 3 levels)
  blocks.forEach((block) => {
    if (!block.uuid) return;

    // Calculate depth from parent chain
    let depth = 1;
    let currentBlock = block;

    // Find depth by walking up parent chain
    while (currentBlock.parentUuid && currentBlock.parentUuid !== pageUuid) {
      const parent = blocks.find((b) => b.uuid === currentBlock.parentUuid);
      if (!parent) break;
      depth++;
      currentBlock = parent;
    }

    // Only include blocks up to 3 levels deep
    if (depth > 3) return;

    itemMap.set(block.uuid, {
      uuid: block.uuid,
      title: block.title,
      depth,
      children: [],
      parentUuid: block.parentUuid,
    });
  });

  // Build hierarchy
  blocks.forEach((block) => {
    if (!block.uuid) return;
    const item = itemMap.get(block.uuid);
    if (!item) return;

    // Find parent
    if (item.parentUuid === pageUuid || !item.parentUuid) {
      // Top-level block
      rootItems.push(item);
    } else {
      const parent = itemMap.get(item.parentUuid);
      if (parent) {
        parent.children.push(item);
      } else {
        // Parent not in map, add to root
        rootItems.push(item);
      }
    }
  });

  // Sort by original order
  const sortByUuid = (items: TOCItem[]): TOCItem[] => {
    return items.sort((a, b) => {
      const blockA = blocks.find((x) => x.uuid === a.uuid);
      const blockB = blocks.find((x) => x.uuid === b.uuid);
      if (!blockA || !blockB) return 0;
      return (blockA.order ?? 0) - (blockB.order ?? 0);
    });
  };

  rootItems.forEach((item) => {
    item.children = sortByUuid(item.children);
    item.children.forEach((child) => {
      child.children = sortByUuid(child.children);
    });
  });

  return sortByUuid(rootItems);
}

function TOCItem({
  item,
  workspaceSlug,
  pageUuid,
}: {
  item: TOCItem;
  workspaceSlug: string;
  pageUuid: string;
}) {
  // Levels 1-2 collapsed by default, level 3 expanded
  const [isOpen, setIsOpen] = useState(item.depth >= 3);

  const hasChildren = item.children.length > 0;
  const canExpand = item.depth < 3; // Only allow expansion if not at level 3

  return (
    <div className="space-y-1">
      <div className="flex items-center space-x-1">
        {hasChildren && canExpand && (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center justify-center w-4 h-4 text-gray-400 hover:text-gray-600 transition-colors"
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
        {!hasChildren && <div className="w-4" />}

        <a
          href={`#block-${item.uuid}`}
          className="text-sm text-gray-700 hover:text-blue-600 transition-colors truncate"
        >
          {item.title}
        </a>
      </div>

      {hasChildren && isOpen && (
        <div
          className="ml-4 space-y-1"
          style={{
            opacity: isOpen ? 1 : 0,
            transition: "opacity 150ms ease-in-out",
          }}
        >
          {item.children.map((child) => (
            <TOCItem
              key={child.uuid}
              item={child}
              workspaceSlug={workspaceSlug}
              pageUuid={pageUuid}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TableOfContents({
  blocks,
  pageUuid,
  workspaceSlug,
}: TOCProps) {
  if (blocks.length === 0) return null;

  const tocItems = buildTOCTree(blocks, pageUuid);

  if (tocItems.length === 0) return null;

  return (
    <nav className="space-y-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        On This Page
      </h3>
      <div className="space-y-1 text-sm">
        {tocItems.map((item) => (
          <TOCItem
            key={item.uuid}
            item={item}
            workspaceSlug={workspaceSlug}
            pageUuid={pageUuid}
          />
        ))}
      </div>
    </nav>
  );
}
