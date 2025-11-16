"use server";

import path from "path";
import fs from "fs/promises";
import { findBinary, execWithPath } from "@/lib/shell";

/**
 * Call export-logseq-notes Rust CLI to process Logseq graph
 * Outputs rendered HTML files to a directory
 * @param repoPath - Path to cloned Logseq repository
 * @returns Output directory path with rendered pages
 */
export async function exportLogseqNotes(
  repoPath: string
): Promise<{ success: boolean; outputDir?: string; error?: string }> {
  try {
    // Find export-logseq-notes binary in common locations
    const binaryPath = await findBinary("export-logseq-notes");
    if (!binaryPath) {
      return {
        success: false,
        error:
          "export-logseq-notes not found. Install with: ./scripts/install-rust-tools.sh",
      };
    }

    // Create output directory for rendered pages
    const outputDir = path.join(repoPath, ".draehi-output");
    await fs.mkdir(outputDir, { recursive: true });

    // Create minimal Rhai script that includes all pages
    const scriptPath = path.join(repoPath, ".draehi-script.rhai");
    const script = `
// Minimal script: include all pages without filtering
page.include = true;
page.allow_embedding = AllowEmbed::Yes;
    `;
    await fs.writeFile(scriptPath, script);

    // Create temp config file
    const configPath = path.join(repoPath, ".draehi-export-config.toml");
    const config = `
# Draehi export configuration for Logseq graph processing
data = "${repoPath}"
product = "logseq"
output = "${outputDir}"
script = "${scriptPath}"
extension = "html"

# Export all pages (no filtering)
filter_link_only_blocks = false
include_all_page_embeds = true
    `;

    await fs.writeFile(configPath, config);

    // Execute Rust tool with explicit binary path
    const { stdout, stderr } = await execWithPath(
      `"${binaryPath}" --config "${configPath}"`,
      {
        cwd: repoPath,
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large graphs
      }
    );

    // Cleanup config and script
    await fs.unlink(configPath).catch(() => {});
    await fs.unlink(scriptPath).catch(() => {});

    // Check if tool encountered errors
    if (stderr && stderr.toLowerCase().includes("error")) {
      return {
        success: false,
        error: stderr,
      };
    }

    // Verify output directory has files
    const files = await fs.readdir(outputDir);
    if (files.length === 0) {
      return {
        success: false,
        error: "No pages exported. Check if Logseq graph has pages directory.",
      };
    }

    return {
      success: true,
      outputDir,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Export failed",
    };
  }
}
