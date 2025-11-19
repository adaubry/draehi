"use client";

import { useState } from "react";
import Link from "next/link";
import type { Node } from "@/modules/content/schema";

// Extract just the body content from full HTML documents
function extractBodyContent(html: string): string {
  // If HTML doesn't contain a body tag, return as-is (already processed)
  if (!html.includes("<body")) {
    return html;
  }
  // Extract content between <body> and </body>
  const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return match ? match[1] : html;
}

type BlockTreeProps = {
  blocks: Node[];
  workspaceSlug: string;
  pagePath: string;
  depth?: number;
};

type BlockItemProps = {
  block: Node;
  allBlocks: Node[];
  workspaceSlug: string;
  pagePath: string;
  depth: number;
};

function BlockItem({
  block,
  allBlocks,
  workspaceSlug,
  pagePath,
  depth,
}: BlockItemProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Find children from ALL blocks (blocks have parentUuid !== null)
  const children = allBlocks
    .filter((b) => b.parentUuid !== null && b.parentUuid === block.uuid)
    .sort((a, b) => a.order - b.order);

  const hasChildren = children.length > 0;
  const blockUrl = `/${workspaceSlug}/${pagePath}#${block.uuid}`;

  return (
    <li
      className="logseq-block"
      data-depth={depth}
      id={block.uuid}
      style={{ marginLeft: `${depth * 1.5}rem` }}
    >
      <div className="block-line group">
        {/* Bullet Point - Clickable */}
        <Link
          href={blockUrl}
          className="block-bullet"
          onClick={(e) => {
            // Ctrl/Cmd + Click: Navigate to block (allow default behavior)
            if (e.ctrlKey || e.metaKey) {
              return;
            }

            // Normal click with children: toggle collapse
            if (hasChildren) {
              e.preventDefault();
              setIsCollapsed(!isCollapsed);
            }
            // Normal click without children: navigate (allow default)
          }}
        >
          <span
            className={`bullet ${isCollapsed ? "collapsed" : ""} ${
              hasChildren ? "has-children" : ""
            }`}
          >
            {hasChildren ? (isCollapsed ? "▸" : "▾") : "•"}
          </span>
        </Link>

        {/* Block Content */}
        <div
          className="block-content"
          dangerouslySetInnerHTML={{
            __html: extractBodyContent(block.html || "")
          }}
        />
      </div>

      {/* Nested Children */}
      {hasChildren && !isCollapsed && (
        <ul className="block-children">
          {children.map((childBlock) => (
            <BlockItem
              key={childBlock.uuid}
              block={childBlock}
              allBlocks={allBlocks}
              workspaceSlug={workspaceSlug}
              pagePath={pagePath}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function BlockTree({
  blocks,
  workspaceSlug,
  pagePath,
  depth = 0,
}: BlockTreeProps) {
  // Find the page node (parentUuid is null)
  const pageNode = blocks.find((b) => b.parentUuid === null);

  // Find top-level blocks (children of the page)
  const topLevelBlocks = blocks
    .filter(
      (b) =>
        b.parentUuid !== null &&
        pageNode &&
        b.parentUuid === pageNode.uuid
    )
    .sort((a, b) => a.order - b.order);

  return (
    <ul className="logseq-blocks">
      {topLevelBlocks.map((block) => (
        <BlockItem
          key={block.uuid}
          block={block}
          allBlocks={blocks}
          workspaceSlug={workspaceSlug}
          pagePath={pagePath}
          depth={depth}
        />
      ))}
    </ul>
  );
}
