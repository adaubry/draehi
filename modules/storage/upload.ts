"use server";

import { uploadFile } from "./s3";
import fs from "fs/promises";
import path from "path";

/**
 * Upload assets (images, attachments) from Logseq graph to S3
 * @param workspaceId - Workspace ID for namespacing
 * @param repoPath - Local path to cloned repo
 * @param assetPath - Relative path to asset (e.g., "assets/image.png")
 * @returns Public URL of uploaded asset
 */
export async function uploadAsset(
  workspaceId: number,
  repoPath: string,
  assetPath: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Normalize asset path: ../assets/image.png -> assets/image.png
    // Logseq markdown files in pages/ reference ../assets/, but we resolve from repo root
    let normalizedPath = assetPath.replace(/^\.\.\//, "").replace(/^\.\//, "");

    const fullPath = path.join(repoPath, normalizedPath);

    // Read file
    const buffer = await fs.readFile(fullPath);

    // Determine content type
    const ext = path.extname(normalizedPath).toLowerCase();
    const contentType = getContentType(ext);

    // Generate S3 key with workspace namespace (use normalized path)
    const key = `workspaces/${workspaceId}/${normalizedPath}`;

    // Upload to S3
    return await uploadFile(key, buffer, contentType);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Asset upload failed",
    };
  }
}

function getContentType(ext: string): string {
  const types: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
  };
  return types[ext] || "application/octet-stream";
}
