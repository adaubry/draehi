"use server";

import { query, selectOne } from "@/lib/surreal";
import { getBlockHTML, getBlockHTMLBatch } from "@/lib/keydb";
import { type Node, type NodeWithHTML, nodeRecordId, normalizeNode } from "./schema";
import { cache } from "react";

// Tree node for hierarchical rendering
export interface TreeNode {
  node: Node;
  children: TreeNode[];
}

// Get node by UUID (without HTML)
export const getNodeByUuid = cache(
  async (uuid: string): Promise<Node | null> => {
    return await selectOne<Node>(nodeRecordId(uuid));
  }
);

// Get node by UUID with HTML from KeyDB
export const getNodeByUuidWithHTML = cache(
  async (uuid: string, workspaceId: string): Promise<NodeWithHTML | null> => {
    const node = await selectOne<Node>(nodeRecordId(uuid));
    if (!node) return null;

    const html = await getBlockHTML(workspaceId, uuid);
    return { ...node, html };
  }
);

export const getNodeByPath = cache(
  async (workspaceId: string, pathSegments: string[]): Promise<Node | null> => {
    console.log(`[Display] getNodeByPath: Looking for path [${pathSegments.join("/")}]`);

    // Build page_name from path segments: "guides/setup/intro"
    const pageName = pathSegments.join("/");
    console.log(`[Display] getNodeByPath: Looking up page_name: "${pageName}"`);

    // Query for PAGE node specifically (parent IS NONE) - not blocks
    const page = await query<Node>(
      "SELECT * FROM nodes WHERE workspace = $ws AND page_name = $pageName AND parent IS NONE LIMIT 1",
      { ws: workspaceId, pageName }
    );

    if (page.length === 0) {
      console.log(`[Display] getNodeByPath: No match found for [${pathSegments.join("/")}]`);
      return null;
    }

    const matchingPage = page[0];
    console.log(`[Display] getNodeByPath: Matched PAGE "${matchingPage.page_name}" to [${pathSegments.join("/")}]`);
    return normalizeNode(JSON.parse(JSON.stringify(matchingPage)));
  }
);

export const getAllNodes = cache(
  async (workspaceId: string): Promise<Node[]> => {
    // Only return page nodes for navigation (parent IS NONE)
    console.log(`[Display] getAllNodes: Fetching page nodes for workspace ${workspaceId}`);
    const nodes = await query<Node>(
      "SELECT * FROM nodes WHERE workspace = $ws AND parent IS NONE ORDER BY page_name",
      { ws: workspaceId }
    );
    console.log(`[Display] getAllNodes: Found ${nodes.length} page nodes`);
    // Serialize to plain objects for Server->Client boundary and normalize
    return nodes.map((n) => normalizeNode(JSON.parse(JSON.stringify(n))));
  }
);

export const getJournalNodes = cache(
  async (): Promise<Node[]> => {
    // Journal detection is removed - return empty array
    return [];
  }
);

export const getPageBlocks = cache(
  async (pageUuid: string): Promise<Node[]> => {
    const pageNodeId = nodeRecordId(pageUuid);
    console.log(`[Display] getPageBlocks: Fetching direct children for page ${pageUuid}`);

    const blocks = await query<Node>(
      `SELECT * FROM ${pageNodeId} <- parent ORDER BY order`
    );

    console.log(`[Display] getPageBlocks: Found ${blocks.length} direct children`);
    return blocks;
  }
);

export const getAllBlocksForPage = cache(
  async (workspaceId: string, pageName: string): Promise<Node[]> => {
    // Get all blocks for this page (excludes the page node itself)
    console.log(`[Display] getAllBlocksForPage: Fetching blocks for page "${pageName}" in workspace ${workspaceId}`);

    // Step 1: Get page node
    const pageResult = await query<Node>(
      "SELECT * FROM nodes WHERE workspace = $ws AND page_name = $pageName AND parent IS NONE LIMIT 1",
      { ws: workspaceId, pageName }
    );

    if (pageResult.length === 0) {
      console.log(`[Display] getAllBlocksForPage: Page not found for "${pageName}"`);
      return [];
    }

    const pageNode = pageResult[0];
    const pageNodeId = nodeRecordId(pageNode.uuid || getNodeUuidFromRecord(pageNode.id));

    // Step 2: Get all descendants via recursive application logic
    // SurrealDB doesn't support RECURSIVE modifier, so we traverse with BFS in app layer
    const allBlocks: Node[] = [];
    const queue = [pageNodeId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentNodeId = queue.shift()!;
      if (visited.has(currentNodeId)) continue;
      visited.add(currentNodeId);

      // Get direct children of current node
      const children = await query<Node>(
        `SELECT * FROM ${currentNodeId} <- parent ORDER BY order`
      );

      allBlocks.push(...children);

      // Add children to queue for further traversal
      for (const child of children) {
        const childId = nodeRecordId(child.uuid || getNodeUuidFromRecord(child.id));
        queue.push(childId);
      }
    }

    console.log(`[Display] getAllBlocksForPage: Found ${allBlocks.length} blocks for page "${pageName}"`);
    return allBlocks;
  }
);

// Get all blocks for a page with their HTML from KeyDB
export const getAllBlocksForPageWithHTML = cache(
  async (workspaceId: string, pageName: string): Promise<NodeWithHTML[]> => {
    console.log(`[Display] getAllBlocksForPageWithHTML: Fetching blocks with HTML for page "${pageName}"`);
    const blocks = await getAllBlocksForPage(workspaceId, pageName);

    if (blocks.length === 0) {
      console.log(`[Display] getAllBlocksForPageWithHTML: No blocks found for page "${pageName}"`);
      return [];
    }

    // Batch fetch HTML from KeyDB
    const uuids = blocks.map((b) => getNodeUuidFromRecord(b.id));
    console.log(`[Display] getAllBlocksForPageWithHTML: Batch fetching HTML for ${uuids.length} blocks from KeyDB`);
    const htmlMap = await getBlockHTMLBatch(workspaceId, uuids);
    const htmlCount = Array.from(htmlMap.values()).filter(h => h !== null).length;
    console.log(`[Display] getAllBlocksForPageWithHTML: Retrieved HTML for ${htmlCount}/${uuids.length} blocks`);

    return blocks.map((block) =>
      normalizeNode({
        ...block,
        html: htmlMap.get(getNodeUuidFromRecord(block.id)) || null,
      })
    );
  }
);

function getNodeUuidFromRecord(recordId: string | unknown): string {
  const idStr = String(recordId);
  return idStr.replace("nodes:", "");
}

export const getPageBacklinks = cache(
  async (pageUuid: string): Promise<Node[]> => {
    // TODO: Find all blocks that reference this page via [[pageName]]
    // Requires scanning HTML content in KeyDB for page references
    // Could be optimized with a separate references table indexed during ingestion
    // For now, return empty - implement with proper indexing later
    console.log(`[Display] getPageBacklinks: TODO - Backlink resolution for page ${pageUuid}`);
    return [];
  }
);

export const getBlockBacklinks = cache(
  async (blockUuid: string): Promise<Node[]> => {
    // TODO: Find all blocks that reference this block via ((blockUuid))
    // Requires scanning HTML content in KeyDB for block references
    // Could be optimized with a separate references table indexed during ingestion
    // For now, return empty - implement with proper indexing later
    console.log(`[Display] getBlockBacklinks: TODO - Backlink resolution for block ${blockUuid}`);
    return [];
  }
);

/**
 * Get page tree using SurrealDB graph traversal
 * Uses native graph capability: <-parent AS children to recursively fetch all descendants
 * This leverages the parent field's RELATE edge structure for efficient tree building
 */
export const getPageTree = cache(
  async (pageUuid: string): Promise<TreeNode | null> => {
    console.log(`[Display] getPageTree: Building tree for page ${pageUuid}`);

    // Fetch the page node using proper SurrealDB syntax
    const pageNodeId = nodeRecordId(pageUuid);
    console.log(`[Display] getPageTree: Fetching node with id: ${pageNodeId}`);
    const pageNodeResult = await query<Node>(`SELECT * FROM type::thing('nodes', $uuid)`, { uuid: pageUuid });

    if (pageNodeResult.length === 0) {
      console.log(`[Display] getPageTree: Page node not found: ${pageNodeId}`);
      return null;
    }

    const rawNode = pageNodeResult[0];
    console.log(`[Display] getPageTree: Raw node id=${rawNode.id}, uuid=${rawNode.uuid}, page_name=${rawNode.page_name}`);
    const pageNode = normalizeNode(rawNode);
    console.log(`[Display] getPageTree: Normalized - uuid=${pageNode.uuid}, id=${pageNode.id}, page_name=${pageNode.page_name}`);

    // Build tree recursively using graph queries
    const tree = await buildTreeWithGraphTraversal(pageNode);
    const nodeCount = countNodes(tree);
    console.log(`[Display] getPageTree: Tree built with ${nodeCount} total nodes`);

    return tree;
  }
);

/**
 * Build tree recursively using SurrealDB graph traversal
 * Fetches children via RELATE parent relationships: <-parent AS children
 */
async function buildTreeWithGraphTraversal(
  node: Node
): Promise<TreeNode> {
  // Get UUID safely - handle both string and RecordId objects
  const nodeUuid = node.uuid || getNodeUuidFromRecord(node.id);
  const nodeId = nodeRecordId(nodeUuid);
  console.log(`[Display] buildTreeWithGraphTraversal: Fetching children for nodeId=${nodeId}`);

  // Fetch children by querying nodes where parent = this node
  // This is simpler and more direct than trying to traverse the RELATE edge
  const graphResults = await query<Node[]>(
    `SELECT * FROM nodes WHERE parent = ${nodeId} ORDER BY \`order\``
  );

  let childrenData: Node[] = [];
  if (graphResults.length > 0) {
    childrenData = graphResults.map((child) =>
      normalizeNode(child as unknown as Node)
    );
    console.log(`[Display] buildTreeWithGraphTraversal: Found ${childrenData.length} children for ${nodeUuid}`);
    if (childrenData.length > 0) {
      console.log(`[Display] buildTreeWithGraphTraversal: First child - uuid=${childrenData[0].uuid}, id=${childrenData[0].id}, title=${childrenData[0].title}`);
    }
  }

  if (childrenData.length === 0) {
    console.log(`[Display] buildTreeWithGraphTraversal: No children found for ${nodeUuid}`);
  }

  // Recursively build subtrees for all children in parallel
  const childTrees = await Promise.all(
    childrenData.map((child) =>
      buildTreeWithGraphTraversal(child)
    )
  );

  return {
    node,
    children: childTrees,
  };
}

/**
 * Count total nodes in tree (for logging)
 */
function countNodes(tree: TreeNode): number {
  return 1 + tree.children.reduce((sum, child) => sum + countNodes(child), 0);
}

/**
 * Get page tree with HTML content loaded from KeyDB
 */
export const getPageTreeWithHTML = cache(
  async (pageUuid: string, workspaceId: string): Promise<TreeNode | null> => {
    const tree = await getPageTree(pageUuid);
    if (!tree) return null;

    // Collect all node UUIDs in the tree
    const uuids: string[] = [];
    function collectUuids(node: TreeNode) {
      const nodeUuid = node.node.uuid || getNodeUuidFromRecord(node.node.id);
      uuids.push(nodeUuid);
      for (const child of node.children) {
        collectUuids(child);
      }
    }
    collectUuids(tree);

    console.log(`[Display] getPageTreeWithHTML: Fetching HTML for ${uuids.length} nodes from KeyDB`);

    // Batch fetch all HTML from KeyDB
    const htmlMap = await getBlockHTMLBatch(workspaceId, uuids);

    // Attach HTML to nodes in tree
    function attachHTML(node: TreeNode): TreeNode {
      const nodeUuid = node.node.uuid || getNodeUuidFromRecord(node.node.id);
      return {
        node: {
          ...node.node,
          html: htmlMap.get(nodeUuid) || null,
        },
        children: node.children.map(attachHTML),
      };
    }

    const result = attachHTML(tree);
    console.log(`[Display] getPageTreeWithHTML: HTML attachment complete`);
    return result;
  }
);
