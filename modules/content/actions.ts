"use server";

import { db } from "@/lib/db";
import { nodes, type NewNode } from "./schema";
import { extractNamespaceAndSlug } from "@/lib/utils";
import { eq, and } from "drizzle-orm";
import { exportLogseqNotes } from "../logseq/export";
import { parseLogseqOutput, logseqPageToNode } from "../logseq/parse";

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
 * Called during deployment to process and store all pages
 */
export async function ingestLogseqGraph(
  workspaceId: number,
  repoPath: string
): Promise<{
  success: boolean;
  pageCount?: number;
  error?: string;
  buildLog?: string[];
}> {
  const buildLog: string[] = [];

  try {
    buildLog.push("Starting Logseq graph ingestion...");

    // Step 1: Export with Rust tool
    buildLog.push("Calling export-logseq-notes...");
    const exportResult = await exportLogseqNotes(repoPath);

    if (!exportResult.success || !exportResult.outputDir) {
      return {
        success: false,
        error: exportResult.error || "Export failed",
        buildLog,
      };
    }

    buildLog.push("Export successful, parsing HTML files...");

    // Step 2: Parse HTML files from output directory
    const parseResult = await parseLogseqOutput(exportResult.outputDir);

    if (!parseResult.success || !parseResult.pages) {
      return {
        success: false,
        error: parseResult.error || "Parse failed",
        buildLog,
      };
    }

    buildLog.push(`Found ${parseResult.pages.length} pages`);

    // Step 3: Delete existing nodes (idempotent)
    buildLog.push("Clearing existing nodes...");
    await deleteAllNodes(workspaceId);

    // Step 4: Convert pages to nodes and batch insert
    buildLog.push("Processing pages and uploading assets...");
    const nodePromises = parseResult.pages.map((page) =>
      logseqPageToNode(page, workspaceId, repoPath)
    );

    const newNodes = await Promise.all(nodePromises);

    buildLog.push(`Inserting ${newNodes.length} nodes into database...`);
    await db.insert(nodes).values(newNodes);

    buildLog.push("Ingestion complete!");

    return {
      success: true,
      pageCount: newNodes.length,
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
