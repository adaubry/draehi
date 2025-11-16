import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getWorkspaceBySlug } from "@/modules/workspace/queries";
import { getAllNodes } from "@/modules/content/queries";

type PageProps = {
  params: Promise<{
    workspaceSlug: string;
  }>;
};

async function WorkspaceIndexContent({
  workspaceSlug,
}: {
  workspaceSlug: string;
}) {
  // Get workspace by slug
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) {
    notFound();
  }

  // Get all page nodes (getAllNodes now only returns pages, not blocks)
  const pages = await getAllNodes(workspace.id);

  // If no pages, show empty state
  if (pages.length === 0) {
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
  const firstPage = pages.find((n) => !n.isJournal) || pages[0];

  // Redirect to first page
  const pathSegments = firstPage.namespace
    ? [...firstPage.namespace.split("/"), firstPage.slug]
    : [firstPage.slug];

  redirect(`/${workspaceSlug}/${pathSegments.join("/")}`);
}

async function WorkspaceIndexWrapper({ params }: PageProps) {
  const { workspaceSlug } = await params;
  return <WorkspaceIndexContent workspaceSlug={workspaceSlug} />;
}

export default function WorkspaceIndexPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="h-12 w-64 bg-gray-200 animate-pulse rounded mb-4" />
          <div className="h-6 w-96 bg-gray-200 animate-pulse rounded" />
        </div>
      }
    >
      <WorkspaceIndexWrapper params={params} />
    </Suspense>
  );
}
