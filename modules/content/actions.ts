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
import { parseLogseqDirectory, flattenBlocks } from "../logseq/markdown-parser";
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
 * Returns plain text (all HTML tags stripped)
 */
function extractFirstHeadingFromHTML(html: string): {
  level: number;
  text: string;
} | null {
  // Match h1/h2/h3 tags - capture everything inside including nested HTML
  const headingRegex = /<h([1-3])(?:\s[^>]*)?>(.+?)<\/h\1>/i;
  const match = headingRegex.exec(html);

  if (!match) return null;

  const level = parseInt(match[1]);
  // Strip ALL HTML tags to get plain text
  let text = match[2]
    .replace(/<[^>]+>/g, "") // Remove ALL HTML tags (links, bold, italic, etc)
    .trim();

  // Clean up any remaining markdown syntax
  text = text
    .replace(/^#+\s*/, "") // Remove leading # markdown
    .replace(/\[\[([^\]]+)\]\]/g, "$1") // Convert [[Link]] to Link
    .replace(/\{\{([^}]+)\}\}/g, "$1") // Convert {{macro}} to macro
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

  // Generate stable UUID (32-char hex, no hyphens)
  const pageUuidSeed = `${workspaceId}::${pageName}`;
  const pageUuidHash = crypto
    .createHash("sha256")
    .update(pageUuidSeed)
    .digest("hex");
  const pageUuid = pageUuidHash.slice(0, 32);

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
      console.error(
        `[Ingestion] ERROR: Workspace not found for ID: ${workspaceId}`
      );
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

      // Generate stable page UUID (32-char hex, no hyphens)
      const pageUuidSeed = `${workspaceId}::${mdPage.pageName}`;
      const pageUuidHash = crypto
        .createHash("sha256")
        .update(pageUuidSeed)
        .digest("hex");
      const pageUuid = pageUuidHash.slice(0, 32);

      // Page node data - set parent to null which becomes NONE in SurrealDB
      // Use HTML page data if available, otherwise use markdown page name
      const pageTitle = htmlPage
        ? (htmlPage.title || "").trim() || mdPage.pageName
        : mdPage.pageName;

      // Pages don't have HTML stored in KeyDB, so no heading metadata needed
      // Headings are only extracted for blocks during HTML processing
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

        // Block node data - Extract heading from final HTML for TOC
        // This is the cleanest HTML after all processing
        const metadata: Record<string, unknown> = {};
        const heading = extractFirstHeadingFromHTML(blockHTML);
        if (heading) {
          metadata.heading = heading;
          console.log(
            `[Ingestion] Block heading extracted: "${heading.text}" (h${heading.level})`
          );
        } else {
          // Debug: log first 200 chars of HTML to see what we're getting
          const htmlPreview = blockHTML.substring(0, 200).replace(/\n/g, " ");
          console.log(
            `[Ingestion] Block has no h1/h2/h3 heading. HTML preview: ${htmlPreview}`
          );
        }

        // Make block UUID globally unique by including workspace and page
        const globalBlockUuid = crypto
          .createHash("sha256")
          .update(`${workspaceId}::${mdPage.pageName}::${block.uuid}`)
          .digest("hex")
          .slice(0, 32); // Use first 32 chars of hash for UUID

        // Make parent UUID globally unique if it exists
        const globalParentUuid = block.parentUuid
          ? crypto
              .createHash("sha256")
              .update(`${workspaceId}::${mdPage.pageName}::${block.parentUuid}`)
              .digest("hex")
              .slice(0, 32)
          : pageUuid;

        allNodeData.push({
          uuid: globalBlockUuid,
          data: {
            workspace: workspaceId,
            parent: globalParentUuid ? `nodes:${globalParentUuid}` : null,
            page_name: mdPage.pageName,
            slug,
            order: block.order,
            metadata,
          },
        });

        // Store HTML for KeyDB
        allBlockHTML.push({
          uuid: globalBlockUuid,
          html: blockHTML.trim(),
        });
        console.log(
          `[Ingestion] Block HTML queued: ${globalBlockUuid} (${
            blockHTML.trim().length
          } bytes)`
        );

        blockUuidsInOrder.push(globalBlockUuid);
        console.log(
          `[Ingestion] Created block node: ${globalBlockUuid} (parent: ${globalParentUuid})`
        );
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

    // Deduplicate HTML by UUID (keep last occurrence, same as nodes)
    const htmlByUuid = new Map<string, string>();
    for (const block of allBlockHTML) {
      htmlByUuid.set(block.uuid, block.html);
    }
    const uniqueBlockHTML = Array.from(htmlByUuid.entries()).map(
      ([uuid, html]) => ({
        uuid,
        html,
      })
    );
    console.log(
      `[Ingestion] Deduplicating HTML: ${allBlockHTML.length} → ${uniqueBlockHTML.length} unique blocks`
    );

    const insertMsg = `Inserting ${uniqueNodeData.length} nodes (${pageCount} pages and ${totalBlocks} blocks)...`;
    buildLog.push(insertMsg);
    console.log(`[Ingestion] ${insertMsg}`);

    // Batch insert nodes into SurrealDB
    const BATCH_SIZE = 500;
    const relateEdges: Array<{ from: string; to: string }> = [];

    for (let i = 0; i < uniqueNodeData.length; i += BATCH_SIZE) {
      const batch = uniqueNodeData.slice(i, i + BATCH_SIZE);
      for (const { uuid, data } of batch) {
        try {
          await createWithId(`nodes:${uuid}`, data);

          // Collect RELATE edges for later creation
          // Skip null parents (page nodes)
          if (data.parent && typeof data.parent === "string") {
            // parent format: "nodes:uuid"
            const parentUuid = data.parent.replace("nodes:", "");
            relateEdges.push({
              from: uuid, // child node uuid
              to: parentUuid, // parent node uuid
            });
          }
        } catch (err) {
          console.error(
            `[Ingestion] ERROR creating node ${uuid}:`,
            err instanceof Error ? err.message : String(err)
          );
          throw err;
        }
      }
      const batchMsg = `  Inserted node batch ${
        Math.floor(i / BATCH_SIZE) + 1
      }/${Math.ceil(uniqueNodeData.length / BATCH_SIZE)}`;
      buildLog.push(batchMsg);
      console.log(`[Ingestion] ${batchMsg}`);
    }
    console.log(
      `[Ingestion] All ${uniqueNodeData.length} nodes inserted into SurrealDB`
    );

    // Create RELATE edges for graph traversal
    if (relateEdges.length > 0) {
      console.log(
        `[Ingestion] Creating ${relateEdges.length} parent-child relationships via RELATE...`
      );
      const REL_BATCH_SIZE = 1000;
      for (let i = 0; i < relateEdges.length; i += REL_BATCH_SIZE) {
        const batch = relateEdges.slice(i, i + REL_BATCH_SIZE);
        for (const edge of batch) {
          // Create RELATE: child--[parent]-->parent
          // Backticks only around UUID part, not the table name
          try {
            await query(
              `RELATE nodes:\`${edge.from}\`->parent->nodes:\`${edge.to}\``
            );
          } catch (err) {
            // Log but don't fail - some RELATEs might already exist
            console.log(
              `[Ingestion] RELATE creation note: ${
                err instanceof Error ? err.message : String(err)
              }`
            );
          }
        }
        const relMsg = `  Created relate batch ${
          Math.floor(i / REL_BATCH_SIZE) + 1
        }/${Math.ceil(relateEdges.length / REL_BATCH_SIZE)}`;
        buildLog.push(relMsg);
        console.log(`[Ingestion] ${relMsg}`);
      }
      console.log(
        `[Ingestion] All ${relateEdges.length} relationships created via RELATE`
      );
    }

    // Batch insert HTML into KeyDB
    console.log(
      `[Ingestion] Total allBlockHTML collected: ${allBlockHTML.length} blocks`
    );
    const cacheMsg = `Caching ${uniqueBlockHTML.length} block HTMLs in KeyDB...`;
    buildLog.push(cacheMsg);
    console.log(`[Ingestion] ${cacheMsg}`);
    if (uniqueBlockHTML.length > 0) {
      const totalHTMLSize = uniqueBlockHTML.reduce(
        (sum, b) => sum + b.html.length,
        0
      );
      console.log(
        `[Ingestion] HTML stats: ${uniqueBlockHTML.length} blocks, ~${totalHTMLSize} bytes total`
      );
      try {
        await setBlockHTMLBatch(workspaceId, uniqueBlockHTML);
        console.log(`[Ingestion] ✓ Block HTMLs cached in KeyDB`);
      } catch (err) {
        console.error(
          `[Ingestion] ✗ FAILED to cache HTML: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
        throw err;
      }
    } else {
      console.warn(
        `[Ingestion] ⚠️  No block HTMLs to cache! (allBlockHTML.length=${allBlockHTML.length})`
      );
    }

    // Store page block orders
    console.log(
      `[Ingestion] Storing page block orders for ${pageBlockOrders.size} pages...`
    );
    for (const [pageName, uuids] of pageBlockOrders) {
      await setPageBlockOrder(workspaceId, pageName, uuids);
      console.log(
        `[Ingestion]   Page block order stored: ${pageName} (${uuids.length} blocks)`
      );
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
