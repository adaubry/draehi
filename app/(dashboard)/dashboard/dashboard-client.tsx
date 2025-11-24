// TODO: Migrate to shadcn/ui components (Card, Badge, Collapsible, Dialog, Separator, Form, Button, Input)
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useActionState } from "react";

type DashboardClientProps = {
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  repository: {
    id: string;
    repo_url: string;
    branch: string;
    sync_status: string;
    last_sync: string | null;
    error_log: string | null;
    updated_at: string;
  } | null;
  deployments: {
    id: string;
    commit_sha: string;
    status: string;
    deployed_at: string;
  }[];
  user: {
    id: string;
    username: string;
  };
  errorIsStale: boolean;
  handleConnect: (formData: FormData) => Promise<{success: boolean; error?: string}>;
  handleDeleteAccount: (formData: FormData) => Promise<{success: boolean; error?: string}>;
  triggerDeployment: () => Promise<void>;
};

export function DashboardClient({
  workspace,
  repository,
  deployments,
  user,
  errorIsStale,
  handleConnect,
  handleDeleteAccount,
  triggerDeployment,
}: DashboardClientProps) {
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(true);

  const [connectState, connectAction, connectPending] = useActionState(
    async (_prevState: unknown, formData: FormData) => {
      return await handleConnect(formData);
    },
    null
  );

  const [deleteState, deleteAction, deletePending] = useActionState(
    async (_prevState: unknown, formData: FormData) => {
      return await handleDeleteAccount(formData);
    },
    null
  );

  // Auto-refresh when syncing
  useEffect(() => {
    if (repository?.sync_status === "syncing") {
      const interval = setInterval(() => {
        router.refresh();
      }, 3000); // Refresh every 3 seconds

      return () => clearInterval(interval);
    }
  }, [repository?.sync_status, router]);

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
            <dt className="text-sm font-medium text-gray-500">Public URL</dt>
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

      {/* Git Repository Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Git Repository</h2>

        {!repository ? (
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">
              No repository connected yet
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Connect your Logseq graph repository to get started
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Repository URL
                </dt>
                <dd className="mt-1 text-sm font-mono break-all">
                  {repository.repo_url}
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
                      repository.sync_status === "success"
                        ? "bg-green-100 text-green-800"
                        : repository.sync_status === "error"
                          ? "bg-red-100 text-red-800"
                          : repository.sync_status === "syncing"
                            ? "bg-blue-100 text-blue-800 animate-pulse"
                            : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {repository.sync_status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Last Sync
                </dt>
                <dd className="mt-1 text-sm">
                  {repository.last_sync
                    ? new Date(repository.last_sync).toLocaleString()
                    : "Never"}
                </dd>
              </div>
            </dl>

            {repository.error_log && (
              <div className={`p-4 border rounded-md ${
                errorIsStale
                  ? "bg-gray-50 border-gray-200"
                  : "bg-red-50 border-red-200"
              }`}>
                <div className="flex items-start justify-between mb-2">
                  <p className={`text-sm font-medium ${
                    errorIsStale ? "text-gray-600" : "text-red-800"
                  }`}>
                    {errorIsStale ? "Previous Error (Resolved):" : "Last Error:"}
                  </p>
                  {repository.updated_at && (
                    <p className={`text-xs ${
                      errorIsStale ? "text-gray-500" : "text-red-600"
                    }`}>
                      {new Date(repository.updated_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <pre className={`text-xs whitespace-pre-wrap ${
                  errorIsStale ? "text-gray-600" : "text-red-700"
                }`}>
                  {repository.error_log}
                </pre>
              </div>
            )}

            <div className="flex gap-3">
              <form action={triggerDeployment}>
                <button
                  type="submit"
                  disabled={repository.sync_status === "syncing"}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {repository.sync_status === "syncing" ? "Deploying..." : "Trigger Deployment"}
                </button>
              </form>
            </div>
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
                  <p className="text-sm font-mono">{deployment.commit_sha.slice(0, 7)}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(deployment.deployed_at).toLocaleString()}
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

      {/* Advanced Settings */}
      <div className="bg-white rounded-lg border border-gray-200">
        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
        >
          <h2 className="text-xl font-semibold">Advanced Settings</h2>
          <span className="text-gray-400">
            {settingsOpen ? "−" : "+"}
          </span>
        </button>

        {settingsOpen && (
          <div className="px-6 pb-6 space-y-6 border-t border-gray-200 pt-6">
            {/* Repository Connection Form */}
            {!repository && (
              <div>
                <h3 className="text-lg font-medium mb-4">Connect Repository</h3>

                {connectState && !connectState.success && connectState.error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-md mb-4">
                    <p className="text-sm text-red-800">{connectState.error}</p>
                  </div>
                )}

                <form action={connectAction} className="space-y-4">
                  <div>
                    <label htmlFor="repoUrl" className="block text-sm font-medium mb-1">
                      GitHub Repository URL
                    </label>
                    <input
                      id="repoUrl"
                      name="repoUrl"
                      type="url"
                      required
                      disabled={connectPending}
                      placeholder="https://github.com/username/logseq-graph"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black disabled:opacity-50"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Your Logseq graph repository
                    </p>
                  </div>

                  <div>
                    <label htmlFor="branch" className="block text-sm font-medium mb-1">
                      Branch
                    </label>
                    <input
                      id="branch"
                      name="branch"
                      type="text"
                      required
                      disabled={connectPending}
                      defaultValue="main"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black disabled:opacity-50"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Branch will be auto-detected if it doesn&apos;t exist
                    </p>
                  </div>

                  <div>
                    <label htmlFor="accessToken" className="block text-sm font-medium mb-1">
                      GitHub Personal Access Token
                    </label>
                    <input
                      id="accessToken"
                      name="accessToken"
                      type="password"
                      required
                      disabled={connectPending}
                      placeholder="github_pat_..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black disabled:opacity-50"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      <strong>Security:</strong> Use{" "}
                      <a
                        href="https://github.com/settings/tokens?type=beta"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline font-medium"
                      >
                        fine-grained tokens
                      </a>{" "}
                      with read-only access to your Logseq repository only.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={connectPending}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {connectPending ? "Connecting..." : "Connect Repository"}
                  </button>
                </form>
              </div>
            )}

            {/* Danger Zone */}
            <div className="border-t border-red-200 pt-6">
              <h3 className="text-lg font-medium mb-4 text-red-600">Danger Zone</h3>
              <p className="text-sm text-gray-600 mb-4">
                Once you delete your account, there is no going back. This will
                permanently delete your workspace, all content, repository
                connections, and deployment history.
              </p>

              {deleteState && !deleteState.success && deleteState.error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-md mb-4">
                  <p className="text-sm text-red-800">{deleteState.error}</p>
                </div>
              )}

              <form action={deleteAction} className="space-y-4">
                <div>
                  <label htmlFor="confirmation" className="block text-sm font-medium mb-1">
                    Type your username to confirm: <strong>{user.username}</strong>
                  </label>
                  <input
                    id="confirmation"
                    name="confirmation"
                    type="text"
                    required
                    disabled={deletePending}
                    placeholder={user.username}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-300 focus:border-red-400 disabled:opacity-50"
                  />
                </div>

                <button
                  type="submit"
                  disabled={deletePending}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletePending ? "Deleting..." : "Delete Account Permanently"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
