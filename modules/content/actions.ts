"use server";

import { db } from "@/lib/db";
import { nodes, type NewNode } from "./schema";
import { extractNamespaceAndSlug } from "@/lib/utils";
import { eq, and } from "drizzle-orm";
import { exportLogseqNotes } from "../logseq/export";
import { parseLogseqOutput } from "../logseq/parse";
import { parseLogseqDirectory, flattenBlocks } from "../logseq/markdown-parser";
import { marked } from "marked";
import path from "path";

// Internal only - called during git sync/deployment
export async function upsertNode(
  workspaceId: number,
  pageName: string,
  data: {
    title: string;
    html?: string;
    content?: string;
    metadata?: NewNode["metadata"];
    isJournal?: boolean;
    journalDate?: string; // Date string format
  }
) {
  const { slug, namespace, depth } = extractNamespaceAndSlug(pageName);

  // Check if exists
  const existing = await db.query.nodes.findFirst({
    where: and(
      eq(nodes.workspaceId, workspaceId),
      eq(nodes.namespace, namespace),
      eq(nodes.slug, slug)
    ),
  });

  if (existing) {
    // Update
    const [node] = await db
      .update(nodes)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(nodes.id, existing.id))
      .returning();

    return { node };
  } else {
    // Insert
    const [node] = await db
      .insert(nodes)
      .values({
        workspaceId,
        pageName,
        slug,
        namespace,
        depth,
        ...data,
      })
      .returning();

    return { node };
  }
}

export async function deleteNode(id: number) {
  await db.delete(nodes).where(eq(nodes.id, id));
  return { success: true };
}

export async function deleteAllNodes(workspaceId: number) {
  await db.delete(nodes).where(eq(nodes.workspaceId, workspaceId));
  return { success: true };
}

/**
 * Ingest Logseq graph from cloned repository
 * Called during deployment to process and store pages AND blocks
 */
export async function ingestLogseqGraph(
  workspaceId: number,
  repoPath: string
): Promise<{
  success: boolean;
  pageCount?: number;
  blockCount?: number;
  error?: string;
  buildLog?: string[];
}> {
  const buildLog: string[] = [];

  try {
    buildLog.push("Starting Logseq graph ingestion...");

    // Step 1: Parse markdown files for block structure
    buildLog.push("Parsing markdown files for block structure...");
    const pagesDir = path.join(repoPath, "pages");
    const markdownPages = await parseLogseqDirectory(pagesDir);
    buildLog.push(`Found ${markdownPages.length} markdown pages`);

    // Step 2: Export with Rust tool for HTML rendering
    buildLog.push("Rendering HTML with export-logseq-notes...");
    const exportResult = await exportLogseqNotes(repoPath);

    if (!exportResult.success || !exportResult.outputDir) {
      return {
        success: false,
        error: exportResult.error || "Export failed",
        buildLog,
      };
    }

    buildLog.push("HTML rendering successful");

    // Step 3: Parse HTML output for page-level metadata
    const parseResult = await parseLogseqOutput(exportResult.outputDir);

    if (!parseResult.success || !parseResult.pages) {
      return {
        success: false,
        error: parseResult.error || "HTML parse failed",
        buildLog,
      };
    }

    // Step 4: Delete existing nodes (idempotent)
    buildLog.push("Clearing existing nodes...");
    await deleteAllNodes(workspaceId);

    // Step 5: Create page nodes AND block nodes
    buildLog.push("Creating page and block nodes...");
    const allNodes: NewNode[] = [];
    let totalBlocks = 0;

    // Map to store page node IDs for parent references
    const pageNodeMap = new Map<string, number>();

    for (const mdPage of markdownPages) {
      // Find corresponding HTML page for metadata
      const htmlPage = parseResult.pages.find((p) => p.name === mdPage.pageName);
      if (!htmlPage) {
        buildLog.push(`Warning: No HTML found for ${mdPage.pageName}, skipping`);
        continue;
      }

      const { namespace, slug, depth } = extractNamespaceAndSlug(mdPage.pageName);

      // Create page node (nodeType='page', html=null)
      const pageNode: NewNode = {
        workspaceId,
        parentId: null,
        order: 0,
        nodeType: "page",
        pageName: mdPage.pageName,
        slug,
        namespace,
        depth,
        blockUuid: null,
        title: htmlPage.title,
        html: null, // Pages don't have HTML
        metadata: {
          tags: htmlPage.metadata?.tags || [],
          properties: {
            ...mdPage.properties,
            ...htmlPage.metadata?.properties,
          },
        },
        isJournal: htmlPage.isJournal,
        journalDate: htmlPage.journalDate,
      };

      allNodes.push(pageNode);

      // Create block nodes with markdown-rendered HTML
      const flatBlocks = flattenBlocks(mdPage.blocks);
      totalBlocks += flatBlocks.length;

      for (const block of flatBlocks) {
        // Render markdown to HTML for this block
        const blockHTML = await marked.parse(block.content, {
          async: true,
          gfm: true,
        });

        const blockNode: NewNode = {
          workspaceId,
          parentId: null, // Will be set after insertion based on parent relationships
          order: block.order,
          nodeType: "block",
          pageName: mdPage.pageName,
          slug,
          namespace,
          depth: 0, // Will be recalculated after parentId is set
          blockUuid: block.uuid,
          title: "", // Blocks don't have titles
          html: blockHTML.trim(),
          metadata: {
            properties: block.properties,
          },
          isJournal: false,
          journalDate: undefined,
        };

        allNodes.push(blockNode);
      }
    }

    buildLog.push(
      `Inserting ${markdownPages.length} pages and ${totalBlocks} blocks...`
    );

    // Insert all nodes at once
    const insertedNodes = await db.insert(nodes).values(allNodes).returning();

    buildLog.push("Updating parent-child relationships for blocks...");

    // Now update parentId for blocks
    // Build a map of blockUuid -> nodeId
    const blockMap = new Map<string, number>();
    for (const node of insertedNodes) {
      if (node.blockUuid) {
        blockMap.set(node.blockUuid, node.id);
      }
      if (node.nodeType === "page") {
        pageNodeMap.set(node.pageName, node.id);
      }
    }

    // Update parentId for each block based on its parent UUID or page
    const updatePromises: Promise<any>[] = [];
    const parentIdMap = new Map<number, number>(); // blockId -> parentId (for in-memory depth calc)

    for (const mdPage of markdownPages) {
      const pageId = pageNodeMap.get(mdPage.pageName);
      if (!pageId) continue;

      const flatBlocks = flattenBlocks(mdPage.blocks);

      for (const block of flatBlocks) {
        const blockId = blockMap.get(block.uuid || "");
        if (!blockId) continue;

        let parentId: number;

        if (block.parentUuid) {
          // Has parent block
          parentId = blockMap.get(block.parentUuid) || pageId;
        } else {
          // Top-level block, parent is page
          parentId = pageId;
        }

        parentIdMap.set(blockId, parentId); // Track in memory

        updatePromises.push(
          db
            .update(nodes)
            .set({ parentId })
            .where(eq(nodes.id, blockId))
        );
      }
    }

    await Promise.all(updatePromises);

    buildLog.push("Recalculating block depths based on parent chain...");

    // Build set of page IDs
    const pageIds = new Set<number>();
    for (const node of insertedNodes) {
      if (node.nodeType === "page") {
        pageIds.add(node.id);
      }
    }

    // Calculate depths in-memory (no DB queries)
    const depthUpdatePromises: Promise<any>[] = [];
    for (const node of insertedNodes) {
      if (node.nodeType === "block") {
        const depth = calculateBlockDepthInMemory(node.id, parentIdMap, pageIds);
        depthUpdatePromises.push(
          db.update(nodes).set({ depth }).where(eq(nodes.id, node.id))
        );
      }
    }

    await Promise.all(depthUpdatePromises);

    buildLog.push("Ingestion complete!");

    return {
      success: true,
      pageCount: markdownPages.length,
      blockCount: totalBlocks,
      buildLog,
    };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : "Unknown ingestion error";
    buildLog.push(`ERROR: ${errorMsg}`);

    return {
      success: false,
      error: errorMsg,
      buildLog,
    };
  }
}

/**
 * Calculate block depth in-memory without DB queries
 * Recursively traverses parent chain until reaching a page node
 */
function calculateBlockDepthInMemory(
  blockId: number,
  parentIdMap: Map<number, number>,
  pageIds: Set<number>
): number {
  const parentId = parentIdMap.get(blockId);

  if (!parentId) return 0;

  // If parent is a page, depth is 0
  if (pageIds.has(parentId)) return 0;

  // Parent is a block, add 1 to parent's depth
  return 1 + calculateBlockDepthInMemory(parentId, parentIdMap, pageIds);
}
