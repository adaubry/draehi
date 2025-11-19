import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

export function extractNamespaceAndSlug(pageName: string): {
  slug: string;
  namespace: string;
  depth: number;
} {
  const segments = pageName.split("/");
  // Slugify each segment to ensure lowercase URLs
  const slugifiedSegments = segments.map((s) => slugify(s));
  return {
    slug: slugifiedSegments[slugifiedSegments.length - 1],
    namespace: slugifiedSegments.slice(0, -1).join("/"),
    depth: segments.length - 1,
  };
}

export function buildNodeHref(
  workspaceSlug: string,
  pathSegments: string[]
): string {
  return `/${workspaceSlug}/${pathSegments.join("/")}`;
}
