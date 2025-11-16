export default function NodeLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumbs Skeleton */}
      <div className="flex items-center space-x-2">
        <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
        <span className="text-gray-400">/</span>
        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
      </div>

      {/* Page Title Skeleton */}
      <div className="space-y-2">
        <div className="h-10 w-3/4 bg-gray-200 rounded animate-pulse" />
        <div className="flex gap-2">
          <div className="h-6 w-16 bg-gray-100 rounded-full animate-pulse" />
          <div className="h-6 w-20 bg-gray-100 rounded-full animate-pulse" />
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-11/12 bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-10/12 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-9/12 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}
