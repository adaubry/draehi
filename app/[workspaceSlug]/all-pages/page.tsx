import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getWorkspaceBySlug } from "@/modules/workspace/queries";
import { getAllNodes } from "@/modules/content/queries";
import { Breadcrumbs } from "@/components/viewer/Breadcrumbs";

type AllPagesProps = {
  params: Promise<{
    workspaceSlug: string;
  }>;
};

type TreeNode = {
  node: {
    uuid: string;
    title: string;
    pageName: string;
  };
  children: TreeNode[];
};

function buildTree(nodes: any[]): TreeNode[] {
  const pageNodes = nodes.filter((n) => n.parentUuid === null);
  const nodeMap = new Map<string, TreeNode>();
  const rootNodes: TreeNode[] = [];

  // Create tree nodes for all pages
  pageNodes.forEach((node) => {
    nodeMap.set(node.pageName, { node, children: [] });
  });

  // Build hierarchy
  pageNodes.forEach((node) => {
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
  const { node, children } = treeNode;
  const segments = node.pageName.split("/").map((s) =>
    s.toLowerCase().replace(/\s+/g, "-").replace(/[^\w\-]/g, "")
  );
  const href = `/${workspaceSlug}/${segments.join("/")}`;

  return (
    <div>
      <Link
        href={href}
        className="block px-3 py-2 rounded-md text-sm transition-colors text-gray-700 hover:bg-gray-50 hover:text-gray-900"
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

async function AllPagesContent({
  workspaceSlug,
}: {
  workspaceSlug: string;
}) {
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) {
    notFound();
  }

  const nodes = await getAllNodes(workspace.id);
  const tree = buildTree(nodes);
  const pageCount = nodes.filter((n) => n.parentUuid === null).length;
  const blockCount = nodes.filter((n) => n.parentUuid !== null).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumbs */}
      <Breadcrumbs currentTitle="All Pages" workspaceSlug={workspaceSlug} />

      {/* Page Title */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight">All Pages</h1>
        <p className="text-gray-600 mt-2">
          Browse all {pageCount} pages in your workspace
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">Pages</div>
          <div className="text-2xl font-bold text-gray-900">{pageCount}</div>
        </div>
        <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">Blocks</div>
          <div className="text-2xl font-bold text-gray-900">{blockCount}</div>
        </div>
      </div>

      {/* Page Tree */}
      <div className="border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">
          Page Hierarchy
        </h2>
        {tree.length > 0 ? (
          <nav className="space-y-1">
            {tree.map((treeNode) => (
              <TreeItem
                key={treeNode.node.uuid}
                treeNode={treeNode}
                workspaceSlug={workspaceSlug}
              />
            ))}
          </nav>
        ) : (
          <p className="text-gray-500 text-sm">No pages yet</p>
        )}
      </div>
    </div>
  );
}

async function AllPagesWrapper({ params }: AllPagesProps) {
  const { workspaceSlug } = await params;
  return <AllPagesContent workspaceSlug={workspaceSlug} />;
}

export default function AllPagesPage({ params }: AllPagesProps) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <div className="h-8 bg-gray-200 animate-pulse rounded" />
          <div className="h-12 bg-gray-200 animate-pulse rounded" />
          <div className="h-64 bg-gray-200 animate-pulse rounded" />
        </div>
      }
    >
      <AllPagesWrapper params={params} />
    </Suspense>
  );
}
