"use server";

import { db } from "@/lib/db";
import { nodes } from "./schema";
import { eq, and, desc } from "drizzle-orm";
import { cache } from "react";
import type { Breadcrumb } from "@/lib/types";
import { buildNodeHref } from "@/lib/utils";

export const getNodeById = cache(async (id: number) => {
  "use cache";
  return await db.query.nodes.findFirst({
    where: eq(nodes.id, id),
  });
});

export const getNodeByPath = cache(
  async (workspaceId: number, pathSegments: string[]) => {
    "use cache";
    const slug = pathSegments.at(-1) || "";
    const namespace = pathSegments.slice(0, -1).join("/");

    // Only return page nodes (blocks also have namespace/slug but shouldn't be returned here)
    return await db.query.nodes.findFirst({
      where: and(
        eq(nodes.workspaceId, workspaceId),
        eq(nodes.namespace, namespace),
        eq(nodes.slug, slug),
        eq(nodes.nodeType, "page")
      ),
    });
  }
);

export const getNodeChildren = cache(
  async (workspaceId: number, namespace: string) => {
    "use cache";
    return await db.query.nodes.findMany({
      where: and(
        eq(nodes.workspaceId, workspaceId),
        eq(nodes.namespace, namespace)
      ),
      orderBy: [nodes.title],
    });
  }
);

export const getAllNodes = cache(async (workspaceId: number) => {
  "use cache";
  // Only return page nodes for navigation (not individual blocks)
  return await db.query.nodes.findMany({
    where: and(eq(nodes.workspaceId, workspaceId), eq(nodes.nodeType, "page")),
    orderBy: [nodes.namespace, nodes.slug],
  });
});

export const getJournalNodes = cache(async (workspaceId: number) => {
  "use cache";
  // Only return journal page nodes (not blocks)
  return await db.query.nodes.findMany({
    where: and(
      eq(nodes.workspaceId, workspaceId),
      eq(nodes.nodeType, "page"),
      eq(nodes.isJournal, true)
    ),
    orderBy: [desc(nodes.journalDate)],
  });
});

export const getPageBlocks = cache(async (pageId: number) => {
  "use cache";
  return await db.query.nodes.findMany({
    where: and(eq(nodes.parentId, pageId), eq(nodes.nodeType, "block")),
    orderBy: [nodes.order],
  });
});

export const getAllBlocksForPage = cache(
  async (workspaceId: number, pageName: string) => {
    "use cache";
    // Get page node AND all blocks that belong to this page
    // BlockTree needs the page node to identify top-level blocks
    return await db.query.nodes.findMany({
      where: and(
        eq(nodes.workspaceId, workspaceId),
        eq(nodes.pageName, pageName)
      ),
      orderBy: [nodes.order],
    });
  }
);

export async function getNodeBreadcrumbs(
  node: { workspaceId: number; namespace: string },
  workspaceSlug: string
): Promise<Breadcrumb[]> {
  if (!node.namespace) return [];

  const segments = node.namespace.split("/");
  const breadcrumbs: Breadcrumb[] = [];

  for (let i = 0; i < segments.length; i++) {
    const slug = segments[i];
    const namespace = segments.slice(0, i).join("/");

    const breadcrumbNode = await db.query.nodes.findFirst({
      where: and(
        eq(nodes.workspaceId, node.workspaceId),
        eq(nodes.namespace, namespace),
        eq(nodes.slug, slug)
      ),
    });

    if (breadcrumbNode) {
      breadcrumbs.push({
        title: breadcrumbNode.title,
        slug: breadcrumbNode.slug,
        href: buildNodeHref(workspaceSlug, [...segments.slice(0, i), slug]),
      });
    }
  }

  return breadcrumbs;
}

export const getPageBacklinks = cache(
  async (workspaceId: number, pageName: string) => {
    "use cache";
    // Find all blocks that reference this page via [[pageName]]
    const allBlocks = await db.query.nodes.findMany({
      where: and(
        eq(nodes.workspaceId, workspaceId),
        eq(nodes.nodeType, "block")
      ),
    });

    // Filter blocks that contain [[pageName]] reference
    const referencingBlocks = allBlocks.filter((block) =>
      block.html?.includes(`data-page="${pageName}"`)
    );

    // Get unique page names
    const uniquePageNames = [
      ...new Set(referencingBlocks.map((b) => b.pageName)),
    ];

    // Fetch the actual page nodes
    const referencingPages = await db.query.nodes.findMany({
      where: and(
        eq(nodes.workspaceId, workspaceId),
        eq(nodes.nodeType, "page")
      ),
    });

    return referencingPages.filter((p) =>
      uniquePageNames.includes(p.pageName)
    );
  }
);

export const getBlockBacklinks = cache(
  async (workspaceId: number, pageName: string) => {
    "use cache";
    // Find all blocks on this page that have UUIDs
    const pageBlocks = await db.query.nodes.findMany({
      where: and(
        eq(nodes.workspaceId, workspaceId),
        eq(nodes.pageName, pageName),
        eq(nodes.nodeType, "block")
      ),
    });

    const blockUuids = pageBlocks
      .map((b) => b.blockUuid)
      .filter((uuid): uuid is string => !!uuid);

    if (blockUuids.length === 0) {
      return [];
    }

    // Find all blocks that reference any of these block UUIDs
    const allBlocks = await db.query.nodes.findMany({
      where: and(
        eq(nodes.workspaceId, workspaceId),
        eq(nodes.nodeType, "block")
      ),
    });

    const referencingBlocks = allBlocks.filter((block) =>
      blockUuids.some((uuid) => block.html?.includes(`data-block-uuid="${uuid}"`))
    );

    // Get unique page names (excluding self-references)
    const uniquePageNames = [
      ...new Set(
        referencingBlocks
          .filter((b) => b.pageName !== pageName)
          .map((b) => b.pageName)
      ),
    ];

    // Fetch the actual page nodes
    const referencingPages = await db.query.nodes.findMany({
      where: and(
        eq(nodes.workspaceId, workspaceId),
        eq(nodes.nodeType, "page")
      ),
    });

    return referencingPages.filter((p) =>
      uniquePageNames.includes(p.pageName)
    );
  }
);
