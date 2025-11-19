import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getWorkspaceBySlug } from "@/modules/workspace/queries";
import { getAllNodes } from "@/modules/content/queries";
import { NavigationProvider } from "@/lib/navigation-context";
import { Sidebar } from "@/components/viewer/Sidebar";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{
    workspaceSlug: string;
  }>;
};

async function WorkspaceContent({
  workspaceSlug,
  children,
}: {
  workspaceSlug: string;
  children: React.ReactNode;
}) {
  // Get workspace by slug
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) {
    notFound();
  }

  // Get all nodes for navigation
  const nodes = await getAllNodes(workspace.id);

  return (
    <NavigationProvider workspaceSlug={workspaceSlug}>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
          <div className="container flex h-14 items-center px-4">
            <div className="mr-4 flex">
              <a href={`/${workspaceSlug}`} className="mr-6 flex items-center space-x-2">
                <span className="font-bold text-xl">{workspace.name}</span>
              </a>
            </div>
          </div>
        </header>

        <div className="container flex-1">
          <div className="flex gap-6 py-6">
            {/* Sidebar Navigation */}
            <aside className="w-64 shrink-0 max-h-[calc(100vh-120px)]">
              <div className="sticky top-20 h-full">
                <Sidebar nodes={nodes} workspaceSlug={workspaceSlug} />
              </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 max-w-4xl">{children}</main>
          </div>
        </div>
      </div>
    </NavigationProvider>
  );
}

async function WorkspaceLayoutWrapper({
  children,
  params,
}: LayoutProps) {
  const { workspaceSlug } = await params;

  return <WorkspaceContent workspaceSlug={workspaceSlug}>{children}</WorkspaceContent>;
}

export default function WorkspaceLayout({ children, params }: LayoutProps) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center">Loading...</div>}>
      <WorkspaceLayoutWrapper params={params}>{children}</WorkspaceLayoutWrapper>
    </Suspense>
  );
}
