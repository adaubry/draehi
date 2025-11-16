"use server";

import { db } from "@/lib/db";
import { nodes, type NewNode } from "./schema";
import { extractNamespaceAndSlug } from "@/lib/utils";
import { eq, and } from "drizzle-orm";

// Internal only - called during git sync/deployment
export async function upsertNode(
  workspaceId: number,
  pageName: string,
  data: {
    title: string;
    html?: string;
    content?: string;
    metadata?: NewNode["metadata"];
    isJournal?: boolean;
    journalDate?: string; // Date string format
  }
) {
  const { slug, namespace, depth } = extractNamespaceAndSlug(pageName);

  // Check if exists
  const existing = await db.query.nodes.findFirst({
    where: and(
      eq(nodes.workspaceId, workspaceId),
      eq(nodes.namespace, namespace),
      eq(nodes.slug, slug)
    ),
  });

  if (existing) {
    // Update
    const [node] = await db
      .update(nodes)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(nodes.id, existing.id))
      .returning();

    return { node };
  } else {
    // Insert
    const [node] = await db
      .insert(nodes)
      .values({
        workspaceId,
        pageName,
        slug,
        namespace,
        depth,
        ...data,
      })
      .returning();

    return { node };
  }
}

export async function deleteNode(id: number) {
  await db.delete(nodes).where(eq(nodes.id, id));
  return { success: true };
}

export async function deleteAllNodes(workspaceId: number) {
  await db.delete(nodes).where(eq(nodes.workspaceId, workspaceId));
  return { success: true };
}
