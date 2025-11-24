import { ensurePageName } from '@/modules/content/schema';
import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceBySlug } from "@/modules/workspace/queries";
import { getAllBlocksForPage, getNodeByPath } from "@/modules/content/queries";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const workspaceSlug = searchParams.get("workspace");
  const pagePath = searchParams.get("path");

  if (!workspaceSlug || !pagePath) {
    return NextResponse.json(
      { error: "Missing workspace or path" },
      { status: 400 }
    );
  }

  try {
    // Get workspace
    const workspace = await getWorkspaceBySlug(workspaceSlug);
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // Get node by path
    const pathSegments = pagePath.split("/");
    const node = await getNodeByPath(workspace.id, pathSegments);
    if (!node) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    // Get blocks for this page
    const blocks = await getAllBlocksForPage(workspace.id, ensurePageName(node));

    return NextResponse.json({ blocks });
  } catch (error) {
    console.error("TOC API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
