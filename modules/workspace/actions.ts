"use server";

import { create, update } from "@/lib/surreal";
import { type Workspace, type NewWorkspace, workspaceRecordId } from "./schema";
import { userRecordId } from "../auth/schema";
import { getWorkspaceByUserId } from "./queries";
import { slugify } from "@/lib/utils";

export async function createWorkspace(userId: string, name: string) {
  // Check if user already has a workspace
  const existing = await getWorkspaceByUserId(userId);
  if (existing) {
    return { error: "User already has a workspace" };
  }

  const slug = slugify(name);

  const workspace = await create<Workspace>("workspaces", {
    user: userRecordId(userId),
    slug,
    name,
    embed_depth: 5,
  });

  return { workspace };
}

export async function updateWorkspace(
  id: string,
  data: { name?: string; domain?: string }
) {
  const workspace = await update<Workspace>(workspaceRecordId(id), {
    ...data,
    updated_at: new Date().toISOString(),
  });

  return { workspace };
}
