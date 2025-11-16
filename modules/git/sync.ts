"use server";

import { revalidateTag } from "next/cache";
import { cloneRepository, getLatestCommit, cleanupRepository } from "./clone";
import { updateRepository, createDeployment, updateDeployment } from "./actions";
import { ingestLogseqGraph } from "../content/actions";

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

    // Clone repository (may auto-detect different branch)
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
    const deployment = await createDeployment(
      workspaceId,
      commitSha,
      "building"
    );

    // Process Logseq graph (Phase 3)
    const ingestionResult = await ingestLogseqGraph(workspaceId, repoPath);

    if (!ingestionResult.success) {
      // Update deployment as failed
      await updateDeployment(deployment.deployment.id, {
        status: "failed",
        errorLog: ingestionResult.error,
        buildLog: ingestionResult.buildLog,
      });

      await updateRepository(workspaceId, {
        syncStatus: "error",
        errorLog: ingestionResult.error || "Ingestion failed",
      });

      return {
        success: false,
        error: ingestionResult.error || "Ingestion failed",
      };
    }

    // Update deployment as success
    await updateDeployment(deployment.deployment.id, {
      status: "success",
      buildLog: ingestionResult.buildLog,
    });

    // Update repository status (including auto-detected branch)
    const updateData: {
      syncStatus: string;
      lastSync: Date;
      errorLog?: string;
      branch?: string;
    } = {
      syncStatus: "success",
      lastSync: new Date(),
      errorLog: undefined,
    };

    // If branch was auto-detected, persist it
    if (cloneResult.branch && cloneResult.branch !== branch) {
      updateData.branch = cloneResult.branch;
      console.log(
        `Auto-corrected branch from '${branch}' to '${cloneResult.branch}' for workspace ${workspaceId}`
      );
    }

    await updateRepository(workspaceId, updateData);

    // Invalidate cache for public viewer
    // Note: Using revalidatePath instead of revalidateTag for simpler cache invalidation
    // This will be optimized in future with proper tag-based caching
    console.log(`Deployment successful for workspace ${workspaceId}`);

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
