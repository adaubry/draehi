"use client";

import { useState } from "react";
import Link from "next/link";
import type { Node } from "@/modules/content/schema";

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

  // Find children from ALL blocks
  const children = allBlocks
    .filter((b) => b.nodeType === "block" && b.parentId === block.id)
    .sort((a, b) => a.order - b.order);

  const hasChildren = children.length > 0;
  const blockId = block.blockUuid || `block-${block.id}`;
  const blockUrl = `/${workspaceSlug}/${pagePath}#${blockId}`;

  return (
    <li
      className="logseq-block"
      data-depth={depth}
      id={blockId}
      style={{ marginLeft: `${depth * 1.5}rem` }}
    >
      <div className="block-line group">
        {/* Bullet Point - Clickable */}
        <Link
          href={blockUrl}
          className="block-bullet"
          onClick={(e) => {
            // If has children, toggle collapse instead of navigating
            if (hasChildren) {
              e.preventDefault();
              setIsCollapsed(!isCollapsed);
            }
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
          dangerouslySetInnerHTML={{ __html: block.html || "" }}
        />
      </div>

      {/* Nested Children */}
      {hasChildren && !isCollapsed && (
        <ul className="block-children">
          {children.map((childBlock) => (
            <BlockItem
              key={childBlock.id}
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
  // Find the page node
  const pageNode = blocks.find((b) => b.nodeType === "page");

  // Find top-level blocks (children of the page)
  const topLevelBlocks = blocks
    .filter(
      (b) =>
        b.nodeType === "block" &&
        pageNode &&
        b.parentId === pageNode.id
    )
    .sort((a, b) => a.order - b.order);

  return (
    <ul className="logseq-blocks">
      {topLevelBlocks.map((block) => (
        <BlockItem
          key={block.id}
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
