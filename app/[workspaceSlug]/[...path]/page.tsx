import { notFound } from "next/navigation";
import { getWorkspaceBySlug } from "@/modules/workspace/queries";
import { getNodeByPath, getNodeBreadcrumbs } from "@/modules/content/queries";
import { Breadcrumbs } from "@/components/viewer/Breadcrumbs";
import { NodeContent } from "@/components/viewer/NodeContent";

type PageProps = {
  params: Promise<{
    workspaceSlug: string;
    path?: string[];
  }>;
};

export default async function NodePage({ params }: PageProps) {
  const { workspaceSlug, path = [] } = await params;

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

  // Get breadcrumbs
  const breadcrumbs = await getNodeBreadcrumbs(node, workspaceSlug);

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

      {/* Node Content */}
      <NodeContent html={node.html || ""} />
    </div>
  );
}
