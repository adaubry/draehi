"use server";

import { query, selectOne } from "@/lib/surreal";
import { getBlockHTML, getBlockHTMLBatch } from "@/lib/keydb";
import {
  type Node,
  type NodeWithHTML,
  nodeRecordId,
  normalizeNode,
  getNodeUuidFromRecord,
} from "./schema";
import { cache } from "react";

// Feature flag for SurrealDB graph traversal optimization
const USE_GRAPH_QUERY = true;

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
    console.log(
      `[Display] getNodeByPath: Looking for path [${pathSegments.join("/")}]`
    );

    // Build slug from path segments: "advanced-commands"
    const slug = pathSegments[pathSegments.length - 1];
    console.log(`[Display] getNodeByPath: Looking up slug: "${slug}"`);

    // Query for PAGE node specifically (parent IS NONE) - not blocks
    // First try to match by slug (URL-safe name)
    const page = await query<Node>(
      "SELECT * FROM nodes WHERE workspace = $ws AND slug = $slug AND parent IS NONE LIMIT 1",
      { ws: workspaceId, slug }
    );

    if (page.length === 0) {
      console.log(`[Display] getNodeByPath: No match found for slug "${slug}"`);
      return null;
    }

    const matchingPage = page[0];
    console.log(
      `[Display] getNodeByPath: Matched PAGE "${
        matchingPage.page_name
      }" (slug: ${slug}) to [${pathSegments.join("/")}]`
    );
    return normalizeNode(JSON.parse(JSON.stringify(matchingPage)));
  }
);

export const getAllNodes = cache(
  async (workspaceId: string): Promise<Node[]> => {
    // Only return page nodes for navigation (parent IS NONE)
    console.log(
      `[Display] getAllNodes: Fetching page nodes for workspace ${workspaceId}`
    );
    const nodes = await query<Node>(
      "SELECT * FROM nodes WHERE workspace = $ws AND parent IS NONE ORDER BY page_name",
      { ws: workspaceId }
    );
    console.log(`[Display] getAllNodes: Found ${nodes.length} page nodes`);
    // Serialize to plain objects for Server->Client boundary and normalize
    return nodes.map((n) => normalizeNode(JSON.parse(JSON.stringify(n))));
  }
);

export const getPageBlocks = cache(
  async (pageUuid: string): Promise<Node[]> => {
    const pageNodeId = nodeRecordId(pageUuid);
    console.log(
      `[Display] getPageBlocks: Fetching direct children for page ${pageUuid}`
    );

    const blocks = await query<Node>(
      `SELECT * FROM ${pageNodeId} <- parent ORDER BY order`
    );

    console.log(
      `[Display] getPageBlocks: Found ${blocks.length} direct children`
    );
    return blocks;
  }
);

export const getAllBlocksForPage = cache(
  async (workspaceId: string, pageName: string): Promise<Node[]> => {
    // Get all blocks for this page (excludes the page node itself)
    console.log(
      `[Display] getAllBlocksForPage: Fetching blocks for page "${pageName}" in workspace ${workspaceId}`
    );

    // Step 1: Get page node
    const pageResult = await query<Node>(
      "SELECT * FROM nodes WHERE workspace = $ws AND page_name = $pageName AND parent IS NONE LIMIT 1",
      { ws: workspaceId, pageName }
    );

    if (pageResult.length === 0) {
      console.log(
        `[Display] getAllBlocksForPage: Page not found for "${pageName}"`
      );
      return [];
    }

    const pageNode = pageResult[0];
    const pageNodeId = nodeRecordId(
      pageNode.uuid || getNodeUuidFromRecord(pageNode.id)
    );

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
        const childId = nodeRecordId(
          child.uuid || getNodeUuidFromRecord(child.id)
        );
        queue.push(childId);
      }
    }

    console.log(
      `[Display] getAllBlocksForPage: Found ${allBlocks.length} blocks for page "${pageName}"`
    );
    return allBlocks;
  }
);

// Get all blocks for a page with their HTML from KeyDB
export const getAllBlocksForPageWithHTML = cache(
  async (workspaceId: string, pageName: string): Promise<NodeWithHTML[]> => {
    console.log(
      `[Display] getAllBlocksForPageWithHTML: Fetching blocks with HTML for page "${pageName}"`
    );
    const blocks = await getAllBlocksForPage(workspaceId, pageName);

    if (blocks.length === 0) {
      console.log(
        `[Display] getAllBlocksForPageWithHTML: No blocks found for page "${pageName}"`
      );
      return [];
    }

    // Batch fetch HTML from KeyDB
    const uuids = blocks.map((b) => getNodeUuidFromRecord(b.id));
    console.log(
      `[Display] getAllBlocksForPageWithHTML: Batch fetching HTML for ${uuids.length} blocks from KeyDB`
    );
    const htmlMap = await getBlockHTMLBatch(workspaceId, uuids);
    const htmlCount = Array.from(htmlMap.values()).filter(
      (h) => h !== null
    ).length;
    console.log(
      `[Display] getAllBlocksForPageWithHTML: Retrieved HTML for ${htmlCount}/${uuids.length} blocks`
    );

    return blocks.map((block) =>
      normalizeNode({
        ...block,
        html: htmlMap.get(getNodeUuidFromRecord(block.id)) || null,
      })
    );
  }
);

export const getPageBacklinks = cache(
  async (pageUuid: string): Promise<Node[]> => {
    // TODO: Find all blocks that reference this page via [[pageName]]
    // Requires scanning HTML content in KeyDB for page references
    // Could be optimized with a separate references table indexed during ingestion
    // For now, return empty - implement with proper indexing later
    console.log(
      `[Display] getPageBacklinks: TODO - Backlink resolution for page ${pageUuid}`
    );
    return [];
  }
);

export const getBlockBacklinks = cache(
  async (blockUuid: string): Promise<Node[]> => {
    // TODO: Find all blocks that reference this block via ((blockUuid))
    // Requires scanning HTML content in KeyDB for block references
    // Could be optimized with a separate references table indexed during ingestion
    // For now, return empty - implement with proper indexing later
    console.log(
      `[Display] getBlockBacklinks: TODO - Backlink resolution for block ${blockUuid}`
    );
    return [];
  }
);

/**
 * Get page tree using SurrealDB graph traversal
 * Uses native graph capability: <-parent AS children to recursively fetch all descendants
 * This leverages the parent field's RELATE edge structure for efficient tree building
 */
export const getPageTree = cache(
  async (pageUuid: string, workspaceId?: string): Promise<TreeNode | null> => {
    console.log(`[Display] getPageTree: Building tree for page ${pageUuid}`);

    if (USE_GRAPH_QUERY && workspaceId) {
      console.log(
        `[Display] getPageTree: Using optimized graph query (1 query instead of 547)`
      );

      // NEW: Use SurrealDB graph traversal (much faster!)
      const flatNodes = await buildTreeWithGraphQuery(pageUuid, workspaceId);
      if (flatNodes.length === 0) {
        console.log(
          `[Display] getPageTree: No nodes found for page ${pageUuid}`
        );
        return null;
      }

      // Build tree from flat list
      const tree = buildTreeFromFlatList(flatNodes, pageUuid, workspaceId);
      if (tree) {
        const nodeCount = countNodes(tree);
        console.log(
          `[Display] getPageTree: Tree built with ${nodeCount} total nodes using graph query`
        );
      }
      return tree;
    }

    // FALLBACK: Old sequential query approach (for safety/debugging)
    console.log(`[Display] getPageTree: Using fallback sequential query`);
    const pageNodeId = nodeRecordId(pageUuid);
    console.log(`[Display] getPageTree: Fetching node with id: ${pageNodeId}`);
    const pageNodeResult = await query<Node>(
      `SELECT * FROM type::thing('nodes', $uuid)`,
      { uuid: pageUuid }
    );

    if (pageNodeResult.length === 0) {
      console.log(`[Display] getPageTree: Page node not found: ${pageNodeId}`);
      return null;
    }

    const rawNode = pageNodeResult[0];
    console.log(
      `[Display] getPageTree: Raw node id=${rawNode.id}, uuid=${rawNode.uuid}, page_name=${rawNode.page_name}`
    );
    const pageNode = normalizeNode(rawNode);
    console.log(
      `[Display] getPageTree: Normalized - uuid=${pageNode.uuid}, id=${pageNode.id}, page_name=${pageNode.page_name}`
    );

    // Build tree recursively using sequential queries with cycle detection
    const visitedUuids = new Set<string>();
    const cyclesDetected: Array<{ nodeUuid: string; nodeTitle: string }> = [];
    const tree = await buildTreeWithGraphTraversal(
      pageNode,
      visitedUuids,
      [pageUuid],
      cyclesDetected
    );
    const nodeCount = countNodes(tree);
    console.log(
      `[Display] getPageTree: Tree built with ${nodeCount} total nodes`
    );

    if (cyclesDetected.length > 0) {
      console.warn(
        `[Display] getPageTree: Detected and broke ${
          cyclesDetected.length
        } cycles in tree:\n${cyclesDetected
          .map((c) => `  - Node ${c.nodeUuid} (${c.nodeTitle})`)
          .join("\n")}`
      );
    }

    return tree;
  }
);

/**
 * Build hierarchical tree from flat list of nodes with parent references
 * Converts a flat array into a nested TreeNode structure based on parent pointers
 */
function buildTreeFromFlatList(
  nodes: Node[],
  pageUuid: string,
  workspace: any
): TreeNode | null {
  if (nodes.length === 0) return null;

  // Find the root page node
  const pageNode = nodes.find((n) => {
    const uuid = n.uuid || getNodeUuidFromRecord(n.id);
    return uuid === pageUuid;
  });

  if (!pageNode) {
    console.log(
      `[Display] buildTreeFromFlatList: Page node ${pageUuid} not found in nodes list`
    );
    return null;
  }

  // Create map for fast lookup
  const nodeMap = new Map<string, Node>();
  nodes.forEach((n) => {
    const uuid = n.uuid || getNodeUuidFromRecord(n.id);
    nodeMap.set(uuid, n);
  });

  // Build tree recursively
  function buildNode(node: Node): TreeNode {
    const nodeUuid = node.uuid || getNodeUuidFromRecord(node.id);
    const children: TreeNode[] = [];

    // Find all children of this node
    nodes.forEach((n) => {
      const parentUuid = n.parent
        ? typeof n.parent === "string"
          ? n.parent.replace("nodes:", "")
          : getNodeUuidFromRecord(n.parent)
        : null;
      if (parentUuid === nodeUuid) {
        children.push(buildNode(n));
      }
    });

    return {
      node,
      children: children.sort(
        (a, b) => (a.node.order || 0) - (b.node.order || 0)
      ),
    };
  }

  return buildNode(pageNode);
}

/**
 * Fetch all nodes for a page using SurrealDB graph query
 * omfg never touch this ever again
 * this is BFS traversal
 * never ever modify BFS
 */
export async function buildTreeWithGraphQuery(
  pageUuid: string,
  workspaceId: string
): Promise<any[]> {
  const pageNodeId = nodeRecordId(pageUuid);

  console.log(
    `[Display] buildTreeWithGraphQuery: Starting BFS traversal for page ${pageUuid} (${pageNodeId})`
  );

  const visited = new Set<string>();
  const allNodes: any[] = [];
  let currentLevel = [pageNodeId];
  let depth = 0;

  while (currentLevel.length > 0) {
    // Log current traversal state
    console.log(
      `[Display] BFS Depth ${depth}: Processing ${currentLevel.length} nodes at this level`
    );

    // Filter out already visited nodes
    const beforeFilter = currentLevel.length;
    currentLevel = currentLevel.filter((id) => !visited.has(id));

    if (beforeFilter !== currentLevel.length) {
      console.log(
        `[Display] BFS Depth ${depth}: Filtered out ${
          beforeFilter - currentLevel.length
        } already visited nodes`
      );
    }

    if (currentLevel.length === 0) {
      console.log(`[Display] BFS: No more unvisited nodes, stopping traversal`);
      break;
    }

    // Mark as visited
    currentLevel.forEach((id) => visited.add(id));

    // Log the query being executed
    console.log(
      `[Display] BFS Depth ${depth}: Querying ${currentLevel.length} nodes: ${
        currentLevel.length <= 5
          ? currentLevel.join(", ")
          : `${currentLevel.slice(0, 3).join(", ")}... (and ${
              currentLevel.length - 3
            } more)`
      }`
    );

    // Batch query for all nodes at current level
    const queryStartTime = Date.now();
    const levelResults = await query<Node>(
      `
      SELECT *, <-parent<-nodes AS children 
      FROM [${currentLevel.join(", ")}]
      WHERE workspace = ${workspaceId}
      ORDER BY order ASC
      `
    );
    const queryTime = Date.now() - queryStartTime;

    console.log(
      `[Display] BFS Depth ${depth}: Query returned ${levelResults.length} nodes in ${queryTime}ms`
    );

    // Log if we got fewer results than expected
    if (levelResults.length < currentLevel.length) {
      console.log(
        `[Display] BFS Depth ${depth}: Warning - Expected ${currentLevel.length} nodes but got ${levelResults.length}`
      );
    }

    allNodes.push(...levelResults);

    // Collect all children for next level
    const nextLevel = new Set<string>();
    let totalChildrenFound = 0;

    for (const node of levelResults) {
      if (node.children && Array.isArray(node.children)) {
        totalChildrenFound += node.children.length;
        node.children.forEach((childId) => nextLevel.add(childId));

        // Log nodes with many children (potential hotspots)
        if (node.children.length > 10) {
          console.log(
            `[Display] BFS Depth ${depth}: Node ${node.id} has ${node.children.length} children`
          );
        }
      }
    }

    console.log(
      `[Display] BFS Depth ${depth}: Found ${totalChildrenFound} total children, ${nextLevel.size} unique children for next level`
    );

    currentLevel = Array.from(nextLevel);
    depth++;

    // Safety check for infinite loops
    if (depth > 50) {
      console.error(
        `[Display] BFS: WARNING - Depth exceeded 50 levels, possible infinite loop. Stopping traversal.`
      );
      break;
    }
  }

  console.log(
    `[Display] buildTreeWithGraphQuery: Traversal complete. Visited ${visited.size} unique nodes, collected ${allNodes.length} total nodes, max depth: ${depth}`
  );

  // Log duplicate check
  const uniqueIds = new Set(allNodes.map((n) => n.id));
  if (uniqueIds.size !== allNodes.length) {
    console.warn(
      `[Display] buildTreeWithGraphQuery: Found ${
        allNodes.length - uniqueIds.size
      } duplicate nodes in results`
    );
  }

  // Log performance summary
  console.log(
    `[Display] buildTreeWithGraphQuery: Performance summary - ${depth} levels traversed, ${visited.size} nodes visited`
  );

  return allNodes.map((n) => normalizeNode(JSON.parse(JSON.stringify(n))));
}

/**
 * Build tree recursively using SurrealDB graph traversal
 * Fetches children by querying nodes where parent = this node
 * Includes cycle detection to prevent infinite loops and track cycles for reporting
 *
 * @param node - The current node to process
 * @param visitedUuids - Set of already visited node UUIDs in this traversal
 * @param ancestorPath - Array of ancestor UUIDs (for cycle detection path)
 * @param cyclesDetected - Array to accumulate detected cycles for reporting
 */
async function buildTreeWithGraphTraversal(
  node: Node,
  visitedUuids: Set<string>,
  ancestorPath: string[],
  cyclesDetected: Array<{ nodeUuid: string; nodeTitle: string }>
): Promise<TreeNode> {
  // Get UUID safely - handle both string and RecordId objects
  const nodeUuid = node.uuid || getNodeUuidFromRecord(node.id);
  const nodeId = nodeRecordId(nodeUuid);

  // Cycle detection: if this node is already in the visited set, we have a cycle
  if (visitedUuids.has(nodeUuid)) {
    const cyclePathStr = ancestorPath.join(" -> ");
    console.warn(
      `[Display] buildTreeWithGraphTraversal: Cycle detected!\n` +
        `  Affected node: ${nodeUuid} (${node.title})\n` +
        `  Cycle path: ${cyclePathStr} -> ${nodeUuid}\n` +
        `  Fix: Break the parent relationship of one node in this cycle or check for data corruption.`
    );
    cyclesDetected.push({ nodeUuid, nodeTitle: node.title });

    // Return the node but with empty children to break the cycle
    return {
      node,
      children: [],
    };
  }

  // Mark this node as visited
  visitedUuids.add(nodeUuid);
  console.log(
    `[Display] buildTreeWithGraphTraversal: Fetching children for nodeId=${nodeId}`
  );

  // Fetch children by querying nodes where parent = this node
  const graphResults = await query<Node[]>(
    `SELECT * FROM nodes WHERE parent = ${nodeId} ORDER BY \`order\``
  );

  let childrenData: Node[] = [];
  if (graphResults.length > 0) {
    childrenData = graphResults.map((child) =>
      normalizeNode(child as unknown as Node)
    );
    console.log(
      `[Display] buildTreeWithGraphTraversal: Found ${childrenData.length} children for ${nodeUuid}`
    );
    if (childrenData.length > 0) {
      console.log(
        `[Display] buildTreeWithGraphTraversal: First child - uuid=${childrenData[0].uuid}, id=${childrenData[0].id}, title=${childrenData[0].title}`
      );
    }
  }

  if (childrenData.length === 0) {
    console.log(
      `[Display] buildTreeWithGraphTraversal: No children found for ${nodeUuid}`
    );
  }

  // Recursively build subtrees for all children in parallel
  const childTrees = await Promise.all(
    childrenData.map((child) =>
      buildTreeWithGraphTraversal(
        child,
        visitedUuids,
        [...ancestorPath, nodeUuid],
        cyclesDetected
      )
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
    const tree = await getPageTree(pageUuid, workspaceId);
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

    console.log(
      `[Display] getPageTreeWithHTML: Fetching HTML for ${uuids.length} nodes from KeyDB`
    );

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

/**
 * Get all blocks with heading metadata for a page
 * Builds tree then filters to blocks with headings
 * Avoids fetching all blocks - only processes blocks that exist in tree
 */
export const getBlocksWithHeadings = cache(
  async (pageUuid: string, workspaceId?: string): Promise<Node[]> => {
    console.log(
      `[Display] getBlocksWithHeadings: Fetching blocks with headings for page ${pageUuid}`
    );

    // Get the full tree
    const tree = await getPageTree(pageUuid, workspaceId);
    if (!tree) {
      console.log(
        `[Display] getBlocksWithHeadings: No tree found for page ${pageUuid}`
      );
      return [];
    }

    // Flatten tree and collect all blocks with headings
    const blocksWithHeadings: Node[] = [];
    function collectHeadingBlocks(node: TreeNode) {
      // Check if this node has a heading
      if (node.node.metadata?.heading?.text) {
        blocksWithHeadings.push(node.node);
      }
      // Recurse into children
      for (const child of node.children) {
        collectHeadingBlocks(child);
      }
    }

    collectHeadingBlocks(tree);
    console.log(
      `[Display] getBlocksWithHeadings: Found ${blocksWithHeadings.length} blocks with heading metadata`
    );
    return blocksWithHeadings;
  }
);

// TOC Item type for table of contents
export interface TOCItem {
  uuid: string;
  title: string;
  level: number;
  children: TOCItem[];
}

/**
 * Build hierarchical TOC tree from flat list of headings
 * Headings are ordered by level (h1, h2, h3)
 */
function buildTOCHierarchy(
  flatHeadings: Array<{ uuid: string; title: string; level: number }>
): TOCItem[] {
  if (flatHeadings.length === 0) return [];

  const items: TOCItem[] = [];
  const stack: TOCItem[] = [];

  for (const heading of flatHeadings) {
    const item: TOCItem = {
      uuid: heading.uuid,
      title: heading.title,
      level: heading.level,
      children: [],
    };

    // Find parent by level
    while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      // Top-level item
      items.push(item);
    } else {
      // Add as child to current parent
      stack[stack.length - 1].children.push(item);
    }

    stack.push(item);
  }

  return items;
}

/**
 * Get table of contents for a page
 * Returns hierarchical list of headings found in page blocks
 */
export const getTOCForPage = cache(
  async (pageUuid: string, workspaceId: string): Promise<TOCItem[]> => {
    console.log(`[Display] getTOCForPage: Building TOC for page ${pageUuid}`);

    // Get all blocks with headings
    const blocksWithHeadings = await getBlocksWithHeadings(
      pageUuid,
      workspaceId
    );

    // Extract headings in order
    const flatHeadings = blocksWithHeadings
      .filter((block) => block.metadata?.heading?.text)
      .map((block) => {
        const heading = block.metadata!.heading!;
        return {
          uuid: block.uuid || block.id,
          title: heading.text,
          level: heading.level,
        };
      });

    // Build hierarchical structure
    const tocItems = buildTOCHierarchy(flatHeadings);
    console.log(
      `[Display] getTOCForPage: Built TOC with ${tocItems.length} root items`
    );

    return tocItems;
  }
);
