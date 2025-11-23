// SurrealDB workspace type definitions
// Schema is defined in lib/surreal.ts initSchema()

export interface Workspace {
  id: string; // SurrealDB record ID: workspaces:xxx
  user: string; // Record link to users:xxx
  slug: string;
  name: string;
  domain?: string; // Custom domain (future)
  embed_depth: number; // Max depth for embeds
  created_at: string;
  updated_at: string;
}

export type NewWorkspace = Omit<Workspace, "id" | "created_at" | "updated_at">;

// Extract ID from SurrealDB record ID
export function getWorkspaceIdFromRecord(recordId: string): string {
  return recordId.replace("workspaces:", "");
}

// Build SurrealDB record ID from ID
export function workspaceRecordId(id: string): string {
  return id.startsWith("workspaces:") ? id : `workspaces:${id}`;
}
