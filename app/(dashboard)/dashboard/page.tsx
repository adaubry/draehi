import { Suspense } from "react";
import { requireAuth, getSession } from "@/lib/session";
import { getWorkspaceByUserId } from "@/modules/workspace/queries";
import {
  getRepositoryByWorkspaceId,
  getDeployments,
} from "@/modules/git/queries";
import Link from "next/link";
import { triggerDeployment } from "./actions";
import { connectRepository } from "@/modules/git/actions";
import { deleteAuth0User } from "@/modules/auth/actions";
import { redirect } from "next/navigation";
import { DashboardClient } from "./dashboard-client";

async function DashboardContent() {
  const user = await requireAuth();
  const workspace = await getWorkspaceByUserId(user.id);

  if (!workspace) {
    return <div>No workspace found</div>;
  }

  const repository = await getRepositoryByWorkspaceId(workspace.id);
  const deployments = repository
    ? await getDeployments(workspace.id, 5)
    : [];

  async function handleConnect(formData: FormData) {
    "use server";

    const user = await requireAuth();
    const workspace = await getWorkspaceByUserId(user.id);

    if (!workspace) {
      return { success: false, error: "No workspace found" };
    }

    const repoUrl = formData.get("repoUrl") as string;
    const branch = formData.get("branch") as string;
    const accessToken = formData.get("accessToken") as string;

    if (!repoUrl || !branch || !accessToken) {
      return { success: false, error: "All fields required" };
    }

    const result = await connectRepository(
      workspace.id,
      repoUrl,
      branch,
      accessToken
    );

    if (result.error) {
      return { success: false, error: result.error };
    }

    return { success: true };
  }

  async function handleDeleteAccount(formData: FormData) {
    "use server";

    const user = await requireAuth();
    const confirmation = formData.get("confirmation") as string;

    if (confirmation !== user.username) {
      return { success: false, error: "Username confirmation does not match" };
    }

    // Delete user from SurrealDB (cascades to all workspaces, nodes, etc.)
    const result = await deleteAuth0User(user.auth0_sub);
    if (result.error) {
      return { success: false, error: result.error };
    }

    // Redirect to logout which:
    // 1. Clears appSession cookie
    // 2. Logs out from Auth0
    redirect("/api/auth/logout");
  }

  // Helper to convert dates to ISO strings
  const toISOString = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (value && typeof value === "object" && "toISOString" in value) {
      return (value as any).toISOString();
    }
    return new Date().toISOString();
  };

  // Serialize deployments for client component (convert non-serializable objects)
  const serializedDeployments = deployments.map((deployment) => ({
    id: String(deployment.id),
    commit_sha: deployment.commit_sha,
    status: deployment.status,
    deployed_at: toISOString(deployment.deployed_at),
  }));

  // Serialize repository for client component
  const serializedRepository = repository
    ? {
        id: String(repository.id),
        repo_url: repository.repo_url,
        branch: repository.branch,
        sync_status: repository.sync_status,
        last_sync: repository.last_sync ? toISOString(repository.last_sync) : null,
        error_log: repository.error_log || null,
        updated_at: toISOString(repository.updated_at),
      }
    : null;

  // Serialize workspace for client component
  const serializedWorkspace = {
    id: String(workspace.id),
    name: workspace.name,
    slug: workspace.slug,
  };

  // Serialize user for client component
  const serializedUser = {
    id: String(user.id),
    username: user.username,
  };

  // Check if last error is stale (current deployment is successful)
  const lastDeploymentSuccess = deployments[0]?.status === "success";
  const errorIsStale = repository?.error_log && lastDeploymentSuccess;

  return (
    <DashboardClient
      workspace={serializedWorkspace}
      repository={serializedRepository}
      deployments={serializedDeployments}
      user={serializedUser}
      errorIsStale={errorIsStale || false}
      handleConnect={handleConnect}
      handleDeleteAccount={handleDeleteAccount}
      triggerDeployment={triggerDeployment}
    />
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
