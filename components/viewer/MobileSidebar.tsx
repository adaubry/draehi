"use client";

import { ensurePageName } from "@/modules/content/schema";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Node } from "@/modules/content/schema";
import { TableOfContents } from "./TableOfContents";

type MobileSidebarProps = {
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

  // Filter only page nodes (parentUuid === null)
  const pageNodes = nodes.filter((n) => n.parentUuid === null);

  pageNodes.forEach((node) => {
    nodeMap.set(ensurePageName(node), { node, children: [] });
  });

  pageNodes.forEach((node) => {
    const treeNode = nodeMap.get(ensurePageName(node));
    if (!treeNode) return;

    const segments = ensurePageName(node).split("/");
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
  onNavigate,
}: {
  treeNode: TreeNode;
  workspaceSlug: string;
  depth?: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { node, children } = treeNode;

  const segments = ensurePageName(node)
    .split("/")
    .map((s) =>
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
        onClick={onNavigate}
        className={`block px-3 py-2 rounded-md text-sm transition-colors ${
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
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function MobileSidebar({ nodes, workspaceSlug }: MobileSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const tree = buildTree(nodes);

  // Auto-detect mode based on pathname
  const isOnAllPagesRoute =
    pathname === `/${workspaceSlug}/all-pages` ||
    pathname === `/${workspaceSlug}/all-pages/`;
  const mode: SidebarMode = isOnAllPagesRoute ? "all-pages" : "toc";

  const closeDrawer = () => setIsOpen(false);

  return (
    <>
      {/* Hamburger Button - Fixed Bottom Right */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed  z-30 flex items-center justify-"
        aria-label="Toggle navigation menu"
        aria-expanded={isOpen}
      ></button>

      {/* Drawer Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40 transition-opacity duration-200"
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}

      {/* Drawer Panel */}
      <div
        className={`lg:hidden fixed left-0 top-0 w-80 h-screen bg-white shadow-lg z-50 transform transition-transform duration-200 ease-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200 bg-white shrink-0">
          <span className="text-sm font-semibold text-gray-900">Menu</span>
          <button
            onClick={closeDrawer}
            className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close navigation menu"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Drawer Content - scrollable with hidden scrollbar */}
        <div className="flex flex-col h-[calc(100%-56px)]">
          {/* Placeholder */}
          <div className="h-12 bg-gray-50 border-b border-gray-200 shrink-0" />

          {/* Navigation Buttons */}
          <div className="flex flex-col gap-1 p-3 bg-white border-b border-gray-200 shrink-0">
            <Link
              href="/dashboard"
              onClick={closeDrawer}
              className="block px-3 py-1.5 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors "
            >
              Dashboard
            </Link>
            <Link
              href={`/${workspaceSlug}`}
              onClick={closeDrawer}
              className="block px-3 py-1.5 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors "
            >
              Home
            </Link>
            <Link
              href={`/${workspaceSlug}/all-pages`}
              onClick={closeDrawer}
              className={`block px-3 py-1.5 rounded-md text-xs font-medium transition-colors  ${
                isOnAllPagesRoute
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              All Pages
            </Link>
          </div>

          {/* Dynamic Content Area - scrollable with hidden scrollbar */}
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {mode === "all-pages" ? (
              // All Pages Tree View
              <nav className="p-3">
                {tree.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Pages
                    </h3>
                    <div className="space-y-0.5">
                      {tree.map((treeNode) => (
                        <TreeItem
                          key={treeNode.node.uuid}
                          treeNode={treeNode}
                          workspaceSlug={workspaceSlug}
                          onNavigate={closeDrawer}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </nav>
            ) : (
              // Table of Contents View (same async component as desktop)
              <div className="p-3">
                <TableOfContents workspaceSlug={workspaceSlug} />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
