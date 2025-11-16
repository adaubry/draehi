import { requireAuth } from "@/lib/session";
import { getWorkspaceByUserId } from "@/modules/workspace/queries";
import {
  getRepositoryByWorkspaceId,
  getDeployments,
} from "@/modules/git/queries";
import Link from "next/link";
import { triggerDeployment } from "./actions";

// Force dynamic rendering to show live status updates
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireAuth();
  const workspace = await getWorkspaceByUserId(user.id);

  if (!workspace) {
    return <div>No workspace found</div>;
  }

  const repository = await getRepositoryByWorkspaceId(workspace.id);
  const deployments = repository
    ? await getDeployments(workspace.id, 5)
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Manage your Logseq graph deployment
        </p>
      </div>

      {/* Workspace Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Workspace</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">Name</dt>
            <dd className="mt-1 text-sm">{workspace.name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">URL</dt>
            <dd className="mt-1 text-sm">
              <Link
                href={`/${workspace.slug}`}
                target="_blank"
                className="text-blue-600 hover:underline"
              >
                /{workspace.slug}
              </Link>
            </dd>
          </div>
        </dl>
      </div>

      {/* Git Repository */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Git Repository</h2>

        {!repository ? (
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">
              No repository connected yet
            </p>
            <Link
              href="/dashboard/settings"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-black hover:bg-gray-800"
            >
              Connect Repository
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Repository URL
                </dt>
                <dd className="mt-1 text-sm font-mono break-all">
                  {repository.repoUrl}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Branch</dt>
                <dd className="mt-1 text-sm">{repository.branch}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      repository.syncStatus === "success"
                        ? "bg-green-100 text-green-800"
                        : repository.syncStatus === "error"
                          ? "bg-red-100 text-red-800"
                          : repository.syncStatus === "syncing"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {repository.syncStatus}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Last Sync
                </dt>
                <dd className="mt-1 text-sm">
                  {repository.lastSync
                    ? new Date(repository.lastSync).toLocaleString()
                    : "Never"}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </div>

      {/* Recent Deployments */}
      {deployments.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Deployments</h2>
          <div className="space-y-3">
            {deployments.map((deployment) => (
              <div
                key={deployment.id}
                className="flex items-center justify-between py-3 border-b last:border-b-0"
              >
                <div className="flex-1">
                  <p className="text-sm font-mono">{deployment.commitSha.slice(0, 7)}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(deployment.deployedAt).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    deployment.status === "success"
                      ? "bg-green-100 text-green-800"
                      : deployment.status === "failed"
                        ? "bg-red-100 text-red-800"
                        : deployment.status === "building"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {deployment.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium hover:bg-gray-50"
          >
            Settings
          </Link>
          {repository && (
            <form action={triggerDeployment}>
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium hover:bg-gray-50"
              >
                Trigger Deployment
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
