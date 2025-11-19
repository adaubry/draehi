"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Node } from "@/modules/content/schema";
import { TableOfContents } from "./TableOfContents";
import { usePageBlocks } from "@/lib/page-blocks-context";

type SidebarProps = {
  nodes: Node[];
  workspaceSlug: string;
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

  const segments = node.pageName.split("/").map((s) =>
    s
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w\-]/g, "")
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
  const { blocks, pageUuid } = usePageBlocks();

  // Auto-detect which mode to show based on current route
  const isOnAllPagesRoute =
    pathname === `/${workspaceSlug}/all-pages` ||
    pathname === `/${workspaceSlug}/all-pages/`;
  const mode: SidebarMode = isOnAllPagesRoute ? "all-pages" : "toc";

  // Use context blocks for TOC mode
  const tocBlocks = mode === "toc" ? blocks : [];
  const tocPageUuid = mode === "toc" ? pageUuid : "";

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
    <div className="flex flex-col h-full">
      {/* Part 1: Placeholder Section (48px) */}
      <div className="h-12 bg-gray-50 border-b border-gray-200 shrink-0" />

      {/* Part 2: Default Action Buttons */}
      <div className="sticky top-0 z-10 flex flex-col gap-1 p-3 bg-white border-b border-gray-200 shrink-0">
        <Link
          href="/dashboard"
          className="block px-3 py-1.5 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors text-center"
        >
          Dashboard
        </Link>
        <Link
          href={`/${workspaceSlug}`}
          className="block px-3 py-1.5 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors text-center"
        >
          Home
        </Link>
        <Link
          href={`/${workspaceSlug}/all-pages`}
          className={`block px-3 py-1.5 rounded-md text-xs font-medium transition-colors text-center ${
            isOnAllPagesRoute
              ? "bg-gray-100 text-gray-900"
              : "text-gray-700 hover:bg-gray-50"
          }`}
        >
          All Pages
        </Link>
      </div>

      {/* Part 3: Dynamic Content Area */}
      <div className="flex-1 ">
        {mode === "all-pages" ? (
          // All Pages Tree View
          <nav className="space-y-6 p-3">
            {nodes.length > 0 && (
              <div>
                <h3 className="mb-2 px-0 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Pages
                </h3>
                <div className="space-y-0.5 ">
                  {tree.map((treeNode) => (
                    <div className="todo">
                      <TreeItem
                        key={treeNode.node.uuid}
                        treeNode={treeNode}
                        workspaceSlug={workspaceSlug}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </nav>
        ) : (
          // Table of Contents View
          <div className="p-3">
            {tocBlocks && tocBlocks.length > 0 && tocPageUuid ? (
              <TableOfContents
                blocks={tocBlocks}
                pageUuid={tocPageUuid}
                pageTitle="On This Page"
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
