import { requireAuth } from "@/lib/session";
import { getWorkspaceByUserId } from "@/modules/workspace/queries";
import { logout } from "@/modules/auth/session-actions";
import Link from "next/link";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();
  const workspace = await getWorkspaceByUserId(user.id);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-xl font-bold">
                Draehi
              </Link>
              {workspace && (
                <span className="ml-4 text-sm text-gray-500">
                  {workspace.name}
                </span>
              )}
            </div>

            <div className="flex items-center space-x-4">
              {workspace && (
                <Link
                  href={`/${workspace.slug}`}
                  target="_blank"
                  className="text-sm text-gray-600 hover:text-black"
                >
                  View Site →
                </Link>
              )}
              <span className="text-sm text-gray-600">{user.username}</span>
              <form action={logout}>
                <button
                  type="submit"
                  className="text-sm text-gray-600 hover:text-black"
                >
                  Logout
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
