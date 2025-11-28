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
    heading?: { level: number; text: string }; // First heading for TOC display
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
// Handles both formats: "nodes:uuid" and "nodes:⟨uuid⟩"
export function getNodeUuidFromRecord(recordId: string | unknown): string {
  const idStr = String(recordId);
  // Remove "nodes:" prefix if present
  let uuid = idStr.replace("nodes:", "");
  // Remove angle brackets if present (SurrealDB wraps some IDs with ⟨⟩)
  uuid = uuid.replace(/^⟨/, "").replace(/⟩$/, "");
  return uuid;
}

// Build SurrealDB record ID from UUID
export function nodeRecordId(uuid: string): string {
  return uuid.startsWith("nodes:") ? uuid : `nodes:${uuid}`;
}

// Normalize Node data - populate camelCase aliases from snake_case
export function normalizeNode(node: Node): Node {
  // Convert RecordId objects to strings for Client Component serialization
  let idValue = node.id;
  if (idValue && typeof idValue === 'object') {
    idValue = String(idValue);
  }

  let workspaceValue = node.workspace;
  if (workspaceValue && typeof workspaceValue === 'object') {
    workspaceValue = String(workspaceValue);
  }

  let parentValue = node.parent;
  if (parentValue && typeof parentValue === 'object') {
    parentValue = String(parentValue);
  }

  return {
    ...node,
    id: idValue,
    workspace: workspaceValue,
    parent: parentValue,
    uuid: node.uuid || getNodeUuidFromRecord(idValue),
    pageName: node.pageName || node.page_name,
    parentUuid: node.parentUuid !== undefined ? node.parentUuid : (parentValue || null),
  };
}

// Helper to ensure pageName is always available
export function ensurePageName(node: Node): string {
  return node.pageName || node.page_name;
}

/**
 * Check if a node has any actual metadata content
 * Returns false if metadata is undefined, null, or empty object {}
 */
export function hasMetadata(node: Node): boolean {
  if (!node.metadata) return false;
  return Object.keys(node.metadata).length > 0;
}

/**
 * Check if a node has a heading in metadata (for TOC entry)
 */
export function hasHeading(node: Node): boolean {
  return !!(node.metadata?.heading?.text);
}

/**
 * Create metadata object only with non-empty values
 * Used during ingestion to avoid creating { metadata: {} } for nodes without content
 * Returns undefined if all values are empty/null
 */
export function createMetadataIfNeeded(
  fields: Record<string, unknown>
): Record<string, unknown> | undefined {
  // Filter out empty values (empty arrays, undefined, empty strings, etc)
  const filtered = Object.fromEntries(
    Object.entries(fields)
      .filter(([_, value]) => {
        if (value === undefined || value === null) return false;
        if (Array.isArray(value) && value.length === 0) return false;
        if (typeof value === 'string' && value.trim() === '') return false;
        return true;
      })
  );

  // Only return metadata if we have at least one field with content
  return Object.keys(filtered).length > 0 ? filtered : undefined;
}
