// TODO: Consider migrating to shadcn/ui Breadcrumb component
import Link from "next/link";
import type { Breadcrumb } from "@/lib/types";

type BreadcrumbsProps = {
  items: Breadcrumb[];
};

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-600">
      {items.map((item, index) => (
        <div key={item.href} className="flex items-center space-x-2">
          {index > 0 && (
            <span className="text-gray-400">/</span>
          )}
          <Link
            href={item.href}
            className="hover:text-gray-900 transition-colors"
          >
            {item.title}
          </Link>
        </div>
      ))}
    </nav>
  );
}
