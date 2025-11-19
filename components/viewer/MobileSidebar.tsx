"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Node } from "@/modules/content/schema";
import { TableOfContents } from "./TableOfContents";
import { usePageBlocks } from "@/lib/page-blocks-context";

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
  onNavigate,
}: {
  treeNode: TreeNode;
  workspaceSlug: string;
  depth?: number;
  onNavigate?: () => void;
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
  const [mode, setMode] = useState<SidebarMode>("all-pages");
  const tree = buildTree(nodes);
  const { blocks, pageUuid } = usePageBlocks();

  const closeDrawer = () => setIsOpen(false);

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed bottom-6 right-6 z-30 flex items-center justify-center "
        aria-label="Toggle navigation menu"
        aria-expanded={isOpen}
      ></button>

      {/* Drawer Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-20 transition-opacity duration-200"
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}

      {/* Drawer Panel */}
      <div
        className={`lg:hidden fixed left-0 top-0 w-80 h-screen bg-white shadow-lg z-25 transform transition-transform duration-200 ease-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          zIndex: 25,
        }}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200 bg-white">
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

        {/* Drawer Content */}
        <div className="h-[calc(100%-56px)] overflow-y-auto">
          {/* Placeholder */}
          <div className="h-12 bg-gray-50 border-b border-gray-200 shrink-0" />

          {/* Mode Buttons */}
          <div className="flex gap-2 p-3 bg-white border-b border-gray-200">
            <button
              onClick={() => setMode("all-pages")}
              className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                mode === "all-pages"
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              Contents
            </button>
            <button
              onClick={() => setMode("toc")}
              className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                mode === "toc"
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              On This Page
            </button>
          </div>

          {/* Content Area */}
          {mode === "all-pages" ? (
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
                        onNavigate={closeDrawer}
                      />
                    ))}
                  </div>
                </div>
              )}
            </nav>
          ) : (
            <div className="p-3">
              {blocks && blocks.length > 0 && pageUuid ? (
                <TableOfContents
                  blocks={blocks}
                  pageUuid={pageUuid}
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
    </>
  );
}
