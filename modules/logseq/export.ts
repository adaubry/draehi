"use server";

import path from "path";
import fs from "fs/promises";
import { findBinary, execWithPath } from "@/lib/shell";

/**
 * Template for export-logseq-notes output
 * This defines how each page is rendered
 * Inspired by dimfeld/website implementation
 */
const EXPORT_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>{{title}}</title>
  <meta name="created" content="{{format_time "%Y-%m-%d" created_time}}">
  <meta name="updated" content="{{format_time "%Y-%m-%d" edited_time}}">
  {{#if tags}}
  <meta name="tags" content="{{join tags ", "}}">
  {{/if}}
</head>
<body>
{{{body}}}
</body>
</html>`;

/**
 * Rhai script for processing Logseq pages
 * Minimal configuration to include all pages
 */
const EXPORT_SCRIPT = `// Draehi export script for Logseq graphs
// Include all pages (simplified to avoid filtering)

page.include = true;
page.allow_embedding = AllowEmbed::Yes;
page.url_base = "";
`;

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

    // Ensure journals directory exists (export-logseq-notes requires it)
    const journalsDir = path.join(repoPath, "journals");
    await fs.mkdir(journalsDir, { recursive: true });

    // Write template file
    const templatePath = path.join(repoPath, ".draehi-template.tmpl");
    await fs.writeFile(templatePath, EXPORT_TEMPLATE);

    // Write Rhai script
    const scriptPath = path.join(repoPath, ".draehi-script.rhai");
    await fs.writeFile(scriptPath, EXPORT_SCRIPT);

    // Create TOML config file - minimal configuration
    const configPath = path.join(repoPath, ".draehi-export-config.toml");
    const config = `# Draehi export configuration for Logseq graph processing

# The Logseq directory to process
data = "${repoPath}"

# Specify this is a Logseq graph
product = "logseq"

# Write the rendered pages into this directory
output = "${outputDir}"

# Processing script (Rhai)
script = "${scriptPath}"

# Template for output formatting
template = "${templatePath}"

# Use this file extension on the rendered pages
extension = "html"
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

    // Cleanup config, script, and template files
    await Promise.allSettled([
      fs.unlink(configPath),
      fs.unlink(scriptPath),
      fs.unlink(templatePath),
    ]);

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
