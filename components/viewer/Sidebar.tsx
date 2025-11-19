"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Node } from "@/modules/content/schema";
import { TableOfContents } from "./TableOfContents";

type SidebarProps = {
  nodes: Node[];
  workspaceSlug: string;
  currentPageBlocks?: Node[];
  currentPageUuid?: string;
};

type SidebarMode = "all-pages" | "toc";

type TreeNode = {
  node: Node;
  children: TreeNode[];
};

function buildTree(nodes: Node[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  const rootNodes: TreeNode[] = [];

  nodes.forEach((node) => {
    nodeMap.set(node.pageName, { node, children: [] });
  });

  nodes.forEach((node) => {
    const treeNode = nodeMap.get(node.pageName);
    if (!treeNode) return;

    const segments = node.pageName.split("/");
    if (segments.length === 1) {
      rootNodes.push(treeNode);
    } else {
      const parentPageName = segments.slice(0, -1).join("/");
      const parent = nodeMap.get(parentPageName);
      if (parent) {
        parent.children.push(treeNode);
      } else {
        rootNodes.push(treeNode);
      }
    }
  });

  return rootNodes;
}

function TreeItem({
  treeNode,
  workspaceSlug,
  depth = 0,
}: {
  treeNode: TreeNode;
  workspaceSlug: string;
  depth?: number;
}) {
  const pathname = usePathname();
  const { node, children } = treeNode;

  const segments = node.pageName.split("/").map(s =>
    s.toLowerCase().replace(/\s+/g, "-").replace(/[^\w\-]/g, "")
  );
  const href = `/${workspaceSlug}/${segments.join("/")}`;
  const isActive = pathname === href;

  return (
    <div>
      <Link
        href={href}
        className={`block px-3 py-1.5 rounded-md text-sm transition-colors ${
          isActive
            ? "bg-gray-100 text-gray-900 font-medium"
            : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
        }`}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
      >
        {node.title}
      </Link>
      {children.length > 0 && (
        <div className="mt-1">
          {children.map((child) => (
            <TreeItem
              key={child.node.uuid}
              treeNode={child}
              workspaceSlug={workspaceSlug}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  nodes,
  workspaceSlug,
  currentPageBlocks = [],
  currentPageUuid,
}: SidebarProps) {
  const [mode, setMode] = useState<SidebarMode>("all-pages");
  const tree = buildTree(nodes);

  return (
    <div className="flex flex-col h-full">
      {/* Part 1: Placeholder Section (48px) */}
      <div className="h-12 bg-gray-50 border-b border-gray-200 shrink-0" />

      {/* Part 2: Sticky Navigation Buttons */}
      <div className="sticky top-0 z-10 flex gap-2 p-3 bg-white border-b border-gray-200 shrink-0">
        <button
          onClick={() => setMode("all-pages")}
          className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            mode === "all-pages"
              ? "bg-gray-100 text-gray-900"
              : "text-gray-700 hover:bg-gray-50"
          }`}
        >
          Contents
        </button>
        <button
          onClick={() => setMode("toc")}
          className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            mode === "toc"
              ? "bg-gray-100 text-gray-900"
              : "text-gray-700 hover:bg-gray-50"
          }`}
        >
          On This Page
        </button>
      </div>

      {/* Part 3: Dynamic Content Area */}
      <div className="flex-1 overflow-y-auto">
        {mode === "all-pages" ? (
          // All Pages Tree View
          <nav className="space-y-6 p-3">
            {nodes.length > 0 && (
              <div>
                <h3 className="mb-2 px-0 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Pages
                </h3>
                <div className="space-y-0.5">
                  {tree.map((treeNode) => (
                    <TreeItem
                      key={treeNode.node.uuid}
                      treeNode={treeNode}
                      workspaceSlug={workspaceSlug}
                    />
                  ))}
                </div>
              </div>
            )}
          </nav>
        ) : (
          // Table of Contents View
          <div className="p-3">
            {currentPageBlocks && currentPageUuid ? (
              <TableOfContents
                blocks={currentPageBlocks}
                pageUuid={currentPageUuid}
                workspaceSlug={workspaceSlug}
              />
            ) : (
              <div className="text-xs text-gray-500 italic">
                No blocks on this page
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
