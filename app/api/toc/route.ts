import { NextRequest, NextResponse } from "next/server";
import { getNodeByPath, getTOCForPage } from "@/modules/content/queries";
import { getWorkspaceBySlug } from "@/modules/workspace/queries";

/**
 * TOC API endpoint
 * Returns block headings in hierarchical structure for table of contents rendering
 * Fetches all blocks with metadata.heading for the page
 */
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

    // Find page by URL path
    const pathSegments = pagePath
      .split("/")
      .map((s) => s.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, ""));

    const pageNode = await getNodeByPath(workspace.id, pathSegments);
    if (!pageNode) {
      console.warn(`[TOC] Page not found for path: ${pagePath}`);
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    console.log(`[TOC] Page found: ${pageNode.title} (uuid=${pageNode.uuid})`);

    // Get all blocks with headings for this page
    const pageUuid = pageNode.uuid;
    if (!pageUuid) {
      console.warn(`[TOC] Page node missing UUID: ${pageNode.id}`);
      return NextResponse.json({
        pageTitle: pageNode.title,
        items: [],
      });
    }

    // Get TOC items for the page
    const tocItems = await getTOCForPage(pageUuid, workspace.id);
    console.log(`[TOC] Built TOC with ${tocItems.length} root items`);

    return NextResponse.json({
      pageTitle: pageNode.title,
      items: tocItems,
    });
  } catch (error) {
    console.error("[TOC] API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch TOC data" },
      { status: 500 }
    );
  }
}
