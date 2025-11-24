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

  if (!repository || !repository.deploy_key) {
    throw new Error("No repository connected");
  }

  // Trigger sync in background (no revalidation in promise to avoid render errors)
  syncRepository(
    workspace.id,
    repository.repo_url,
    repository.branch,
    repository.deploy_key
  ).catch((error) => {
    console.error("Manual deployment failed:", error);
  });

  // Immediate revalidation to show "syncing" status
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
}
