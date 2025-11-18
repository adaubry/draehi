import fs from "fs/promises";
import path from "path";

export type LogseqBlock = {
  uuid: string | null; // Block UUID from id:: property
  content: string; // Block markdown content
  indent: number; // Indentation level (0 = top-level)
  order: number; // Position among siblings
  parentUuid: string | null; // Parent block UUID
  properties: Record<string, string>; // Block properties
  children: LogseqBlock[]; // Nested child blocks
};

export type LogseqPageData = {
  pageName: string;
  blocks: LogseqBlock[];
  properties: Record<string, string>;
};

/**
 * Parse a Logseq markdown file to extract blocks with UUIDs and hierarchy
 */
export async function parseLogseqMarkdown(
  filePath: string
): Promise<LogseqPageData> {
  const content = await fs.readFile(filePath, "utf-8");
  const lines = content.split("\n");

  const pageName = path.basename(filePath, ".md");
  const pageProperties: Record<string, string> = {};
  const blocks: LogseqBlock[] = [];

  let currentBlock: Partial<LogseqBlock> | null = null;
  let blockStack: Array<{ block: LogseqBlock; indent: number }> = [];
  let order = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip empty lines
    if (!line.trim()) continue;

    // Check if this is a property line (key:: value)
    const propertyMatch = line.match(/^(\s*)([a-zA-Z0-9-]+)::\s*(.+)$/);
    if (propertyMatch) {
      const indent = propertyMatch[1].length;
      const key = propertyMatch[2];
      const value = propertyMatch[3].trim();

      // Top-level properties belong to the page
      if (indent === 0 && !currentBlock) {
        pageProperties[key] = value;
        continue;
      }

      // Block-level properties
      if (currentBlock) {
        currentBlock.properties = currentBlock.properties || {};
        currentBlock.properties[key] = value;

        // Special handling for id:: property (block UUID)
        if (key === "id") {
          currentBlock.uuid = value;
        }
        continue;
      }
    }

    // Check if this is a block line (starts with - or \t-)
    const blockMatch = line.match(/^(\s*)-\s+(.*)$/);
    if (blockMatch) {
      // Finalize previous block if exists
      if (currentBlock && currentBlock.content !== undefined) {
        const completedBlock = finalizeBlock(currentBlock);
        addBlockToHierarchy(blocks, blockStack, completedBlock);
        order++;
      }

      // Calculate indent: tabs count as 1 each, 2 spaces = 1 indent
      const whitespace = blockMatch[1];
      const tabCount = (whitespace.match(/\t/g) || []).length;
      const spaceCount = (whitespace.match(/ /g) || []).length;
      const indent = tabCount + Math.floor(spaceCount / 2);
      const content = blockMatch[2];

      // Start a new block
      currentBlock = {
        uuid: null,
        content,
        indent,
        order,
        parentUuid: null,
        properties: {},
        children: [],
      };

      continue;
    }

    // Continuation of current block content (multi-line blocks)
    if (currentBlock && line.trim()) {
      currentBlock.content += "\n" + line.trimStart();
    }
  }

  // Finalize last block
  if (currentBlock && currentBlock.content !== undefined) {
    const completedBlock = finalizeBlock(currentBlock);
    addBlockToHierarchy(blocks, blockStack, completedBlock);
  }

  return {
    pageName,
    blocks,
    properties: pageProperties,
  };
}

function finalizeBlock(partial: Partial<LogseqBlock>): LogseqBlock {
  return {
    uuid: partial.uuid || null,
    content: partial.content || "",
    indent: partial.indent || 0,
    order: partial.order || 0,
    parentUuid: partial.parentUuid || null,
    properties: partial.properties || {},
    children: partial.children || [],
  };
}

function addBlockToHierarchy(
  rootBlocks: LogseqBlock[],
  stack: Array<{ block: LogseqBlock; indent: number }>,
  newBlock: LogseqBlock
) {
  // Remove blocks from stack that are at same or higher indent level
  while (stack.length > 0 && stack[stack.length - 1].indent >= newBlock.indent) {
    stack.pop();
  }

  if (stack.length === 0) {
    // Top-level block
    rootBlocks.push(newBlock);
  } else {
    // Child block - add to parent
    const parent = stack[stack.length - 1].block;
    newBlock.parentUuid = parent.uuid;
    newBlock.order = parent.children.length; // Order within siblings
    parent.children.push(newBlock);
  }

  // Add to stack for potential children
  stack.push({ block: newBlock, indent: newBlock.indent });
}

/**
 * Parse all markdown files in a Logseq pages directory
 */
export async function parseLogseqDirectory(
  pagesDir: string
): Promise<LogseqPageData[]> {
  const files = await fs.readdir(pagesDir);
  const mdFiles = files.filter((f) => f.endsWith(".md"));

  const results: LogseqPageData[] = [];

  for (const file of mdFiles) {
    const filePath = path.join(pagesDir, file);
    try {
      const pageData = await parseLogseqMarkdown(filePath);
      results.push(pageData);
    } catch (error) {
      console.error(`Error parsing ${file}:`, error);
      // Continue with other files
    }
  }

  return results;
}

/**
 * Flatten block tree into array for database insertion
 */
export function flattenBlocks(blocks: LogseqBlock[]): LogseqBlock[] {
  const result: LogseqBlock[] = [];

  function traverse(block: LogseqBlock) {
    result.push(block);
    for (const child of block.children) {
      traverse(child);
    }
  }

  for (const block of blocks) {
    traverse(block);
  }

  return result;
}
