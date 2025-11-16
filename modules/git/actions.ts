"use server";

import { db } from "@/lib/db";
import {
  gitRepositories,
  deploymentHistory,
  type NewGitRepository,
  type NewDeployment,
} from "./schema";
import { getRepositoryByWorkspaceId } from "./queries";
import { eq } from "drizzle-orm";

export async function connectRepository(
  workspaceId: number,
  repoUrl: string,
  branch = "main",
  deployKey?: string
) {
  // Check if already exists
  const existing = await getRepositoryByWorkspaceId(workspaceId);
  if (existing) {
    return { error: "Repository already connected" };
  }

  const [repo] = await db
    .insert(gitRepositories)
    .values({
      workspaceId,
      repoUrl,
      branch,
      deployKey,
      syncStatus: "idle",
    })
    .returning();

  // Trigger initial sync
  const { syncRepository } = await import("./sync");
  if (deployKey) {
    // Run sync in background (don't await)
    syncRepository(workspaceId, repoUrl, branch, deployKey).catch((error) => {
      console.error("Initial sync failed:", error);
    });
  }

  return { repo };
}

export async function updateRepository(
  workspaceId: number,
  data: {
    syncStatus?: string;
    lastSync?: Date;
    errorLog?: string;
  }
) {
  const [repo] = await db
    .update(gitRepositories)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(gitRepositories.workspaceId, workspaceId))
    .returning();

  return { repo };
}

export async function createDeployment(
  workspaceId: number,
  commitSha: string,
  status: string,
  errorLog?: string,
  buildLog?: string[]
) {
  const [deployment] = await db
    .insert(deploymentHistory)
    .values({
      workspaceId,
      commitSha,
      status,
      errorLog,
      buildLog,
    })
    .returning();

  return { deployment };
}

export async function updateDeployment(
  id: number,
  data: {
    status?: string;
    errorLog?: string;
    buildLog?: string[];
  }
) {
  const [deployment] = await db
    .update(deploymentHistory)
    .set(data)
    .where(eq(deploymentHistory.id, id))
    .returning();

  return { deployment };
}
