"use server";

import { queryOne, selectOne } from "@/lib/surreal";
import { type Workspace, workspaceRecordId } from "./schema";
import { userRecordId } from "../auth/schema";
import { cache } from "react";

export const getWorkspaceById = cache(
  async (id: string): Promise<Workspace | null> => {
    return await selectOne<Workspace>(workspaceRecordId(id));
  }
);

export const getWorkspaceBySlug = cache(
  async (slug: string): Promise<Workspace | null> => {
    return await queryOne<Workspace>(
      "SELECT * FROM workspaces WHERE slug = $slug LIMIT 1",
      { slug }
    );
  }
);

export const getWorkspaceByUserId = cache(
  async (userId: string | unknown): Promise<Workspace | null> => {
    // Pass userId directly - SurrealDB SDK handles RecordId comparison
    // userId can be a RecordId object or string, both work in query parameters
    return await queryOne<Workspace>(
      "SELECT * FROM workspaces WHERE user = $user LIMIT 1",
      { user: userId }
    );
  }
);
