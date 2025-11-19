"use server";

import { db } from "@/lib/db";
import { nodes, type NewNode, type Node } from "./schema";
import { extractNamespaceAndSlug } from "@/lib/utils";
import { eq, and } from "drizzle-orm";
import { exportLogseqNotes } from "../logseq/export";
import { parseLogseqOutput } from "../logseq/parse";
import { parseLogseqDirectory, flattenBlocks } from "../logseq/markdown-parser";
import { processLogseqReferences } from "../logseq/process-references";
import { marked } from "marked";
import path from "path";
import { randomUUID } from "crypto";

// Internal only - called during git sync/deployment
export async function upsertNode(
  workspaceId: number,
  pageName: string,
  data: {
    title: string;
    html?: string;
    content?: string;
    metadata?: NewNode["metadata"];
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
      .where(eq(nodes.uuid, existing.uuid))
      .returning();

    return { node };
  } else {
    // Insert with stable UUID based on workspaceId + pageName
    const pageUuidSeed = `${workspaceId}::${pageName}`;
    const pageUuidHash = require('crypto').createHash('sha256').update(pageUuidSeed).digest('hex');
    const pageUuid = `${pageUuidHash.slice(0, 8)}-${pageUuidHash.slice(8, 12)}-${pageUuidHash.slice(12, 16)}-${pageUuidHash.slice(16, 20)}-${pageUuidHash.slice(20, 32)}`;

    const [node] = await db
      .insert(nodes)
      .values({
        uuid: pageUuid,
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

export async function deleteNode(uuid: string) {
  await db.delete(nodes).where(eq(nodes.uuid, uuid));
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

    // Get workspace to access slug for reference links
    const workspace = await db.query.workspaces.findFirst({
      where: (workspaces, { eq }) => eq(workspaces.id, workspaceId),
    });

    if (!workspace) {
      return {
        success: false,
        error: "Workspace not found",
        buildLog,
      };
    }

    const workspaceSlug = workspace.slug;

    // Step 1: Parse markdown files for block structure (pages + journals)
    buildLog.push("Parsing markdown files for block structure...");
    const pagesDir = path.join(repoPath, "pages");
    const journalsDir = path.join(repoPath, "journals");

    const [regularPages, journalPages] = await Promise.all([
      parseLogseqDirectory(pagesDir),
      parseLogseqDirectory(journalsDir).catch(() => []), // journals/ might not exist
    ]);

    const markdownPages = [...regularPages, ...journalPages];
    buildLog.push(`Found ${regularPages.length} pages and ${journalPages.length} journals`);

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

    for (const mdPage of markdownPages) {
      // Find corresponding HTML page for metadata
      // Normalize names to match export tool's transformation:
      // 1. URL decode (e.g., %3F → ?)
      // 2. Remove special chars like ? ! / \ : * ( ) , .
      // 3. Replace spaces and hyphens with underscores
      // 4. Collapse multiple underscores to single
      // 5. Lowercase
      let normalizedMdName = mdPage.pageName;
      try {
        normalizedMdName = decodeURIComponent(normalizedMdName);
      } catch {
        // If not valid URI component, use as-is
      }
      normalizedMdName = normalizedMdName
        .replace(/[?!\/\\:*"<>|(),.]/g, "") // Remove special chars including parens, commas, dots
        .replace(/[\s\-]+/g, "_") // Replace spaces/hyphens with underscore
        .replace(/_{2,}/g, "_") // Collapse multiple underscores (___  → _)
        .toLowerCase();

      let htmlPage = parseResult.pages.find((p) => p.name.toLowerCase() === normalizedMdName);

      // Fallback: fuzzy match if exact match fails
      // Export tool has inconsistent transformations (removes underscores in numbers like 07_09 → 0709)
      if (!htmlPage && normalizedMdName.includes("_")) {
        // Try matching by removing all underscores (handles cases like changelog_07_09 → changelog0709)
        const noUnderscores = normalizedMdName.replace(/_/g, "");
        const candidates = parseResult.pages.filter((p) => p.name.toLowerCase().replace(/_/g, "") === noUnderscores);

        // Only use fuzzy match if we get exactly 1 candidate (avoid false positives)
        if (candidates.length === 1) {
          htmlPage = candidates[0];
          buildLog.push(`Fuzzy matched: ${mdPage.pageName} → ${htmlPage.name}`);
        }
      }

      if (!htmlPage) {
        buildLog.push(`Warning: No HTML found for ${mdPage.pageName}, skipping`);
        continue;
      }

      const { namespace, slug, depth } = extractNamespaceAndSlug(mdPage.pageName);

      // Create page node (parentUuid=null, html=null)
      // Use stable UUID based on workspaceId + pageName for idempotency
      const pageUuidSeed = `${workspaceId}::${mdPage.pageName}`;
      const pageUuidHash = require('crypto').createHash('sha256').update(pageUuidSeed).digest('hex');
      const pageUuid = `${pageUuidHash.slice(0, 8)}-${pageUuidHash.slice(8, 12)}-${pageUuidHash.slice(12, 16)}-${pageUuidHash.slice(16, 20)}-${pageUuidHash.slice(20, 32)}`;

      const pageNode: NewNode = {
        uuid: pageUuid,
        workspaceId,
        parentUuid: null,
        order: 0,
        pageName: mdPage.pageName,
        slug,
        namespace,
        depth,
        title: htmlPage.title,
        html: null, // Pages don't have HTML
        metadata: {
          tags: htmlPage.metadata?.tags || [],
          properties: {
            ...mdPage.properties,
            ...htmlPage.metadata?.properties,
          },
        },
      };

      allNodes.push(pageNode);

      // Skip block processing if page has no blocks (property-only pages)
      if (mdPage.blocks.length === 0) {
        buildLog.push(`Page ${mdPage.pageName} has no blocks (property-only page)`);
        continue;
      }

      // Create block nodes with markdown-rendered HTML
      const flatBlocks = flattenBlocks(mdPage.blocks);
      totalBlocks += flatBlocks.length;

      for (const block of flatBlocks) {
        // Render markdown to HTML for this block
        let blockHTML = await marked.parse(block.content, {
          async: true,
          gfm: true,
        });

        // Process Logseq references ([[page]], ((uuid)), TODO markers)
        blockHTML = processLogseqReferences(
          blockHTML,
          workspaceSlug,
          mdPage.pageName
        );

        const blockNode: NewNode = {
          workspaceId,
          uuid: block.uuid,
          parentUuid: block.parentUuid || pageUuid, // Top-level blocks point to page; nested blocks point to parent block
          order: block.order,
          pageName: mdPage.pageName,
          slug,
          namespace,
          depth: 0, // Will be recalculated after parentUuid is set
          title: "", // Blocks don't have titles
          html: blockHTML.trim(),
          metadata: {
            properties: block.properties,
          },
        };

        allNodes.push(blockNode);
      }
    }

    buildLog.push(
      `Inserting ${allNodes.length} nodes (${markdownPages.length} pages and ${totalBlocks} blocks)...`
    );

    // Insert in batches to avoid PostgreSQL parameter limit (65534)
    // Each node has ~15 fields, so batch size of 1000 = ~15000 parameters
    const BATCH_SIZE = 1000;
    const insertedNodes: Node[] = [];

    for (let i = 0; i < allNodes.length; i += BATCH_SIZE) {
      const batch = allNodes.slice(i, i + BATCH_SIZE);
      const batchResult = await db.insert(nodes).values(batch).returning();
      insertedNodes.push(...batchResult);
      buildLog.push(`  Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allNodes.length / BATCH_SIZE)}`);
    }

    buildLog.push("Calculating block depths from parent relationships...");

    // Build map for parent-child relationships (parentUuid -> blockUuid)
    const parentUuidMap = new Map<string, string>(); // blockUuid -> parentUuid (for depth calc)
    const pageUuidMap = new Map<string, string>(); // pageName -> page uuid
    const blockByUuidMap = new Map<string, Node>(); // uuid -> node

    for (const node of insertedNodes) {
      blockByUuidMap.set(node.uuid, node);
      if (node.parentUuid === null) {
        // Page node
        pageUuidMap.set(node.pageName, node.uuid);
      } else {
        // Block node - record parent relationship
        parentUuidMap.set(node.uuid, node.parentUuid);
      }
    }

    buildLog.push("Recalculating block depths based on parent chain...");

    // Build set of page UUIDs
    const pageUuids = new Set<string>();
    for (const node of insertedNodes) {
      if (node.parentUuid === null) {
        pageUuids.add(node.uuid);
      }
    }

    // Calculate depths in-memory (no DB queries)
    const depthUpdatePromises: Promise<any>[] = [];
    for (const node of insertedNodes) {
      if (node.parentUuid !== null) {
        // Block node - calculate depth
        const depth = calculateBlockDepthInMemory(node.uuid, parentUuidMap, pageUuids);
        depthUpdatePromises.push(
          db.update(nodes).set({ depth }).where(eq(nodes.uuid, node.uuid))
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
  blockUuid: string,
  parentUuidMap: Map<string, string>,
  pageUuids: Set<string>
): number {
  const parentUuid = parentUuidMap.get(blockUuid);

  if (!parentUuid) return 0;

  // If parent is a page, depth is 0
  if (pageUuids.has(parentUuid)) return 0;

  // Parent is a block, add 1 to parent's depth
  return 1 + calculateBlockDepthInMemory(parentUuid, parentUuidMap, pageUuids);
}
