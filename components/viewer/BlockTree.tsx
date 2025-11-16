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
  children: Node[];
  workspaceSlug: string;
  pagePath: string;
  depth: number;
};

function BlockItem({
  block,
  children,
  workspaceSlug,
  pagePath,
  depth,
}: BlockItemProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
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
          {children.map((childBlock) => {
            // Find grandchildren
            const grandchildren = getChildBlocks(childBlock, [
              block,
              ...children,
            ]);

            return (
              <BlockItem
                key={childBlock.id}
                block={childBlock}
                children={grandchildren}
                workspaceSlug={workspaceSlug}
                pagePath={pagePath}
                depth={depth + 1}
              />
            );
          })}
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
  // Build tree structure: find top-level blocks (parentId = null or points to page)
  const topLevelBlocks = blocks.filter(
    (b) => b.nodeType === "block" && (!b.parentId || b.parentId === blocks[0]?.id)
  );

  return (
    <ul className="logseq-blocks">
      {topLevelBlocks.map((block) => {
        const children = getChildBlocks(block, blocks);

        return (
          <BlockItem
            key={block.id}
            block={block}
            children={children}
            workspaceSlug={workspaceSlug}
            pagePath={pagePath}
            depth={depth}
          />
        );
      })}
    </ul>
  );
}

/**
 * Get direct children of a block
 */
function getChildBlocks(parentBlock: Node, allBlocks: Node[]): Node[] {
  return allBlocks
    .filter(
      (b) =>
        b.nodeType === "block" &&
        (b.parentId === parentBlock.id ||
          b.blockUuid === parentBlock.blockUuid)
    )
    .sort((a, b) => a.order - b.order);
}
