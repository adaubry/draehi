"use client";

import Link from "next/link";
import { useNavigationHistory } from "@/lib/navigation-context";

type BreadcrumbsProps = {
  currentTitle: string;
  workspaceSlug: string;
};

/**
 * Breadcrumb component with blockchain navigation pattern
 * Format: .. / [n-2 page] / [current page]
 * Uses before/after to derive full breadcrumb chain:
 * - ".." links to homepage (workspace root)
 * - middle segment is from history.before (n-2 page)
 * - current segment is current page title
 */
export function Breadcrumbs({ currentTitle, workspaceSlug }: BreadcrumbsProps) {
  const history = useNavigationHistory();

  // Extract page title from path
  const getPageTitle = (path: string | null): string | null => {
    if (!path || path === `/${workspaceSlug}`) return null;
    const segments = path.split("/").filter(Boolean);
    if (segments.length <= 1) return null;
    // Return the last segment (current page)
    return segments[segments.length - 1]
      .split("-")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");
  };

  const homepageLink = `/${workspaceSlug}`;
  const previousPageTitle = getPageTitle(history.before);

  return (
    <nav className="flex items-center space-x-1 text-sm text-gray-600">
      {/* Homepage link */}
      <Link
        href={homepageLink}
        className="inline-flex items-center px-2.5 py-1.5 rounded-md hover:bg-gray-100 hover:text-gray-900 transition-colors font-medium text-gray-700"
        title="Back to homepage"
      >
        ..
      </Link>

      <span className="text-gray-400">/</span>

      {/* N-2 page link (if available) */}
      {previousPageTitle && history.before && (
        <>
          <Link
            href={history.before}
            className="hover:text-gray-900 transition-colors max-w-[120px] truncate"
          >
            {previousPageTitle}
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
