import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceBySlug } from "@/modules/workspace/queries";
import { getAllBlocksForPage } from "@/modules/content/queries";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspace");
    const pagePath = searchParams.get("path");

    console.log(`[TOC] Request: workspace=${workspaceSlug}, path=${pagePath}`);

    if (!workspaceSlug || !pagePath) {
      console.warn(`[TOC] Missing parameters: workspace=${workspaceSlug}, path=${pagePath}`);
      return NextResponse.json(
        { error: "Missing workspace or path" },
        { status: 400 }
      );
    }

    // Get workspace by slug
    const workspace = await getWorkspaceBySlug(workspaceSlug);
    if (!workspace) {
      console.warn(`[TOC] Workspace not found: ${workspaceSlug}`);
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }
    console.log(`[TOC] Workspace found: ${workspace.id}`);

    // The path is the page name (URL decoded)
    const pageName = decodeURIComponent(pagePath);
    console.log(`[TOC] Fetching blocks for page: ${pageName}`);

    // Get all blocks for this page from SurrealDB (structure only, no HTML)
    const blocks = await getAllBlocksForPage(workspace.id, pageName);
    console.log(`[TOC] Blocks fetched: ${blocks.length} blocks from SurrealDB`);

    return NextResponse.json({
      blocks: blocks.map((block) => ({
        uuid: block.id,
        title: block.title,
        order: block.order,
      })),
    });
  } catch (error) {
    console.error("[TOC] API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch TOC data" },
      { status: 500 }
    );
  }
}
