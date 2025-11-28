"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

type TOCProps = {
  workspaceSlug: string;
};

type TOCItem = {
  uuid: string;
  title: string;
  level: number;
  children: TOCItem[];
};

function TOCItemComponent({ item }: { item: TOCItem }) {
  const [isOpen, setIsOpen] = useState(item.level === 2);

  const hasChildren = item.children.length > 0;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const element = document.querySelector(`[uuid="${item.uuid}"]`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const indentLevel = item.level - 2;
  const indent = indentLevel * 16;

  return (
    <div>
      <div className="flex items-center space-x-1">
        {hasChildren && (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center justify-center w-4 h-4 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
            aria-label={isOpen ? "Collapse" : "Expand"}
          >
            <svg
              className={`w-3 h-3 transition-transform ${
                isOpen ? "rotate-90" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        )}
        {!hasChildren && <div className="w-4 shrink-0" />}

        <button
          onClick={handleClick}
          className="text-left text-sm text-gray-700 hover:text-blue-600 transition-colors truncate flex-1"
        >
          {item.title}
        </button>
      </div>

      {hasChildren && isOpen && (
        <div
          className="space-y-1 mt-1"
          style={{ marginLeft: `${indent + 8}px` }}
        >
          {item.children.map((child) => (
            <TOCItemComponent key={child.uuid} item={child} />
          ))}
        </div>
      )}
    </div>
  );
}

export function TableOfContents({ workspaceSlug }: TOCProps) {
  const pathname = usePathname();
  const [tocItems, setTocItems] = useState<TOCItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset state when pathname changes
    setLoading(true);
    setError(null);
    setTocItems([]);

    // Extract page path from pathname
    // Format: /{workspaceSlug}/{...path}
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
      console.log("[Display] TOC: Insufficient segments in pathname:", segments);
      setLoading(false);
      return;
    }

    const pagePath = segments.slice(1).join("/");
    console.log("[Display] TOC: Fetching for pagePath:", pagePath);

    // Fetch block headings from API
    fetch(`/api/toc?workspace=${workspaceSlug}&path=${encodeURIComponent(pagePath)}`)
      .then((res) => {
        console.log("[Display] TOC: API response status:", res.status);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const { items, pageTitle } = data;

        console.log("[Display] TOC: Page title:", pageTitle);
        console.log("[Display] TOC: Received items:", items?.length || 0);

        // Convert API items to TOC items with hierarchy
        if (items && items.length > 0) {
          const tocItems: TOCItem[] = items.map((item: any) => ({
            uuid: item.uuid,
            title: item.title,
            level: item.level,
            children: [],
          }));
          setTocItems(tocItems);
          console.log("[Display] TOC: Built tree from block headings");
        } else {
          console.log("[Display] TOC: No blocks with headings found");
          setTocItems([]);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("[Display] TOC: Fetch error:", err);
        setError(err.message);
        setLoading(false);
      });
  }, [pathname, workspaceSlug]);

  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          On This Page
        </h3>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-6 bg-gray-200 animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-4 text-sm text-red-600">
        Error loading TOC: {error}
      </div>
    );
  }

  if (tocItems.length === 0) {
    return (
      <div className="px-3 py-4 text-sm text-gray-500 italic">
        No table of contents
      </div>
    );
  }

  return (
    <nav className="space-y-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        On This Page
      </h3>
      <div className="space-y-1 text-sm">
        {tocItems.map((item) => (
          <TOCItemComponent key={item.uuid} item={item} />
        ))}
      </div>
    </nav>
  );
}
