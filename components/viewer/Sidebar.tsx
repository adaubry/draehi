"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Node } from "@/modules/content/schema";

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

  // Create tree nodes
  nodes.forEach((node) => {
    const key = `${node.namespace}/${node.slug}`;
    nodeMap.set(key, { node, children: [] });
  });

  // Build hierarchy
  nodes.forEach((node) => {
    const key = `${node.namespace}/${node.slug}`;
    const treeNode = nodeMap.get(key);
    if (!treeNode) return;

    if (node.namespace === "") {
      // Root level
      rootNodes.push(treeNode);
    } else {
      // Find parent
      const parentSegments = node.namespace.split("/");
      const parentSlug = parentSegments[parentSegments.length - 1];
      const parentNamespace = parentSegments.slice(0, -1).join("/");
      const parentKey = `${parentNamespace}/${parentSlug}`;
      const parent = nodeMap.get(parentKey);
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

  const pathSegments = node.namespace
    ? [...node.namespace.split("/"), node.slug]
    : [node.slug];
  const href = `/${workspaceSlug}/${pathSegments.join("/")}`;
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
  const tree = buildTree(nodes);
  // Journal detection removed - all nodes are regular pages now
  const journalNodes: Node[] = [];
  const regularNodes = nodes;

  return (
    <nav className="space-y-6">
      {/* Regular Pages */}
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

      {/* Journal Pages */}
      {journalNodes.length > 0 && (
        <div>
          <h3 className="mb-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Journal
          </h3>
          <div className="space-y-0.5">
            {journalNodes.slice(0, 10).map((node) => {
              const href = `/${workspaceSlug}/${node.pageName}`;
              return (
                <Link
                  key={node.uuid}
                  href={href}
                  className="block px-3 py-1.5 rounded-md text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  {node.title}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
