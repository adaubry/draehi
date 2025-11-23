// SurrealDB node type definitions
// Schema is defined in lib/surreal.ts initSchema()
// HTML content is stored in KeyDB (see lib/keydb.ts)

export interface Node {
  id: string; // SurrealDB record ID: nodes:uuid
  workspace: string; // Record link to workspaces:xxx
  parent?: string; // Record link to nodes:xxx (NULL = page, NOT NULL = block)
  order: number;
  page_name: string; // e.g., "guides/setup/intro"
  slug: string; // e.g., "intro"
  title: string;
  metadata?: {
    tags?: string[];
    properties?: Record<string, unknown>;
    frontmatter?: Record<string, unknown>;
  };
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
export function getNodeUuidFromRecord(recordId: string): string {
  return recordId.replace("nodes:", "");
}

// Build SurrealDB record ID from UUID
export function nodeRecordId(uuid: string): string {
  return uuid.startsWith("nodes:") ? uuid : `nodes:${uuid}`;
}
