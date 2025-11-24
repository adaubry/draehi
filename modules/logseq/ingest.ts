"use server";

import path from "path";
import { parseLogseqDirectory, flattenBlocks, type LogseqBlock } from "./markdown-parser";
import { exportLogseqNotes } from "./export";
import { parseLogseqOutput } from "./parse";
import type { NewNode } from "../content/schema";

export type BlockNode = {
  uuid: string; // Always present (generated if not in markdown)
  content: string;
  html: string;
  order: number;
  parentUuid: string | null;
  properties: Record<string, string>;
};

export type PageWithBlocks = {
  // Page data
  pageName: string;
  slug: string;
  namespace: string;
  depth: number;
  title: string;
  metadata: {
    tags?: string[];
    properties?: Record<string, unknown>;
  };

  // Blocks belonging to this page
  blocks: BlockNode[];
};

/**
 * Ingest a Logseq repository: parse markdown for structure + use Rust tool for HTML
 */
export async function ingestLogseqRepository(
  repoPath: string,
  workspaceId: string
): Promise<{ success: boolean; pages?: PageWithBlocks[]; error?: string }> {
  try {
    // Step 1: Parse markdown files to extract block structure with UUIDs
    const pagesDir = path.join(repoPath, "pages");
    const markdownPages = await parseLogseqDirectory(pagesDir);

    // Step 2: Run export-logseq-notes to get rendered HTML
    const exportResult = await exportLogseqNotes(repoPath);
    if (!exportResult.success || !exportResult.outputDir) {
      return {
        success: false,
        error: exportResult.error || "Export failed",
      };
    }

    // Step 3: Parse HTML output
    const htmlResult = await parseLogseqOutput(exportResult.outputDir);
    if (!htmlResult.success || !htmlResult.pages) {
      return {
        success: false,
        error: htmlResult.error || "HTML parsing failed",
      };
    }

    // Step 4: Combine markdown structure with HTML rendering
    const pages: PageWithBlocks[] = [];

    for (const mdPage of markdownPages) {
      // Find corresponding HTML page
      const htmlPage = htmlResult.pages.find((p) => p.name === mdPage.pageName);
      if (!htmlPage) {
        console.warn(`No HTML found for page: ${mdPage.pageName}`);
        continue;
      }

      // Parse page name into namespace components
      const { namespace, slug, depth } = parsePageName(mdPage.pageName);

      // Flatten block tree for database storage
      const flatBlocks = flattenBlocks(mdPage.blocks);

      // Create block nodes with HTML
      const blockNodes: BlockNode[] = flatBlocks.map((block, index) => ({
        uuid: block.uuid,
        content: block.content,
        html: renderBlockHtml(block, htmlPage.html), // Extract block HTML from page HTML
        order: index,
        parentUuid: block.parentUuid,
        properties: block.properties,
      }));

      pages.push({
        pageName: mdPage.pageName,
        slug,
        namespace,
        depth,
        title: htmlPage.title,
        metadata: {
          tags: htmlPage.metadata?.tags || [],
          properties: {
            ...mdPage.properties,
            ...htmlPage.metadata?.properties,
          },
        },
        blocks: blockNodes,
      });
    }

    return {
      success: true,
      pages,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Ingestion failed",
    };
  }
}

/**
 * Convert PageWithBlocks to database nodes (page + block nodes)
 */
export function pageWithBlocksToNodes(
  page: PageWithBlocks,
  workspaceId: string
): NewNode[] {
  const nodes: NewNode[] = [];

  const { createHash } = require("crypto");

  // Create page node (parentUuid=null, no HTML)
  // Generate stable UUID based on workspaceId + pageName
  const pageUuidSeed = `${workspaceId}::${page.pageName}`;
  const pageUuidHash = createHash('sha256').update(pageUuidSeed).digest('hex');
  const pageUuid = `${pageUuidHash.slice(0, 8)}-${pageUuidHash.slice(8, 12)}-${pageUuidHash.slice(12, 16)}-${pageUuidHash.slice(16, 20)}-${pageUuidHash.slice(20, 32)}`;

  const pageNode: NewNode = {
    uuid: pageUuid,
    workspaceId,
    parentUuid: null,
    order: 0,
    pageName: page.pageName,
    slug: page.slug,
    title: page.title,
    html: null, // Pages don't have HTML, only blocks do
    metadata: page.metadata,
  };

  nodes.push(pageNode);

  // Create block nodes (with HTML, parentUuid set)
  // For top-level blocks: parentUuid = pageUuid
  // For nested blocks: parentUuid = parent block UUID
  for (const block of page.blocks) {
    // Determine parentUuid: if block has no parent in markdown (indent=0), use pageUuid
    // Otherwise use the parentUuid from the parsed structure
    const blockParentUuid = block.parentUuid || pageUuid;

    const blockNode: NewNode = {
      workspaceId,
      uuid: block.uuid,
      parentUuid: blockParentUuid,
      order: block.order,
      pageName: page.pageName,
      slug: page.slug,
      title: "", // Blocks don't have titles
      html: block.html,
      metadata: {
        properties: block.properties,
      },
    };

    nodes.push(blockNode);
  }
  return nodes;

  return nodes;
}

/**
 * Extract namespace, slug, and depth from page name
 */
function parsePageName(pageName: string): {
  namespace: string;
  slug: string;
  depth: number;
} {
  const parts = pageName.split("/").filter(Boolean);

  if (parts.length === 0) {
    return { namespace: "", slug: "index", depth: 0 };
  }

  if (parts.length === 1) {
    return { namespace: "", slug: parts[0], depth: 0 };
  }

  const slug = parts[parts.length - 1];
  const namespace = parts.slice(0, -1).join("/");
  const depth = parts.length - 1;

  return { namespace, slug, depth };
}

/**
 * Calculate block depth from parent relationships
 */
function calculateBlockDepth(
  block: BlockNode,
  allBlocks: BlockNode[]
): number {
  if (!block.parentUuid) return 0;

  const parent = allBlocks.find((b) => b.uuid === block.parentUuid);
  if (!parent) return 0;

  return 1 + calculateBlockDepth(parent, allBlocks);
}

/**
 * Extract block HTML from full page HTML
 * For now, return the full content - we'll refine this later
 */
function renderBlockHtml(block: LogseqBlock, pageHtml: string): string {
  // Simple approach: use the block content as HTML for now
  // The Rust tool renders the full page; we'd need to parse the HTML DOM
  // to extract individual block HTML. For MVP, we can just wrap the content.

  // TODO: Parse the HTML to extract the specific block's rendered HTML
  // For now, return the markdown content (will be enhanced later)
  return `<p>${escapeHtml(block.content)}</p>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
