// SurrealDB git repository and deployment type definitions
// Schema is defined in lib/surreal.ts initSchema()

export interface GitRepository {
  id: string; // SurrealDB record ID: git_repositories:xxx
  workspace: string; // Record link to workspaces:xxx
  repo_url: string;
  branch: string;
  deploy_key?: string; // Encrypted deploy key or token
  last_sync?: string;
  sync_status: string; // idle, syncing, success, error
  error_log?: string;
  created_at: string;
  updated_at: string;
}

export interface Deployment {
  id: string; // SurrealDB record ID: deployment_history:xxx
  workspace: string; // Record link to workspaces:xxx
  commit_sha: string;
  status: string; // pending, building, success, failed
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
export function getGitRepoIdFromRecord(recordId: string): string {
  return recordId.replace("git_repositories:", "");
}

export function gitRepoRecordId(id: string): string {
  return id.startsWith("git_repositories:")
    ? id
    : `git_repositories:${id}`;
}

export function getDeploymentIdFromRecord(recordId: string): string {
  return recordId.replace("deployment_history:", "");
}

export function deploymentRecordId(id: string): string {
  return id.startsWith("deployment_history:")
    ? id
    : `deployment_history:${id}`;
}
