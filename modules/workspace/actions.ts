"use server";

import { query, update } from "@/lib/surreal";
import { type Workspace, workspaceRecordId } from "./schema";
import { getWorkspaceByUserId } from "./queries";
import { slugify } from "@/lib/utils";

export async function createWorkspace(userId: string | unknown, name: string) {
  try {
    // Check if user already has a workspace
    const existing = await getWorkspaceByUserId(userId);
    if (existing) {
      return { error: "User already has a workspace" };
    }

    const slug = slugify(name);

    // Create workspace - pass userId directly as parameter
    // SurrealDB SDK will handle the record reference conversion
    const result = await query<Workspace>(
      `CREATE workspaces CONTENT {
        user: $userId,
        slug: $slug,
        name: $name,
        embed_depth: 5
      } RETURN *;`,
      { userId, slug, name }
    );

    const workspace = result?.[0];
    if (!workspace) {
      return { error: "Failed to create workspace" };
    }

    return { workspace };
  } catch (error) {
    console.error("Workspace creation failed:", error);
    return { error: "Failed to create workspace" };
  }
}

export async function updateWorkspace(
  id: string,
  data: { name?: string; domain?: string }
) {
  const workspaceId = workspaceRecordId(id);

  const updates: string[] = ["updated_at = time::now()"];
  const params: Record<string, unknown> = { thing: workspaceId };

  if (data.name) {
    updates.push("name = $name");
    params.name = data.name;
  }
  if (data.domain !== undefined) {
    updates.push("domain = $domain");
    params.domain = data.domain;
  }

  const updateQuery = "UPDATE $thing SET " + updates.join(", ") + " RETURN *;";
  const result = await query<Workspace>(updateQuery, params);
  const workspace = result[0];

  return { workspace };
}
