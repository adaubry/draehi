"use server";

import { create, update, query as surrealQuery } from "@/lib/surreal";
import {
  type GitRepository,
  type Deployment,
  gitRepoRecordId,
  deploymentRecordId,
} from "./schema";
import { workspaceRecordId } from "../workspace/schema";
import { getRepositoryByWorkspaceId } from "./queries";

// Alias for clarity in updateRepository
const query = surrealQuery;

export async function connectRepository(
  workspaceId: string,
  repoUrl: string,
  branch = "main",
  deployKey?: string
) {
  // Check if already exists
  const existing = await getRepositoryByWorkspaceId(workspaceId);
  if (existing) {
    return { error: "Repository already connected" };
  }

  const repo = await create<GitRepository>("git_repositories", {
    workspace: workspaceId,  // Pass workspaceId directly - SurrealDB SDK handles RecordId
    repo_url: repoUrl,
    branch,
    deploy_key: deployKey,
    sync_status: "idle",
  });

  // Trigger initial sync in background
  const { syncRepository } = await import("./sync");
  if (deployKey) {
    syncRepository(workspaceId, repoUrl, branch, deployKey).catch((error) => {
      console.error("Initial sync failed:", error);
    });
  }

  return { repo };
}

export async function updateRepository(
  workspaceId: string,
  data: {
    syncStatus?: string;
    lastSync?: Date;
    errorLog?: string;
    branch?: string;
  }
) {
  // Find the repo first
  const existing = await getRepositoryByWorkspaceId(workspaceId);
  if (!existing) {
    return { error: "Repository not found" };
  }

  try {
    // Use raw query to properly handle datetime fields
    let updateQuery = "UPDATE $thing SET ";
    const params: Record<string, unknown> = { thing: existing.id };
    const updates: string[] = [];

    updates.push("updated_at = time::now()");

    if (data.syncStatus) {
      updates.push("sync_status = $syncStatus");
      params.syncStatus = data.syncStatus;
    }
    if (data.lastSync) {
      // For datetime fields, use cast to ensure proper type conversion
      updates.push("last_sync = <datetime>$lastSync");
      params.lastSync = data.lastSync.toISOString();
    }
    if (data.errorLog !== undefined) {
      updates.push("error_log = $errorLog");
      params.errorLog = data.errorLog;
    }
    if (data.branch) {
      updates.push("branch = $branch");
      params.branch = data.branch;
    }

    updateQuery += updates.join(", ") + " RETURN *;";

    const result = await query<GitRepository>(updateQuery, params);
    const repo = result[0];

    return { repo };
  } catch (error) {
    console.error("Failed to update repository:", error);
    return { error: "Failed to update repository" };
  }
}

export async function createDeployment(
  workspaceId: string,
  commitSha: string,
  status: string,
  errorLog?: string,
  buildLog?: string[]
) {
  const deployment = await create<Deployment>("deployment_history", {
    workspace: workspaceId,  // Pass workspaceId directly - SurrealDB SDK handles RecordId
    commit_sha: commitSha,
    status,
    error_log: errorLog,
    build_log: buildLog,
  });

  return deployment;
}

export async function updateDeployment(
  id: string | unknown,
  data: {
    status?: string;
    errorLog?: string;
    buildLog?: string[];
  }
) {
  try {
    // Use raw query to properly handle record references
    // SurrealDB SDK requires RecordId objects, not string parameters
    let updateQuery = "UPDATE $thing SET ";
    const params: Record<string, unknown> = { thing: id };
    const updates: string[] = [];

    if (data.status) {
      updates.push("status = $status");
      params.status = data.status;
    }
    if (data.errorLog !== undefined) {
      updates.push("error_log = $errorLog");
      params.errorLog = data.errorLog;
    }
    if (data.buildLog) {
      updates.push("build_log = $buildLog");
      params.buildLog = data.buildLog;
    }

    updateQuery += updates.join(", ") + " RETURN *;";

    const result = await query<Deployment>(updateQuery, params);
    const deployment = result[0];

    return { deployment };
  } catch (error) {
    console.error("Failed to update deployment:", error);
    return { error: "Failed to update deployment" };
  }
}
