// TODO: Consider migrating to shadcn/ui components (Collapsible, etc.)
"use client";

import { useState } from "react";
import Link from "next/link";
import type { Node } from "@/modules/content/schema";
import type { TreeNode } from "@/modules/content/queries";
import { NodeContent } from "./NodeContent";

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
  tree: TreeNode;
  workspaceSlug: string;
  pagePath: string;
  depth?: number;
};

type BlockNodeProps = {
  treeNode: TreeNode;
  workspaceSlug: string;
  pagePath: string;
  depth: number;
};

function BlockNode({
  treeNode,
  workspaceSlug,
  pagePath,
  depth,
}: BlockNodeProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { node, children } = treeNode;

  const hasChildren = children.length > 0;
  const blockUrl = `/${workspaceSlug}/${pagePath}#${node.uuid}`;

  return (
    <li
      className="logseq-block"
      data-depth={depth}
      id={node.uuid}
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
        <NodeContent html={extractBodyContent(node.html || "")} />
      </div>

      {/* Nested Children */}
      {hasChildren && !isCollapsed && (
        <ul className="block-children">
          {children.map((childTree) => (
            <BlockNode
              key={childTree.node.uuid}
              treeNode={childTree}
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
  tree,
  workspaceSlug,
  pagePath,
  depth = 0,
}: BlockTreeProps) {
  const { children: topLevelBlocks } = tree;
  console.log("[Display] BlockTree: Rendering tree for page path", pagePath, "with", topLevelBlocks.length, "top-level blocks");

  return (
    <ul className="logseq-blocks">
      {topLevelBlocks.map((childTree) => (
        <BlockNode
          key={childTree.node.uuid}
          treeNode={childTree}
          workspaceSlug={workspaceSlug}
          pagePath={pagePath}
          depth={depth}
        />
      ))}
    </ul>
  );
}
