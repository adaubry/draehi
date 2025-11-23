"use server";

import { create, update, query } from "@/lib/surreal";
import {
  type GitRepository,
  type Deployment,
  gitRepoRecordId,
  deploymentRecordId,
} from "./schema";
import { workspaceRecordId } from "../workspace/schema";
import { getRepositoryByWorkspaceId } from "./queries";

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
    workspace: workspaceRecordId(workspaceId),
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

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (data.syncStatus) updateData.sync_status = data.syncStatus;
  if (data.lastSync) updateData.last_sync = data.lastSync.toISOString();
  if (data.errorLog !== undefined) updateData.error_log = data.errorLog;
  if (data.branch) updateData.branch = data.branch;

  const repo = await update<GitRepository>(existing.id, updateData);

  return { repo };
}

export async function createDeployment(
  workspaceId: string,
  commitSha: string,
  status: string,
  errorLog?: string,
  buildLog?: string[]
) {
  const deployment = await create<Deployment>("deployment_history", {
    workspace: workspaceRecordId(workspaceId),
    commit_sha: commitSha,
    status,
    error_log: errorLog,
    build_log: buildLog,
  });

  return { deployment };
}

export async function updateDeployment(
  id: string,
  data: {
    status?: string;
    errorLog?: string;
    buildLog?: string[];
  }
) {
  const updateData: Record<string, unknown> = {};

  if (data.status) updateData.status = data.status;
  if (data.errorLog !== undefined) updateData.error_log = data.errorLog;
  if (data.buildLog) updateData.build_log = data.buildLog;

  const deployment = await update<Deployment>(deploymentRecordId(id), updateData);

  return { deployment };
}
