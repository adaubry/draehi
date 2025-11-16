"use server";

import { db } from "@/lib/db";
import { workspaces } from "./schema";
import { eq } from "drizzle-orm";
import { cache } from "react";

export const getWorkspaceById = cache(async (id: number) => {
  return await db.query.workspaces.findFirst({
    where: eq(workspaces.id, id),
  });
});

export const getWorkspaceBySlug = cache(async (slug: string) => {
  return await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, slug),
  });
});

export const getWorkspaceByUserId = cache(async (userId: number) => {
  return await db.query.workspaces.findFirst({
    where: eq(workspaces.userId, userId),
  });
});
