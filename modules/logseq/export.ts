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
 * Configures which pages to include and how to process them
 * Inspired by dimfeld/website but simplified for multi-tenant use case
 */
const EXPORT_SCRIPT = `// Draehi export script for Logseq graphs
// Include all pages by default (users can filter on the frontend)

// Set page metadata for proper rendering
page.include = true;
page.allow_embedding = AllowEmbed::Yes;

// Set URL base for internal links (will be replaced with workspace slug during parsing)
page.url_base = "";

// Handle journal pages specially
if page.is_journal {
  page.top_header_level = 3;

  // Process journal content blocks
  each_block(9999, |block, depth| {
    if depth == 0 {
      block.view_type = ViewType::Document;
    }
  });
}

// Process all blocks for HTML attributes
each_block(9999, |block, depth| {
  // Support custom HTML wrapper elements via block attributes
  let wrap_el = block.get_attr_first("wrap-el");
  if !wrap_el.is_empty() {
    block.wrapper_element = wrap_el;
  }

  // Support custom content elements
  let content_el = block.get_attr_first("content-el");
  if !content_el.is_empty() {
    block.content_element = content_el;
  }

  // Support custom CSS classes
  let classes = block.get_attr("wrap-class");
  if !classes.is_empty() {
    block.classlist = classes;
  }
});`;

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

    // Create TOML config file with proper settings
    // Inspired by dimfeld/website configuration
    const configPath = path.join(repoPath, ".draehi-export-config.toml");
    const config = `# Draehi export configuration for Logseq graph processing
# Inspired by export-logseq-notes best practices

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

# When performing syntax highlighting, prefix the classes
highlight_class_prefix = "sy-"

##### Tags Output ####

# Use this attribute to gather tags for a page
tags_attr = "tags"

# Use all hashtags in a page when gathering tags
use_all_hashtags = true

# Omit these attributes from tag collection
omit_attributes = [
  "tags",
  "Tags",
  "public",
  "Public",
  "draft",
  "Draft"
]

##### Link Handling #####

# Filter blocks that only contain links/tags with no content
filter_link_only_blocks = true

# When rendering links, use this URL prefix
base_url = "/notes"

# HTML classes for various elements (Tailwind CSS compatible)
class_bold = "font-bold"
class_italic = "italic"
class_strikethrough = "line-through"
class_highlight = "bg-yellow-200"
class_blockquote = "border-l-4 border-gray-300 pl-4"
class_hr = "border-gray-300"
class_block_embed = "border border-gray-200 rounded p-4 my-4"
class_page_embed_container = "page-embed"
class_page_embed_title = "font-semibold text-lg mb-2"
class_page_embed_content = "pl-4"
class_attr_name = "font-medium text-gray-800"
class_attr_value = "text-gray-600"

# Convert -- to em dash
convert_emdash = true

# Promote headers (h1 -> h2, h2 -> h3, etc.)
promote_headers = true
top_header_level = 2

# Include all page embeds
include_all_page_embeds = true`;

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
