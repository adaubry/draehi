"use client";

import Link from "next/link";
import { useNavigationHistory } from "@/lib/navigation-context";

type BreadcrumbsProps = {
  currentTitle: string;
  workspaceSlug: string;
};

/**
 * N-2 breadcrumb component showing navigation history
 * Format: ../[n-2-page]/[current-page]
 * - ".." button links to n-2 path or workspace root if unavailable
 * - Shows at most 2 past pages in breadcrumb
 */
export function Breadcrumbs({ currentTitle, workspaceSlug }: BreadcrumbsProps) {
  const history = useNavigationHistory();

  // Extract page titles from paths
  const getPageTitle = (path: string): string => {
    if (!path || path === `/${workspaceSlug}`) return workspaceSlug;
    const segments = path.split("/").filter(Boolean);
    if (segments.length <= 1) return workspaceSlug;
    // Return the last segment (current page)
    return segments[segments.length - 1]
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");
  };

  const n2Title = history.n2Path ? getPageTitle(history.n2Path) : null;
  const n2Link = history.n2Path || `/${workspaceSlug}`;

  return (
    <nav className="flex items-center space-x-1 text-sm text-gray-600">
      {/* Back button */}
      <Link
        href={n2Link}
        className="inline-flex items-center px-2.5 py-1.5 rounded-md hover:bg-gray-100 hover:text-gray-900 transition-colors font-medium text-gray-700"
        title={n2Title ? `Back to ${n2Title}` : "Back to workspace"}
      >
        ←
      </Link>

      <span className="text-gray-400">/</span>

      {/* N-2 page link (if available) */}
      {n2Title && (
        <>
          <Link
            href={n2Link}
            className="hover:text-gray-900 transition-colors max-w-[120px] truncate"
          >
            {n2Title}
          </Link>
          <span className="text-gray-400">/</span>
        </>
      )}

      {/* Current page (not a link) */}
      <span className="font-medium text-gray-900 max-w-[200px] truncate">
        {currentTitle}
      </span>
    </nav>
  );
}
