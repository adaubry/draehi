// SurrealDB git repository and deployment type definitions
// Schema is defined in scripts/init-surreal-schema.ts

export interface GitRepository {
  id: string; // SurrealDB record ID: git_repositories:ID_VALUE (unique string identifier)
  workspace: string; // Record link to workspaces:WORKSPACE_ID
  repo_url: string;
  branch: string;
  deploy_key?: string; // Encrypted deploy key or token (should be decrypted before use)
  last_sync?: string;
  sync_status: string; // idle | syncing | success | error
  error_log?: string;
  created_at: string;
  updated_at: string;
}

export interface Deployment {
  id: string; // SurrealDB record ID: deployment_history:ID_VALUE (unique string identifier)
  workspace: string; // Record link to workspaces:WORKSPACE_ID
  commit_sha: string;
  status: string; // pending | building | success | failed
  deployed_at: string;
  error_log?: string;
  build_log?: string[];
}

export type NewGitRepository = Omit<
  GitRepository,
  "id" | "created_at" | "updated_at"
>;
export type NewDeployment = Omit<Deployment, "id" | "deployed_at">;

// Extract ID from SurrealDB record ID
export function getGitRepoIdFromRecord(recordId: string | unknown): string {
  const idStr = String(recordId);
  return idStr.replace("git_repositories:", "");
}

export function gitRepoRecordId(id: string | undefined): string {
  if (!id) throw new Error("Git repository ID is required");
  const idStr = String(id);
  return idStr.startsWith("git_repositories:")
    ? idStr
    : `git_repositories:${idStr}`;
}

export function getDeploymentIdFromRecord(recordId: string | unknown): string {
  const idStr = String(recordId);
  return idStr.replace("deployment_history:", "");
}

export function deploymentRecordId(id: string | undefined): string {
  if (!id) throw new Error("Deployment ID is required");
  const idStr = String(id);
  return idStr.startsWith("deployment_history:")
    ? idStr
    : `deployment_history:${idStr}`;
}
