"use server";

import { query, queryOne, selectOne } from "@/lib/surreal";
import { getBlockHTML, getBlockHTMLBatch } from "@/lib/keydb";
import { type Node, type NodeWithHTML, nodeRecordId } from "./schema";
import { workspaceRecordId } from "../workspace/schema";
import { cache } from "react";
import type { Breadcrumb } from "@/lib/types";

// Get node by UUID (without HTML)
export const getNodeByUuid = cache(
  async (uuid: string): Promise<Node | null> => {
    return await selectOne<Node>(nodeRecordId(uuid));
  }
);

// Get node by UUID with HTML from KeyDB
export const getNodeByUuidWithHTML = cache(
  async (uuid: string, workspaceId: string): Promise<NodeWithHTML | null> => {
    const node = await selectOne<Node>(nodeRecordId(uuid));
    if (!node) return null;

    const html = await getBlockHTML(workspaceId, uuid);
    return { ...node, html };
  }
);

export const getNodeByPath = cache(
  async (workspaceId: string, pathSegments: string[]): Promise<Node | null> => {
    // Get all page nodes for this workspace
    const pages = await query<Node>(
      "SELECT * FROM nodes WHERE workspace = $ws AND parent = NONE",
      { ws: workspaceRecordId(workspaceId) }
    );

    // Find the page whose slugified pageName matches the URL path
    const matchingPage = pages.find((page) => {
      if (!page?.page_name) return false;
      const pageSegments = String(page.page_name)
        .split("/")
        .map((s) =>
          s.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "")
        );
      return (
        pageSegments.length === pathSegments.length &&
        pageSegments.every((seg, i) => seg === pathSegments[i])
      );
    });

    return matchingPage || null;
  }
);

export const getAllNodes = cache(
  async (workspaceId: string): Promise<Node[]> => {
    // Only return page nodes for navigation (parent = NONE)
    console.log(`[Display] getAllNodes: Fetching page nodes for workspace ${workspaceId}`);
    const nodes = await query<Node>(
      "SELECT * FROM nodes WHERE workspace = $ws AND parent = NONE ORDER BY page_name",
      { ws: workspaceRecordId(workspaceId) }
    );
    console.log(`[Display] getAllNodes: Found ${nodes.length} page nodes`);
    // Serialize to plain objects for Server->Client boundary
    return nodes.map((n) => JSON.parse(JSON.stringify(n)));
  }
);

export const getJournalNodes = cache(
  async (workspaceId: string): Promise<Node[]> => {
    // Journal detection is removed - return empty array
    return [];
  }
);

export const getPageBlocks = cache(
  async (pageUuid: string): Promise<Node[]> => {
    return await query<Node>(
      "SELECT * FROM nodes WHERE parent = $parent ORDER BY order",
      { parent: nodeRecordId(pageUuid) }
    );
  }
);

export const getAllBlocksForPage = cache(
  async (workspaceId: string, pageName: string): Promise<Node[]> => {
    // Get all blocks for this page (excludes the page node itself)
    console.log(`[Display] getAllBlocksForPage: Fetching blocks for page "${pageName}" in workspace ${workspaceId}`);
    const blocks = await query<Node>(
      "SELECT * FROM nodes WHERE workspace = $ws AND page_name = $pageName AND parent != NONE ORDER BY order",
      { ws: workspaceRecordId(workspaceId), pageName }
    );
    console.log(`[Display] getAllBlocksForPage: Found ${blocks.length} blocks for page "${pageName}"`);
    return blocks;
  }
);

// Get all blocks for a page with their HTML from KeyDB
export const getAllBlocksForPageWithHTML = cache(
  async (workspaceId: string, pageName: string): Promise<NodeWithHTML[]> => {
    console.log(`[Display] getAllBlocksForPageWithHTML: Fetching blocks with HTML for page "${pageName}"`);
    const blocks = await getAllBlocksForPage(workspaceId, pageName);

    if (blocks.length === 0) {
      console.log(`[Display] getAllBlocksForPageWithHTML: No blocks found for page "${pageName}"`);
      return [];
    }

    // Batch fetch HTML from KeyDB
    const uuids = blocks.map((b) => getNodeUuidFromRecord(b.id));
    console.log(`[Display] getAllBlocksForPageWithHTML: Batch fetching HTML for ${uuids.length} blocks from KeyDB`);
    const htmlMap = await getBlockHTMLBatch(workspaceId, uuids);
    const htmlCount = Array.from(htmlMap.values()).filter(h => h !== null).length;
    console.log(`[Display] getAllBlocksForPageWithHTML: Retrieved HTML for ${htmlCount}/${uuids.length} blocks`);

    return blocks.map((block) => ({
      ...block,
      html: htmlMap.get(getNodeUuidFromRecord(block.id)) || null,
    }));
  }
);

function getNodeUuidFromRecord(recordId: string | unknown): string {
  const idStr = String(recordId);
  return idStr.replace("nodes:", "");
}

export const getPageBacklinks = cache(
  async (workspaceId: string, pageName: string): Promise<Node[]> => {
    // Find all blocks that reference this page via [[pageName]]
    // This requires scanning HTML in KeyDB - expensive operation
    // For now, return empty - implement with proper indexing later
    return [];
  }
);

export const getBlockBacklinks = cache(
  async (workspaceId: string, pageName: string): Promise<Node[]> => {
    // Find all blocks that reference blocks on this page
    // Requires HTML scanning - return empty for now
    return [];
  }
);
