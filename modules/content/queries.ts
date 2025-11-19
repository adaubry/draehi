"use server";

import { db } from "@/lib/db";
import { nodes } from "./schema";
import { eq, and, desc, isNull, isNotNull } from "drizzle-orm";
import { cache } from "react";
import type { Breadcrumb } from "@/lib/types";
import { buildNodeHref } from "@/lib/utils";

export const getNodeByUuid = cache(async (uuid: string) => {
  "use cache";
  return await db.query.nodes.findFirst({
    where: eq(nodes.uuid, uuid),
  });
});

export const getNodeByPath = cache(
  async (workspaceId: number, pathSegments: string[]) => {
    "use cache";
    const slug = pathSegments.at(-1) || "";
    const namespace = pathSegments.slice(0, -1).join("/");

    // Only return page nodes (parentUuid === null)
    // Blocks also have namespace/slug but shouldn't be returned here
    return await db.query.nodes.findFirst({
      where: and(
        eq(nodes.workspaceId, workspaceId),
        eq(nodes.namespace, namespace),
        eq(nodes.slug, slug),
        isNull(nodes.parentUuid)
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
  // Only return page nodes for navigation (parentUuid === null)
  return await db.query.nodes.findMany({
    where: and(eq(nodes.workspaceId, workspaceId), isNull(nodes.parentUuid)),
    orderBy: [nodes.namespace, nodes.slug],
  });
});

export const getJournalNodes = cache(async (workspaceId: number) => {
  "use cache";
  // Journal detection is removed - return empty array
  // To be implemented with metadata-based detection if needed
  return [];
});

export const getPageBlocks = cache(async (pageUuid: string) => {
  "use cache";
  return await db.query.nodes.findMany({
    where: eq(nodes.parentUuid, pageUuid),
    orderBy: [nodes.order],
  });
});

export const getAllBlocksForPage = cache(
  async (workspaceId: number, pageName: string) => {
    "use cache";
    // Get all blocks for this page (excludes the page node itself)
    // Blocks have parentUuid !== null
    return await db.query.nodes.findMany({
      where: and(
        eq(nodes.workspaceId, workspaceId),
        eq(nodes.pageName, pageName),
        isNotNull(nodes.parentUuid)
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
        isNotNull(nodes.parentUuid)
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

    // Fetch the actual page nodes (parentUuid === null)
    const referencingPages = await db.query.nodes.findMany({
      where: and(
        eq(nodes.workspaceId, workspaceId),
        isNull(nodes.parentUuid)
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
    // Find all blocks on this page (blocks have parentUuid !== null)
    const pageBlocks = await db.query.nodes.findMany({
      where: and(
        eq(nodes.workspaceId, workspaceId),
        eq(nodes.pageName, pageName),
        isNotNull(nodes.parentUuid)
      ),
    });

    const blockUuids = pageBlocks
      .map((b) => b.uuid)
      .filter((uuid): uuid is string => !!uuid);

    if (blockUuids.length === 0) {
      return [];
    }

    // Find all blocks that reference any of these block UUIDs
    const allBlocks = await db.query.nodes.findMany({
      where: and(
        eq(nodes.workspaceId, workspaceId),
        isNotNull(nodes.parentUuid)
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

    // Fetch the actual page nodes (parentUuid === null)
    const referencingPages = await db.query.nodes.findMany({
      where: and(
        eq(nodes.workspaceId, workspaceId),
        isNull(nodes.parentUuid)
      ),
    });

    return referencingPages.filter((p) =>
      uniquePageNames.includes(p.pageName)
    );
  }
);
