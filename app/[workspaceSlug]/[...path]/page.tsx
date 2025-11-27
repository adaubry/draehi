import { ensurePageName } from '@/modules/content/schema';
import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getWorkspaceBySlug } from "@/modules/workspace/queries";
import {
  getNodeByPath,
  getPageTreeWithHTML,
  getPageBacklinks,
  getBlockBacklinks,
  type TreeNode,
} from "@/modules/content/queries";
import { BlockTree } from "@/components/viewer/BlockTree";
import { Breadcrumbs } from "@/components/viewer/Breadcrumbs";
import { PageBlocksContextProvider } from "@/components/viewer/PageBlocksContextProvider";

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
  const pathStr = path.join("/");
  console.log(`[Display] NodePage: Rendering page for path "${pathStr}" in workspace "${workspaceSlug}"`);

  // Get workspace by slug
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) {
    console.error(`[Display] NodePage: Workspace not found "${workspaceSlug}"`);
    notFound();
  }
  console.log(`[Display] NodePage: Workspace found ${workspace.id}`);

  // Get node by path
  const node = await getNodeByPath(workspace.id, path);
  if (!node) {
    console.error(`[Display] NodePage: Node not found for path "${pathStr}"`);
    notFound();
  }
  console.log(`[Display] NodePage: Node found "${node.title}" (${node.uuid}), isPage=${node.parentUuid === null}`);

  // Get tree for this page with HTML (if it's a page node)
  const pageTree: TreeNode | null =
    node.parentUuid === null
      ? await getPageTreeWithHTML(node.uuid || node.id.replace("nodes:", ""), workspace.id)
      : null;
  console.log(`[Display] NodePage: Loaded tree for page "${ensurePageName(node)}"`);

  // Get backlinks (only for page nodes)
  const citedBy = node.parentUuid === null
    ? await getPageBacklinks(workspace.id, ensurePageName(node))
    : [];

  const related = node.parentUuid === null
    ? await getBlockBacklinks(workspace.id, ensurePageName(node))
    : [];

  const pagePath = path.join("/");

  return (
    <PageBlocksContextProvider tree={pageTree} pageUuid={node.uuid || node.id}>
      <div className="flex flex-col gap-6">
        {/* Breadcrumbs */}
        <Breadcrumbs currentTitle={node.title} workspaceSlug={workspaceSlug} />

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
        {pageTree && pageTree.children.length > 0 ? (
          <BlockTree
            tree={pageTree}
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
                    const segments = ensurePageName(page).split("/").map(s =>
                      s.toLowerCase().replace(/\s+/g, "-").replace(/[^\w\-]/g, "")
                    );
                    const href = `/${workspaceSlug}/${segments.join("/")}`;
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
                    const segments = ensurePageName(page).split("/").map(s =>
                      s.toLowerCase().replace(/\s+/g, "-").replace(/[^\w\-]/g, "")
                    );
                    const href = `/${workspaceSlug}/${segments.join("/")}`;
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
    </PageBlocksContextProvider>
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
