"use server";

import { db } from "@/lib/db";
import { workspaces, type NewWorkspace } from "./schema";
import { getWorkspaceByUserId } from "./queries";
import { slugify } from "@/lib/utils";
import { eq } from "drizzle-orm";

export async function createWorkspace(userId: number, name: string) {
  // Check if user already has a workspace
  const existing = await getWorkspaceByUserId(userId);
  if (existing) {
    return { error: "User already has a workspace" };
  }

  const slug = slugify(name);

  const [workspace] = await db
    .insert(workspaces)
    .values({
      userId,
      slug,
      name,
    })
    .returning();

  return { workspace };
}

export async function updateWorkspace(
  id: number,
  data: { name?: string; domain?: string }
) {
  const [workspace] = await db
    .update(workspaces)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, id))
    .returning();

  return { workspace };
}
