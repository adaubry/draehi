export default function WorkspaceLoading() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header Skeleton */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur">
        <div className="container flex h-14 items-center px-4">
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
      </header>

      <div className="container flex-1">
        <div className="flex gap-6 ">
          {/* Sidebar Skeleton */}
          <aside className="w-64 shrink-0">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                <div className="space-y-1">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="h-8 bg-gray-100 rounded animate-pulse"
                    />
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content Skeleton */}
          <main className="flex-1 max-w-4xl space-y-6">
            {/* Title */}
            <div className="h-10 w-3/4 bg-gray-200 rounded animate-pulse" />

            {/* Content */}
            <div className="space-y-3">
              <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-gray-100 rounded animate-pulse" />
              <div className="h-4 w-4/5 bg-gray-100 rounded animate-pulse" />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
