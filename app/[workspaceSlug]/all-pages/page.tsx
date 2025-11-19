import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getWorkspaceBySlug } from "@/modules/workspace/queries";
import { getAllNodes } from "@/modules/content/queries";

type PageProps = {
  params: Promise<{
    workspaceSlug: string;
  }>;
};

async function AllPagesContent({ workspaceSlug }: { workspaceSlug: string }) {
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) {
    notFound();
  }

  const nodes = await getAllNodes(workspace.id);
  const pages = nodes.filter((n) => n.parentUuid === null);

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">All Pages</h1>
        <p className="text-gray-600">
          Browse all {pages.length} pages in this workspace
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pages.map((page) => {
          const segments = page.pageName.split("/").map((s) =>
            s.toLowerCase().replace(/\s+/g, "-").replace(/[^\w\-]/g, "")
          );
          const href = `/${workspaceSlug}/${segments.join("/")}`;

          return (
            <a
              key={page.uuid}
              href={href}
              className="block p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
            >
              <h3 className="font-medium text-gray-900">{page.title}</h3>
              {page.metadata?.tags && page.metadata.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {page.metadata.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
                    >
                      #{tag}
                    </span>
                  ))}
                  {page.metadata.tags.length > 3 && (
                    <span className="text-xs text-gray-400">
                      +{page.metadata.tags.length - 3} more
                    </span>
                  )}
                </div>
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}

async function AllPagesWrapper({ params }: PageProps) {
  const { workspaceSlug } = await params;
  return <AllPagesContent workspaceSlug={workspaceSlug} />;
}

export default function AllPagesPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <div className="h-12 bg-gray-200 animate-pulse rounded" />
          <div className="grid grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 animate-pulse rounded" />
            ))}
          </div>
        </div>
      }
    >
      <AllPagesWrapper params={params} />
    </Suspense>
  );
}
