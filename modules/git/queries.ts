"use server";

import { db } from "@/lib/db";
import { gitRepositories, deploymentHistory } from "./schema";
import { eq, desc } from "drizzle-orm";
import { cache } from "react";

export const getRepositoryByWorkspaceId = cache(async (workspaceId: number) => {
  return await db.query.gitRepositories.findFirst({
    where: eq(gitRepositories.workspaceId, workspaceId),
  });
});

export const getDeployments = cache(async (workspaceId: number, limit = 10) => {
  return await db.query.deploymentHistory.findMany({
    where: eq(deploymentHistory.workspaceId, workspaceId),
    orderBy: [desc(deploymentHistory.deployedAt)],
    limit,
  });
});

export const getLatestDeployment = cache(async (workspaceId: number) => {
  return await db.query.deploymentHistory.findFirst({
    where: eq(deploymentHistory.workspaceId, workspaceId),
    orderBy: [desc(deploymentHistory.deployedAt)],
  });
});
