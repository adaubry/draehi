import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceBySlug } from "@/modules/workspace/queries";
import { getAllBlocksForPageWithHTML } from "@/modules/content/queries";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceSlug = searchParams.get("workspace");
    const pagePath = searchParams.get("path");

    if (!workspaceSlug || !pagePath) {
      return NextResponse.json(
        { error: "Missing workspace or path" },
        { status: 400 }
      );
    }

    // Get workspace by slug
    const workspace = await getWorkspaceBySlug(workspaceSlug);
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // The path is the page name (URL decoded)
    const pageName = decodeURIComponent(pagePath);

    // Get all blocks for this page
    const blocks = await getAllBlocksForPageWithHTML(workspace.id, pageName);

    return NextResponse.json({
      blocks: blocks.map((block) => ({
        id: String(block.id),
        title: block.title,
        slug: block.slug,
        html: block.html,
        order: block.order,
        created_at: block.created_at,
      })),
    });
  } catch (error) {
    console.error("TOC API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch TOC data" },
      { status: 500 }
    );
  }
}
