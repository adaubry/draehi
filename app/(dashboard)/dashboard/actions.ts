"use server";

import { requireAuth } from "@/lib/session";
import { getWorkspaceByUserId } from "@/modules/workspace/queries";
import { getRepositoryByWorkspaceId } from "@/modules/git/queries";
import { syncRepository } from "@/modules/git/sync";
import { revalidatePath } from "next/cache";

export async function triggerDeployment() {
  const user = await requireAuth();
  const workspace = await getWorkspaceByUserId(user.id);

  if (!workspace) {
    throw new Error("No workspace found");
  }

  const repository = await getRepositoryByWorkspaceId(workspace.id);

  if (!repository || !repository.deployKey) {
    throw new Error("No repository connected");
  }

  // Trigger sync
  syncRepository(
    workspace.id,
    repository.repoUrl,
    repository.branch,
    repository.deployKey
  ).catch((error) => {
    console.error("Manual deployment failed:", error);
  });

  // Revalidate dashboard
  revalidatePath("/dashboard");
}
