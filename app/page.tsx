import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { Suspense } from "react";

async function UserNav() {
  const user = await getCurrentUser();

  if (user) {
    return (
      <Link
        href="/dashboard"
        className="text-sm font-medium text-gray-600 hover:text-black"
      >
        Dashboard
      </Link>
    );
  }

  return (
    <>
      <Link
        href="/login"
        className="text-sm font-medium text-gray-600 hover:text-black"
      >
        Sign in
      </Link>
      <Link
        href="/signup"
        className="text-sm font-medium px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800"
      >
        Get Started
      </Link>
    </>
  );
}

export default async function Home() {

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="text-xl font-bold">Draehi</div>
          <div className="flex items-center space-x-4">
            <Suspense
              fallback={
                <Link
                  href="/login"
                  className="text-sm font-medium text-gray-600 hover:text-black"
                >
                  Sign in
                </Link>
              }
            >
              <UserNav />
            </Suspense>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-5xl font-bold tracking-tight mb-6">
            Deploy your Logseq graph
            <br />
            <span className="text-gray-600">to the web in 60 seconds</span>
          </h1>

          <p className="text-xl text-gray-600 mb-8">
            A Vercel for Logseq graphs. Transform your personal knowledge base
            into a high-performance, SEO-optimized website.
          </p>

          <div className="flex justify-center gap-4">
            <Link
              href="/signup"
              className="px-6 py-3 bg-black text-white rounded-md hover:bg-gray-800 font-medium"
            >
              Get Started Free
            </Link>
            <a
              href="https://github.com/yourusername/draehi"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 border border-gray-300 rounded-md hover:bg-gray-50 font-medium"
            >
              View on GitHub
            </a>
          </div>
        </div>

        {/* Features */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-2">
              Git-based Workflow
            </h3>
            <p className="text-gray-600">
              Push to deploy. No manual exports. Your Git repo is the source
              of truth.
            </p>
          </div>

          <div className="p-6">
            <h3 className="text-lg font-semibold mb-2">
              Lightning Fast
            </h3>
            <p className="text-gray-600">
              Sub-100ms TTFB. Pre-rendered HTML. Optimized for performance.
            </p>
          </div>

          <div className="p-6">
            <h3 className="text-lg font-semibold mb-2">SEO Optimized</h3>
            <p className="text-gray-600">
              Static HTML generation. Perfect for content sites and knowledge
              bases.
            </p>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-24 max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            How it works
          </h2>

          <ol className="space-y-6">
            <li className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-semibold">
                1
              </div>
              <div>
                <h3 className="font-semibold mb-1">Connect your Git repo</h3>
                <p className="text-gray-600">
                  Point Draehi to your Logseq graph repository on GitHub.
                </p>
              </div>
            </li>

            <li className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-semibold">
                2
              </div>
              <div>
                <h3 className="font-semibold mb-1">Push to deploy</h3>
                <p className="text-gray-600">
                  Every push triggers an automatic deployment. No manual work.
                </p>
              </div>
            </li>

            <li className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-semibold">
                3
              </div>
              <div>
                <h3 className="font-semibold mb-1">Your site is live</h3>
                <p className="text-gray-600">
                  Pre-rendered, optimized, and ready for the world to see.
                </p>
              </div>
            </li>
          </ol>
        </div>

        {/* CTA */}
        <div className="mt-24 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to get started?
          </h2>
          <p className="text-gray-600 mb-8">
            Create your account and deploy your first site in minutes.
          </p>
          <Link
            href="/signup"
            className="inline-flex px-6 py-3 bg-black text-white rounded-md hover:bg-gray-800 font-medium"
          >
            Get Started Free
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center text-sm text-gray-600">
            <p>Built with Next.js 16, Drizzle ORM, and PostgreSQL</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
