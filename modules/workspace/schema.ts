// SurrealDB workspace type definitions
// Schema is defined in scripts/init-surreal-schema.ts

export interface Workspace {
  id: string; // SurrealDB record ID: workspaces:ID_VALUE (unique string identifier)
  user: string; // Record link to users:USER_ID
  slug: string;
  name: string;
  domain?: string; // Custom domain (future)
  embed_depth: number; // Max depth for embeds
  created_at: string;
  updated_at: string;
}

export type NewWorkspace = Omit<Workspace, "id" | "created_at" | "updated_at">;

// Extract ID from SurrealDB record ID
export function getWorkspaceIdFromRecord(recordId: string | unknown): string {
  const idStr = String(recordId);
  return idStr.replace("workspaces:", "");
}

// Build SurrealDB record ID from ID
export function workspaceRecordId(id: string | undefined): string {
  if (!id) throw new Error("Workspace ID is required");
  const idStr = String(id);
  return idStr.startsWith("workspaces:") ? idStr : `workspaces:${idStr}`;
}
