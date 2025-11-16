import { notFound, redirect } from "next/navigation";
import { getWorkspaceBySlug } from "@/modules/workspace/queries";
import { getAllNodes } from "@/modules/content/queries";

type PageProps = {
  params: Promise<{
    workspaceSlug: string;
  }>;
};

export default async function WorkspaceIndexPage({ params }: PageProps) {
  const { workspaceSlug } = await params;

  // Get workspace by slug
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) {
    notFound();
  }

  // Get all nodes
  const nodes = await getAllNodes(workspace.id);

  // If no nodes, show empty state
  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          {workspace.name}
        </h1>
        <p className="text-gray-600 text-lg max-w-md">
          This workspace doesn't have any content yet. Push your Logseq graph to
          see it here.
        </p>
      </div>
    );
  }

  // Find first non-journal page or first page
  const firstPage = nodes.find((n) => !n.isJournal) || nodes[0];

  // Redirect to first page
  const pathSegments = firstPage.namespace
    ? [...firstPage.namespace.split("/"), firstPage.slug]
    : [firstPage.slug];

  redirect(`/${workspaceSlug}/${pathSegments.join("/")}`);
}
