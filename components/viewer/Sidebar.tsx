// TODO: Consider migrating to shadcn/ui components (ScrollArea, Accordion, etc.)
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Node } from "@/modules/content/schema";
import { TableOfContents } from "./TableOfContents";

type SidebarProps = {
  nodes: Node[];
  workspaceSlug: string;
};

type TreeNode = {
  node: Node;
  children: TreeNode[];
};

function buildTree(nodes: Node[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  const rootNodes: TreeNode[] = [];

  // Create tree nodes by pageName
  nodes.forEach((node) => {
    nodeMap.set(node.pageName, { node, children: [] });
  });

  // Build hierarchy based on pageName path (e.g., "guides/setup/intro")
  nodes.forEach((node) => {
    const treeNode = nodeMap.get(node.pageName);
    if (!treeNode) return;

    // Get parent pageName by removing last segment
    const segments = node.pageName.split("/");
    if (segments.length === 1) {
      // Root level (no slashes)
      rootNodes.push(treeNode);
    } else {
      // Has parent path
      const parentPageName = segments.slice(0, -1).join("/");
      const parent = nodeMap.get(parentPageName);
      if (parent) {
        parent.children.push(treeNode);
      } else {
        // Parent not found, add to root
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

  // Build href from pageName by slugifying each segment
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

export function Sidebar({ nodes, workspaceSlug }: SidebarProps) {
  const pathname = usePathname();
  const tree = buildTree(nodes);
  const regularNodes = nodes;

  const isAllPages = pathname.endsWith("/all-pages");

  // Get blocks for current page from nodes
  // pathname format: /{workspaceSlug}/{...path}
  let currentBlocks: Node[] = [];
  if (!isAllPages) {
    const pathSegments = pathname.split("/").filter(Boolean);
    if (pathSegments.length > 1) {
      const slugPath = pathSegments.slice(1).join("/");
      const currentNode = nodes.find((n) => {
        const nodeSlugPath = n.pageName
          .split("/")
          .map((s) =>
            s.toLowerCase().replace(/\s+/g, "-").replace(/[^\w\-]/g, "")
          )
          .join("/");
        return nodeSlugPath === slugPath;
      });

      if (currentNode) {
        // Get all blocks for this page
        currentBlocks = nodes.filter(
          (n) => n.pageName === currentNode.pageName && n.parentUuid !== null
        );

        // DEBUG
        console.log("=== Sidebar Debug ===");
        console.log("Current pathname:", pathname);
        console.log("Slug path:", slugPath);
        console.log("Current page:", currentNode.pageName);
        console.log("Blocks found:", currentBlocks.length);
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Section 1: Placeholder for future integrations */}
      <div className="h-12 bg-gray-50 border-b border-gray-200 flex items-center justify-center">
        <span className="text-xs text-gray-400">Reserved for integrations</span>
      </div>

      {/* Section 2: Navigation Buttons */}
      <div className="px-3 space-y-1 border-b border-gray-200 pb-4">
        <Link
          href={`/${workspaceSlug}/contents`}
          className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            pathname === `/${workspaceSlug}/contents` || pathname === `/${workspaceSlug}`
              ? "bg-gray-100 text-gray-900"
              : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
          }`}
        >
          📄 Contents
        </Link>
        <Link
          href={`/${workspaceSlug}/all-pages`}
          className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            isAllPages
              ? "bg-gray-100 text-gray-900"
              : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
          }`}
        >
          📚 All Pages
        </Link>
      </div>

      {/* Section 3: Dynamic Content (TOC or Page Tree) */}
      {isAllPages ? (
        // Mode 1: All Pages - Show full page tree
        <nav className="space-y-6">
          {regularNodes.length > 0 && (
            <div>
              <h3 className="mb-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
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
        // Mode 2: Regular Page - Show Table of Contents
        <TableOfContents blocks={currentBlocks} maxDepth={3} />
      )}
    </div>
  );
}
