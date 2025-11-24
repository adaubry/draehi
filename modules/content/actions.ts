"use server";

import { createWithId, query, queryOne, remove } from "@/lib/surreal";
import {
  setBlockHTMLBatch,
  clearWorkspaceCache,
  setPageBlockOrder,
} from "@/lib/keydb";
import { type Node, type NewNode, nodeRecordId } from "./schema";
import { workspaceRecordId } from "../workspace/schema";
import { extractNamespaceAndSlug } from "@/lib/utils";
import { exportLogseqNotes } from "../logseq/export";
import { parseLogseqOutput, processAssets } from "../logseq/parse";
import {
  parseLogseqDirectory,
  flattenBlocks,
} from "../logseq/markdown-parser";
import {
  processLogseqReferences,
  processEmbeds,
} from "../logseq/process-references";
import { marked } from "marked";
import path from "path";
import crypto from "crypto";

// Internal only - called during git sync/deployment
export async function upsertNode(
  workspaceId: string,
  pageName: string,
  data: {
    title: string;
    html?: string;
    content?: string;
    metadata?: Node["metadata"];
  }
) {
  const { slug } = extractNamespaceAndSlug(pageName);

  // Check if exists
  const existing = await queryOne<Node>(
    "SELECT * FROM nodes WHERE workspace = $ws AND page_name = $pageName LIMIT 1",
    { ws: workspaceRecordId(workspaceId), pageName }
  );

  // Generate stable UUID
  const pageUuidSeed = `${workspaceId}::${pageName}`;
  const pageUuidHash = crypto.createHash("sha256").update(pageUuidSeed).digest("hex");
  const pageUuid = `${pageUuidHash.slice(0, 8)}-${pageUuidHash.slice(8, 12)}-${pageUuidHash.slice(12, 16)}-${pageUuidHash.slice(16, 20)}-${pageUuidHash.slice(20, 32)}`;

  if (existing) {
    // Update via query
    const [node] = await query<Node>(
      `UPDATE $thing SET
        title = $title,
        metadata = $metadata,
        updated_at = time::now()
      RETURN AFTER`,
      { thing: existing.id, title: data.title, metadata: data.metadata || {} }
    );
    return { node };
  } else {
    // Insert with specific ID
    const node = await createWithId<Node>(`nodes:${pageUuid}`, {
      workspace: workspaceRecordId(workspaceId),
      page_name: pageName,
      slug,
      title: data.title,
      metadata: data.metadata || {},
      order: 0,
    });
    return { node };
  }
}

export async function deleteNode(uuid: string) {
  await remove(nodeRecordId(uuid));
  return { success: true };
}

export async function deleteAllNodes(workspaceId: string) {
  await query("DELETE nodes WHERE workspace = $ws", {
    ws: workspaceRecordId(workspaceId),
  });
  // Also clear KeyDB cache
  await clearWorkspaceCache(workspaceId);
  return { success: true };
}

/**
 * Ingest Logseq graph from cloned repository
 * Called during deployment to process and store pages AND blocks
 */
export async function ingestLogseqGraph(
  workspaceId: string,
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

    // Get workspace to access slug for reference links
    const workspace = await queryOne<{ id: string; slug: string }>(
      "SELECT id, slug FROM workspaces WHERE id = $ws",
      { ws: workspaceRecordId(workspaceId) }
    );

    if (!workspace) {
      return {
        success: false,
        error: "Workspace not found",
        buildLog,
      };
    }

    const workspaceSlug = workspace.slug;

    // Step 1: Parse markdown files for block structure
    buildLog.push("Parsing markdown files for block structure...");
    const pagesDir = path.join(repoPath, "pages");
    const journalsDir = path.join(repoPath, "journals");

    const [regularPages, journalPages] = await Promise.all([
      parseLogseqDirectory(pagesDir),
      parseLogseqDirectory(journalsDir).catch(() => []),
    ]);

    const markdownPages = [...regularPages, ...journalPages];
    buildLog.push(
      `Found ${regularPages.length} pages and ${journalPages.length} journals`
    );

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

    // Step 4: Delete existing nodes and clear KeyDB cache
    buildLog.push("Clearing existing nodes and cache...");
    await deleteAllNodes(workspaceId);

    // Step 5: Create page nodes AND block nodes
    buildLog.push("Creating page and block nodes...");
    const allNodeData: Array<{ uuid: string; data: Record<string, unknown> }> =
      [];
    const allBlockHTML: Array<{ uuid: string; html: string }> = [];
    const pageBlockOrders: Map<string, string[]> = new Map();
    let totalBlocks = 0;

    for (const mdPage of markdownPages) {
      // Normalize name for matching
      let normalizedMdName = mdPage.pageName;
      try {
        normalizedMdName = decodeURIComponent(normalizedMdName);
      } catch {
        // If not valid URI component, use as-is
      }
      normalizedMdName = normalizedMdName
        .replace(/[?!\\/\\\\:*\"<>|(),.]/g, "")
        .replace(/[\\s\\-]+/g, "_")
        .replace(/_{2,}/g, "_")
        .toLowerCase();

      let htmlPage = parseResult.pages.find(
        (p) => p.name.toLowerCase() === normalizedMdName
      );

      // Fuzzy match fallback
      if (!htmlPage && normalizedMdName.includes("_")) {
        const noUnderscores = normalizedMdName.replace(/_/g, "");
        const candidates = parseResult.pages.filter(
          (p) => p.name.toLowerCase().replace(/_/g, "") === noUnderscores
        );
        if (candidates.length === 1) {
          htmlPage = candidates[0];
          buildLog.push(`Fuzzy matched: ${mdPage.pageName} → ${htmlPage.name}`);
        }
      }

      if (!htmlPage) {
        buildLog.push(
          `Warning: No HTML found for ${mdPage.pageName}, skipping`
        );
        continue;
      }

      const { slug } = extractNamespaceAndSlug(mdPage.pageName);

      // Generate stable page UUID
      const pageUuidSeed = `${workspaceId}::${mdPage.pageName}`;
      const pageUuidHash = crypto
        .createHash("sha256")
        .update(pageUuidSeed)
        .digest("hex");
      const pageUuid = `${pageUuidHash.slice(0, 8)}-${pageUuidHash.slice(
        8,
        12
      )}-${pageUuidHash.slice(12, 16)}-${pageUuidHash.slice(
        16,
        20
      )}-${pageUuidHash.slice(20, 32)}`;

      // Page node data
      allNodeData.push({
        uuid: pageUuid,
        data: {
          workspace: workspaceRecordId(workspaceId),
          page_name: mdPage.pageName,
          slug,
          title: htmlPage.title,
          order: 0,
          metadata: {
            tags: htmlPage.metadata?.tags || [],
            properties: {
              ...mdPage.properties,
              ...htmlPage.metadata?.properties,
            },
          },
        },
      });

      if (mdPage.blocks.length === 0) {
        buildLog.push(
          `Page ${mdPage.pageName} has no blocks (property-only page)`
        );
        continue;
      }

      // Create block nodes
      const flatBlocks = flattenBlocks(mdPage.blocks);
      totalBlocks += flatBlocks.length;

      const blockUuidsInOrder: string[] = [];

      for (const block of flatBlocks) {
        // Render markdown to HTML
        let blockHTML = await marked.parse(block.content, {
          async: true,
          gfm: true,
        });

        // Add uuid to headings for TOC extraction
        blockHTML = blockHTML.replace(
          /<(h[1-3])([^>]*)>/g,
          `<$1$2 uuid="${block.uuid}">`
        );

        // Process assets and references
        blockHTML = await processAssets(blockHTML, workspaceId, repoPath);
        blockHTML = processEmbeds(blockHTML);
        blockHTML = processLogseqReferences(
          blockHTML,
          workspaceSlug,
          mdPage.pageName
        );

        // Block node data
        allNodeData.push({
          uuid: block.uuid,
          data: {
            workspace: workspaceRecordId(workspaceId),
            parent: nodeRecordId(block.parentUuid || pageUuid),
            page_name: mdPage.pageName,
            slug,
            title: "",
            order: block.order,
            metadata: {
              properties: block.properties,
            },
          },
        });

        // Store HTML for KeyDB
        allBlockHTML.push({
          uuid: block.uuid,
          html: blockHTML.trim(),
        });

        blockUuidsInOrder.push(block.uuid);
      }

      pageBlockOrders.set(mdPage.pageName, blockUuidsInOrder);
    }

    buildLog.push(
      `Inserting ${allNodeData.length} nodes (${markdownPages.length} pages and ${totalBlocks} blocks)...`
    );

    // Batch insert nodes into SurrealDB
    const BATCH_SIZE = 500;
    for (let i = 0; i < allNodeData.length; i += BATCH_SIZE) {
      const batch = allNodeData.slice(i, i + BATCH_SIZE);
      for (const { uuid, data } of batch) {
        await createWithId(`nodes:${uuid}`, data);
      }
      buildLog.push(
        `  Inserted node batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
          allNodeData.length / BATCH_SIZE
        )}`
      );
    }

    // Batch insert HTML into KeyDB
    buildLog.push(`Caching ${allBlockHTML.length} block HTMLs in KeyDB...`);
    await setBlockHTMLBatch(workspaceId, allBlockHTML);

    // Store page block orders
    for (const [pageName, uuids] of pageBlockOrders) {
      await setPageBlockOrder(workspaceId, pageName, uuids);
    }

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
