import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getWorkspaceBySlug } from "@/modules/workspace/queries";
import { getAllNodes } from "@/modules/content/queries";
import { NavigationProvider } from "@/lib/navigation-context";
import { Sidebar } from "@/components/viewer/Sidebar";
import { MobileSidebar } from "@/components/viewer/MobileSidebar";
import { MobileMenuTrigger } from "@/components/viewer/MobileMenuTrigger";

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
  console.log(`[Layout] Loading workspace: ${workspaceSlug}`);
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) {
    console.error(`[Layout] Workspace not found: ${workspaceSlug}`);
    notFound();
  }
  console.log(`[Layout] Workspace loaded: ${workspace.id}`);

  // Get all nodes for navigation
  console.log(`[Layout] Fetching all page nodes for navigation...`);
  const nodes = await getAllNodes(workspace.id);
  console.log(
    `[Layout] Loaded ${nodes.length} page nodes for sidebar navigation`
  );

  return (
    <NavigationProvider workspaceSlug={workspaceSlug}>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
          <div className="container flex h-14 items-center px-4 gap-3">
            {/* Mobile Menu Trigger */}
            <MobileMenuTrigger />

            {/* Logo */}
            <a
              href={`/${workspaceSlug}`}
              className="mr-auto flex items-center space-x-2"
            >
              <span className="font-bold text-xl">{workspace.name}</span>
            </a>
          </div>
        </header>

        <div className="container flex-1">
          <div className="flex gap-6">
            {/* Sidebar Navigation (Desktop) */}
            <aside className="hidden lg:block w-64 shrink-0">
              <div className="sticky h-[calc(100vh-5rem)] overflow-y-auto">
                <Sidebar nodes={nodes} workspaceSlug={workspaceSlug} />
              </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 max-w-4xl pt-2 ">{children}</main>
          </div>
        </div>

        {/* Mobile Drawer */}
        <MobileSidebar nodes={nodes} workspaceSlug={workspaceSlug} />
      </div>
    </NavigationProvider>
  );
}

async function WorkspaceLayoutWrapper({ children, params }: LayoutProps) {
  const { workspaceSlug } = await params;

  return (
    <WorkspaceContent workspaceSlug={workspaceSlug}>
      {children}
    </WorkspaceContent>
  );
}

export default function WorkspaceLayout({ children, params }: LayoutProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          Loading...
        </div>
      }
    >
      <WorkspaceLayoutWrapper params={params}>
        {children}
      </WorkspaceLayoutWrapper>
    </Suspense>
  );
}
