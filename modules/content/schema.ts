// SurrealDB node type definitions
// Schema is defined in scripts/init-surreal-schema.ts
// HTML content is stored in KeyDB (see lib/keydb.ts)

export interface Node {
  id: string; // SurrealDB record ID: nodes:BLOCK_UUID (unique string identifier)
  uuid?: string; // Alias for id (camelCase for backwards compatibility)
  workspace: string; // Record link to workspaces:WORKSPACE_ID
  parent?: string | null; // Record link to nodes:PARENT_UUID (NULL = page, NOT NULL = block)
  parentUuid?: string | null; // Alias for parent (camelCase for backwards compatibility)
  order: number;
  page_name: string; // e.g., "guides/setup/intro"
  pageName?: string; // Alias for page_name (camelCase for backwards compatibility)
  slug: string; // e.g., "intro"
  title: string;
  metadata?: {
    tags?: string[];
    properties?: Record<string, unknown>;
    frontmatter?: Record<string, unknown>;
  };
  html?: string | null; // HTML content (stored in KeyDB, included when needed)
  created_at: string;
  updated_at: string;
}

// Note: html is NOT stored in SurrealDB - it's in KeyDB
export interface NodeWithHTML extends Node {
  html?: string | null;
}

export type NewNode = {
  uuid: string; // Used to create nodes:uuid
  workspaceId: string;
  parentUuid?: string | null;
  order: number;
  pageName: string;
  slug: string;
  title: string;
  html?: string | null; // Will be stored in KeyDB
  metadata?: Node["metadata"];
};

// Extract UUID from SurrealDB record ID
export function getNodeUuidFromRecord(recordId: string | unknown): string {
  const idStr = String(recordId);
  return idStr.replace("nodes:", "");
}

// Build SurrealDB record ID from UUID
export function nodeRecordId(uuid: string): string {
  return uuid.startsWith("nodes:") ? uuid : `nodes:${uuid}`;
}

// Normalize Node data - populate camelCase aliases from snake_case
export function normalizeNode(node: Node): Node {
  return {
    ...node,
    uuid: node.uuid || node.id,
    pageName: node.pageName || node.page_name,
    parentUuid: node.parentUuid !== undefined ? node.parentUuid : (node.parent || null),
  };
}

// Helper to ensure pageName is always available
export function ensurePageName(node: Node): string {
  return node.pageName || node.page_name;
}
