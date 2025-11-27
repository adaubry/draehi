"use server";

import { createWithId, query, queryOne, remove } from "@/lib/surreal";
import {
  setBlockHTMLBatch,
  clearWorkspaceCache,
  setPageBlockOrder,
} from "@/lib/keydb";
import { type Node, type NewNode, nodeRecordId } from "./schema";
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

/**
 * Extract FIRST heading from rendered HTML for TOC metadata
 * Only extracts the first h1/h2/h3 - that's all we need to display in TOC
 */
function extractFirstHeadingFromHTML(html: string): {
  level: number;
  text: string;
} | null {
  const headingRegex = /<h([1-3])(?:\s[^>]*)?>([^<]+)<\/h\1>/i;
  const match = headingRegex.exec(html);

  if (!match) return null;

  const level = parseInt(match[1]);
  const text = match[2]
    .replace(/<[^>]+>/g, "") // Strip any nested HTML
    .trim();

  return text ? { level, text } : null;
}

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
    { ws: workspaceId, pageName }
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
      workspace: workspaceId,
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
    ws: workspaceId,
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
    const initMsg = "Starting Logseq graph ingestion...";
    buildLog.push(initMsg);
    console.log(`[Ingestion] ${initMsg}`);

    // Get workspace to access slug for reference links
    // Pass workspaceId directly - it should already be in the correct format
    const workspace = await queryOne<{ id: string; slug: string }>(
      "SELECT id, slug FROM workspaces WHERE id = $ws",
      { ws: workspaceId }
    );

    if (!workspace) {
      console.error(`[Ingestion] ERROR: Workspace not found for ID: ${workspaceId}`);
      return {
        success: false,
        error: "Workspace not found",
        buildLog,
      };
    }
    console.log(`[Ingestion] Workspace found: ${workspace.slug}`);

    const workspaceSlug = workspace.slug;

    // Step 1: Parse markdown files for block structure
    const parseMsg = "Parsing markdown files for block structure...";
    buildLog.push(parseMsg);
    console.log(`[Ingestion] ${parseMsg}`);
    const pagesDir = path.join(repoPath, "pages");
    const journalsDir = path.join(repoPath, "journals");

    const [regularPages, journalPages] = await Promise.all([
      parseLogseqDirectory(pagesDir),
      parseLogseqDirectory(journalsDir).catch(() => []),
    ]);

    const markdownPages = [...regularPages, ...journalPages];
    const foundMsg = `Found ${regularPages.length} pages and ${journalPages.length} journals`;
    buildLog.push(foundMsg);
    console.log(`[Ingestion] ${foundMsg}`);

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
    const clearMsg = "Clearing existing nodes and cache...";
    buildLog.push(clearMsg);
    console.log(`[Ingestion] ${clearMsg}`);
    await deleteAllNodes(workspaceId);
    console.log(`[Ingestion] Cache cleared`);

    // Step 5: Create page nodes AND block nodes
    const createMsg = "Creating page and block nodes...";
    buildLog.push(createMsg);
    console.log(`[Ingestion] ${createMsg}`);
    const allNodeData: Array<{ uuid: string; data: Record<string, unknown> }> =
      [];
    const allBlockHTML: Array<{ uuid: string; html: string }> = [];
    const pageBlockOrders: Map<string, string[]> = new Map();
    let totalBlocks = 0;
    let pageCount = 0;

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
          `Warning: No HTML found for ${mdPage.pageName}, creating page without rendered content`
        );
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

      // Page node data - set parent to null which becomes NONE in SurrealDB
      // Use HTML page data if available, otherwise use markdown page name
      const pageTitle = htmlPage
        ? (htmlPage.title || "").trim() || mdPage.pageName
        : mdPage.pageName;
      allNodeData.push({
        uuid: pageUuid,
        data: {
          workspace: workspaceId,
          parent: null, // null converts to NONE in SurrealDB for optional fields
          page_name: mdPage.pageName,
          slug,
          title: pageTitle,
          order: 0,
          metadata: {
            tags: htmlPage?.metadata?.tags || [],
            properties: {
              ...mdPage.properties,
              ...(htmlPage?.metadata?.properties || {}),
            },
          },
        },
      });
      pageCount++;
      console.log(`[Ingestion] Created page node: ${mdPage.pageName} (uuid: ${pageUuid})`);

      if (mdPage.blocks.length === 0) {
        const noBlocksMsg = `Page ${mdPage.pageName} has no blocks (property-only page)`;
        buildLog.push(noBlocksMsg);
        console.log(`[Ingestion] ${noBlocksMsg}`);
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

        // Extract first heading from HTML for TOC metadata
        const heading = extractFirstHeadingFromHTML(blockHTML);

        // Block node data - no title for blocks, only pages have titles
        // Only populate metadata.heading for nodes that will display in TOC (those with headings)
        const metadata: Record<string, unknown> = {
          properties: block.properties,
        };
        if (heading) {
          metadata.heading = heading;
        }

        allNodeData.push({
          uuid: block.uuid,
          data: {
            workspace: workspaceId,
            parent: `nodes:${block.parentUuid || pageUuid}`,
            page_name: mdPage.pageName,
            slug,
            order: block.order,
            metadata,
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

    // Deduplicate nodes by UUID (in case of parsing duplicates)
    const seenUuids = new Set<string>();
    const uniqueNodeData = allNodeData.filter(({ uuid }) => {
      if (seenUuids.has(uuid)) {
        console.log(`[Ingestion] Skipping duplicate node: ${uuid}`);
        return false;
      }
      seenUuids.add(uuid);
      return true;
    });

    const insertMsg = `Inserting ${uniqueNodeData.length} nodes (${pageCount} pages and ${totalBlocks} blocks)...`;
    buildLog.push(insertMsg);
    console.log(`[Ingestion] ${insertMsg}`);

    // Batch insert nodes into SurrealDB
    const BATCH_SIZE = 500;
    for (let i = 0; i < uniqueNodeData.length; i += BATCH_SIZE) {
      const batch = uniqueNodeData.slice(i, i + BATCH_SIZE);
      for (const { uuid, data } of batch) {
        try {
          await createWithId(`nodes:${uuid}`, data);
        } catch (err) {
          console.error(`[Ingestion] ERROR creating node ${uuid}:`, err instanceof Error ? err.message : String(err));
          throw err;
        }
      }
      const batchMsg = `  Inserted node batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(uniqueNodeData.length / BATCH_SIZE)}`;
      buildLog.push(batchMsg);
      console.log(`[Ingestion] ${batchMsg}`);
    }
    console.log(`[Ingestion] All ${uniqueNodeData.length} nodes inserted into SurrealDB`);

    // Batch insert HTML into KeyDB
    const cacheMsg = `Caching ${allBlockHTML.length} block HTMLs in KeyDB...`;
    buildLog.push(cacheMsg);
    console.log(`[Ingestion] ${cacheMsg}`);
    await setBlockHTMLBatch(workspaceId, allBlockHTML);
    console.log(`[Ingestion] Block HTMLs cached in KeyDB`);

    // Store page block orders
    console.log(`[Ingestion] Storing page block orders for ${pageBlockOrders.size} pages...`);
    for (const [pageName, uuids] of pageBlockOrders) {
      await setPageBlockOrder(workspaceId, pageName, uuids);
      console.log(`[Ingestion]   Page block order stored: ${pageName} (${uuids.length} blocks)`);
    }

    const completeMsg = "Ingestion complete!";
    buildLog.push(completeMsg);
    console.log(`[Ingestion] ✓ ${completeMsg}`);

    return {
      success: true,
      pageCount: pageCount,
      blockCount: totalBlocks,
      buildLog,
    };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : "Unknown ingestion error";
    buildLog.push(`ERROR: ${errorMsg}`);
    console.error(`[Ingestion] ✗ FAILED: ${errorMsg}`, error);

    return {
      success: false,
      error: errorMsg,
      buildLog,
    };
  }
}
