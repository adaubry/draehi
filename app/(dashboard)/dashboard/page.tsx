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
import { deleteUser } from "@/modules/auth/actions";
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

    const result = await deleteUser(user.id);

    if (result.error) {
      return { success: false, error: result.error };
    }

    const session = await getSession();
    session.destroy();

    redirect("/");
  }

  // Check if last error is stale (current deployment is successful)
  const lastDeploymentSuccess = deployments[0]?.status === "success";
  const errorIsStale = repository?.errorLog && lastDeploymentSuccess;

  return (
    <DashboardClient
      workspace={workspace}
      repository={repository}
      deployments={deployments}
      user={user}
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
