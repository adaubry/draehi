import { NextRequest, NextResponse } from "next/server";
import { getNodeByPath, getBlocksWithHeadings } from "@/modules/content/queries";
import { getWorkspaceBySlug } from "@/modules/workspace/queries";

interface TOCItem {
  uuid: string;
  title: string;
  level: number;
  children: TOCItem[];
}

/**
 * Build hierarchical TOC tree from flat list of headings
 * Headings are ordered by level (h1, h2, h3)
 */
function buildTOCHierarchy(flatHeadings: Array<{ uuid: string; title: string; level: number }>): TOCItem[] {
  if (flatHeadings.length === 0) return [];

  const items: TOCItem[] = [];
  const stack: TOCItem[] = [];

  for (const heading of flatHeadings) {
    const item: TOCItem = {
      uuid: heading.uuid,
      title: heading.title,
      level: heading.level,
      children: [],
    };

    // Find parent by level
    while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      // Top-level item
      items.push(item);
    } else {
      // Add as child to current parent
      stack[stack.length - 1].children.push(item);
    }

    stack.push(item);
  }

  return items;
}

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

    const blocksWithHeadings = await getBlocksWithHeadings(pageUuid);
    console.log(`[TOC] Found ${blocksWithHeadings.length} blocks with headings`);

    // Extract headings in order
    const flatHeadings = blocksWithHeadings
      .filter((block) => block.metadata?.heading?.text)
      .map((block) => {
        const heading = block.metadata!.heading!;
        return {
          uuid: block.uuid || block.id,
          title: heading.text,
          level: heading.level,
        };
      });

    // Build hierarchical structure
    const tocItems = buildTOCHierarchy(flatHeadings);
    console.log(`[TOC] Built hierarchy with ${tocItems.length} root items`);

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
