import { requireAuth } from "@/lib/session";
import { getWorkspaceByUserId } from "@/modules/workspace/queries";
import { getRepositoryByWorkspaceId } from "@/modules/git/queries";
import { connectRepository } from "@/modules/git/actions";

export default async function SettingsPage() {
  const user = await requireAuth();
  const workspace = await getWorkspaceByUserId(user.id);

  if (!workspace) {
    return <div>No workspace found</div>;
  }

  const repository = await getRepositoryByWorkspaceId(workspace.id);

  async function handleConnect(formData: FormData) {
    "use server";

    // Re-fetch workspace to avoid closure issues
    const user = await requireAuth();
    const workspace = await getWorkspaceByUserId(user.id);

    if (!workspace) {
      throw new Error("No workspace found");
    }

    const repoUrl = formData.get("repoUrl") as string;
    const branch = formData.get("branch") as string;
    const accessToken = formData.get("accessToken") as string;

    if (!repoUrl || !branch || !accessToken) {
      throw new Error("All fields required");
    }

    const result = await connectRepository(
      workspace.id,
      repoUrl,
      branch,
      accessToken
    );

    if (result.error) {
      throw new Error(result.error);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="mt-2 text-gray-600">
          Manage your workspace and Git repository
        </p>
      </div>

      {/* Workspace Settings */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Workspace</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">Name</dt>
            <dd className="mt-1 text-sm">{workspace.name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Slug</dt>
            <dd className="mt-1 text-sm font-mono">{workspace.slug}</dd>
          </div>
        </dl>
      </div>

      {/* Git Repository */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Git Repository</h2>

        {repository ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800">
                ✓ Repository connected
              </p>
            </div>

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

            {repository.errorLog && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm font-medium text-red-800 mb-2">
                  Last Error:
                </p>
                <pre className="text-xs text-red-700 whitespace-pre-wrap">
                  {repository.errorLog}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <form action={handleConnect} className="space-y-4">
            <div>
              <label
                htmlFor="repoUrl"
                className="block text-sm font-medium mb-1"
              >
                GitHub Repository URL
              </label>
              <input
                id="repoUrl"
                name="repoUrl"
                type="url"
                required
                placeholder="https://github.com/username/logseq-graph"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black"
              />
              <p className="mt-1 text-xs text-gray-500">
                Your Logseq graph repository
              </p>
            </div>

            <div>
              <label
                htmlFor="branch"
                className="block text-sm font-medium mb-1"
              >
                Branch
              </label>
              <input
                id="branch"
                name="branch"
                type="text"
                required
                defaultValue="main"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black"
              />
              <p className="mt-1 text-xs text-gray-500">
                Default: main
              </p>
            </div>

            <div>
              <label
                htmlFor="accessToken"
                className="block text-sm font-medium mb-1"
              >
                GitHub Personal Access Token
              </label>
              <input
                id="accessToken"
                name="accessToken"
                type="password"
                required
                placeholder="ghp_..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black"
              />
              <p className="mt-1 text-xs text-gray-500">
                Create a token at{" "}
                <a
                  href="https://github.com/settings/tokens/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  github.com/settings/tokens
                </a>{" "}
                with &quot;repo&quot; scope
              </p>
            </div>

            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black"
            >
              Connect Repository
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
