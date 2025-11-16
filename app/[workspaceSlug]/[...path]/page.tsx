import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getWorkspaceBySlug } from "@/modules/workspace/queries";
import {
  getNodeByPath,
  getNodeBreadcrumbs,
  getAllBlocksForPage,
} from "@/modules/content/queries";
import { Breadcrumbs } from "@/components/viewer/Breadcrumbs";
import { BlockTree } from "@/components/viewer/BlockTree";

type PageProps = {
  params: Promise<{
    workspaceSlug: string;
    path?: string[];
  }>;
};

async function NodePageContent({
  workspaceSlug,
  path,
}: {
  workspaceSlug: string;
  path: string[];
}) {
  // Get workspace by slug
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) {
    notFound();
  }

  // Get node by path
  const node = await getNodeByPath(workspace.id, path);
  if (!node) {
    notFound();
  }

  // Get all blocks for this page (if it's a page node)
  const blocks =
    node.nodeType === "page"
      ? await getAllBlocksForPage(workspace.id, node.pageName)
      : [];

  // Get breadcrumbs
  const breadcrumbs = await getNodeBreadcrumbs(node, workspaceSlug);

  const pagePath = path.join("/");

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}

      {/* Page Title */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">{node.title}</h1>
        {node.metadata?.tags && node.metadata.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {node.metadata.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Logseq-style Block Tree */}
      {blocks.length > 0 ? (
        <BlockTree
          blocks={blocks}
          workspaceSlug={workspaceSlug}
          pagePath={pagePath}
        />
      ) : (
        <div className="text-gray-500 italic">No blocks yet</div>
      )}
    </div>
  );
}

async function NodePageWrapper({ params }: PageProps) {
  const { workspaceSlug, path = [] } = await params;
  return <NodePageContent workspaceSlug={workspaceSlug} path={path} />;
}

export default function NodePage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <div className="h-8 bg-gray-200 animate-pulse rounded" />
          <div className="h-12 bg-gray-200 animate-pulse rounded" />
        </div>
      }
    >
      <NodePageWrapper params={params} />
    </Suspense>
  );
}
