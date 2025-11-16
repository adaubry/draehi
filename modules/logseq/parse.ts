"use server";

import fs from "fs/promises";
import path from "path";
import type { LogseqPage } from "./types";
import type { NewNode } from "../content/schema";
import { uploadAsset } from "../storage/upload";

/**
 * Parse exported HTML files from export-logseq-notes directory
 * Reads all .html files and extracts page information
 */
export async function parseLogseqOutput(
  outputDir: string
): Promise<{ success: boolean; pages?: LogseqPage[]; error?: string }> {
  try {
    // Read all HTML files from output directory
    const files = await fs.readdir(outputDir);
    const htmlFiles = files.filter((f) => f.endsWith(".html"));

    if (htmlFiles.length === 0) {
      return {
        success: false,
        error: "No HTML files found in export output",
      };
    }

    // Process each HTML file
    const pages: LogseqPage[] = await Promise.all(
      htmlFiles.map(async (filename) => {
        const filePath = path.join(outputDir, filename);
        const html = await fs.readFile(filePath, "utf-8");

        // Extract page name from filename (remove .html extension)
        const pageName = filename.replace(/\.html$/, "");

        // Decode URL-encoded filename (e.g., "some%20page" -> "some page")
        const decodedName = decodeURIComponent(pageName);

        return {
          name: decodedName,
          title: decodedName,
          html,
          markdown: "", // We don't have markdown, only HTML
          metadata: {
            tags: [], // Could extract from HTML if needed
            properties: {},
          },
          isJournal: isJournalPage(decodedName),
          journalDate: extractJournalDate(decodedName),
        };
      })
    );

    return {
      success: true,
      pages,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Parse failed",
    };
  }
}

/**
 * Convert LogseqPage to NewNode for database insertion
 */
export async function logseqPageToNode(
  page: LogseqPage,
  workspaceId: number,
  repoPath: string
): Promise<NewNode> {
  const { namespace, slug, depth } = parsePageName(page.name);

  // Process HTML to upload assets and replace refs
  const html = await processAssets(page.html, workspaceId, repoPath);

  return {
    workspaceId,
    pageName: page.name,
    slug,
    namespace,
    depth,
    title: page.title,
    html,
    content: page.markdown,
    metadata: page.metadata,
    isJournal: page.isJournal,
    journalDate: page.journalDate,
  };
}

/**
 * Extract namespace, slug, and depth from page name
 * Example: "guides/setup/intro" → { namespace: "guides/setup", slug: "intro", depth: 2 }
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
 * Detect journal pages (format: YYYY_MM_DD or similar)
 */
function isJournalPage(pageName: string): boolean {
  // Match patterns like: 2024_01_15, 2024-01-15, Jan 15th, 2024
  return /^\d{4}[_-]\d{2}[_-]\d{2}$/.test(pageName);
}

/**
 * Extract journal date in YYYY-MM-DD format
 */
function extractJournalDate(pageName: string): string | undefined {
  const match = pageName.match(/^(\d{4})[_-](\d{2})[_-](\d{2})$/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  return undefined;
}

/**
 * Process HTML to upload assets and replace local paths with S3 URLs
 */
async function processAssets(
  html: string,
  workspaceId: number,
  repoPath: string
): Promise<string> {
  // Match asset references: ../assets/image.png, ./image.png, etc.
  const assetRegex = /(?:src|href)="([^"]*(?:assets|attachments)[^"]*)"/gi;

  let processedHtml = html;
  const matches = html.matchAll(assetRegex);

  for (const match of matches) {
    const assetPath = match[1];

    // Skip external URLs
    if (assetPath.startsWith("http")) continue;

    // Upload asset to S3
    const result = await uploadAsset(workspaceId, repoPath, assetPath);

    if (result.success && result.url) {
      // Replace local path with S3 URL
      processedHtml = processedHtml.replace(assetPath, result.url);
    }
  }

  return processedHtml;
}
