import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getWorkspaceBySlug } from "@/modules/workspace/queries";
import {
  getNodeByPath,
  getNodeBreadcrumbs,
  getAllBlocksForPage,
  getPageBacklinks,
  getBlockBacklinks,
} from "@/modules/content/queries";
import { Breadcrumbs } from "@/components/viewer/Breadcrumbs";
import { BlockTree } from "@/components/viewer/BlockTree";

export const dynamic = "force-dynamic";

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
    node.parentUuid === null
      ? await getAllBlocksForPage(workspace.id, node.pageName)
      : [];

  // Get breadcrumbs
  const breadcrumbs = await getNodeBreadcrumbs(node, workspaceSlug);

  // Get backlinks (only for page nodes)
  const citedBy = node.parentUuid === null
    ? await getPageBacklinks(workspace.id, node.pageName)
    : [];

  const related = node.parentUuid === null
    ? await getBlockBacklinks(workspace.id, node.pageName)
    : [];

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
          blocks={[node, ...blocks]}
          workspaceSlug={workspaceSlug}
          pagePath={pagePath}
        />
      ) : (
        <div className="text-gray-500 italic">No blocks yet</div>
      )}

      {/* Backlinks Section */}
      {(citedBy.length > 0 || related.length > 0) && (
        <div className="mt-12 pt-8 border-t border-gray-200">
          {/* Cited By (Direct Page References) */}
          {citedBy.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4 text-gray-700">
                Cited by ({citedBy.length})
              </h2>
              <div className="space-y-2">
                {citedBy.map((page) => {
                  const pageSegments = page.namespace
                    ? [...page.namespace.split("/"), page.slug]
                    : [page.slug];
                  const href = `/${workspaceSlug}/${pageSegments.join("/")}`;
                  return (
                    <Link
                      key={page.uuid}
                      href={href}
                      className="block px-4 py-2 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-blue-600 hover:text-blue-700">
                        {page.title}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Related (Block References) */}
          {related.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 text-gray-700">
                Related ({related.length})
              </h2>
              <div className="space-y-2">
                {related.map((page) => {
                  const pageSegments = page.namespace
                    ? [...page.namespace.split("/"), page.slug]
                    : [page.slug];
                  const href = `/${workspaceSlug}/${pageSegments.join("/")}`;
                  return (
                    <Link
                      key={page.uuid}
                      href={href}
                      className="block px-4 py-2 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-blue-600 hover:text-blue-700">
                        {page.title}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
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
