import { NextRequest, NextResponse } from "next/server";
import { getNodeByPath } from "@/modules/content/queries";
import { getWorkspaceBySlug } from "@/modules/workspace/queries";

/**
 * TOC API endpoint
 * Returns page structure with heading metadata for table of contents rendering
 * TOC uses the page tree structure + metadata.headings, NOT HTML content
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

    // Get page node to extract headings from metadata
    const pageName = decodeURIComponent(pagePath);
    console.log(`[TOC] Looking up page: ${pageName}`);

    // Find page by URL path
    const pathSegments = pagePath
      .split("/")
      .map((s) => s.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, ""));

    const pageNode = await getNodeByPath(workspace.id, pathSegments);
    if (!pageNode) {
      console.warn(`[TOC] Page not found for path: ${pagePath}`);
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    // Extract heading from metadata for TOC display
    const heading = pageNode.metadata?.heading;
    console.log(`[TOC] Page found: ${pageNode.title}, heading: ${heading?.text || "none"}`);

    return NextResponse.json({
      pageTitle: pageNode.title,
      heading: heading || null,
    });
  } catch (error) {
    console.error("[TOC] API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch TOC data" },
      { status: 500 }
    );
  }
}
