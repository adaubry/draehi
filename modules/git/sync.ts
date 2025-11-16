"use server";

import { cloneRepository, getLatestCommit, cleanupRepository } from "./clone";
import { updateRepository, createDeployment } from "./actions";
import { revalidateTag } from "next/cache";

export async function syncRepository(
  workspaceId: number,
  repoUrl: string,
  branch: string,
  accessToken: string
): Promise<{ success: boolean; error?: string; commitSha?: string }> {
  let repoPath: string | null = null;

  try {
    // Update status to syncing
    await updateRepository(workspaceId, {
      syncStatus: "syncing",
      errorLog: undefined,
    });

    // Clone repository
    const cloneResult = await cloneRepository(repoUrl, branch, accessToken);
    if (!cloneResult.success || !cloneResult.path) {
      await updateRepository(workspaceId, {
        syncStatus: "error",
        errorLog: cloneResult.error || "Failed to clone repository",
      });
      return {
        success: false,
        error: cloneResult.error || "Failed to clone repository",
      };
    }

    repoPath = cloneResult.path;

    // Get commit SHA
    const commitSha = await getLatestCommit(repoPath);

    // Create deployment record
    await createDeployment(workspaceId, commitSha, "building");

    // TODO: Process Logseq graph (Phase 3)
    // For now, just mark as success

    // Update repository status
    await updateRepository(workspaceId, {
      syncStatus: "success",
      lastSync: new Date(),
      errorLog: undefined,
    });

    // Invalidate cache (optional tag parameter)
    revalidateTag(`workspace-${workspaceId}`, "page");

    return {
      success: true,
      commitSha,
    };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : "Unknown error during sync";

    await updateRepository(workspaceId, {
      syncStatus: "error",
      errorLog: errorMsg,
    });

    return {
      success: false,
      error: errorMsg,
    };
  } finally {
    // Cleanup temp directory
    if (repoPath) {
      await cleanupRepository(repoPath);
    }
  }
}
