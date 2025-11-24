"use server";

import { query, queryOne } from "@/lib/surreal";
import { type GitRepository, type Deployment } from "./schema";
import { workspaceRecordId } from "../workspace/schema";
import { cache } from "react";

export const getRepositoryByWorkspaceId = cache(
  async (workspaceId: string): Promise<GitRepository | null> => {
    return await queryOne<GitRepository>(
      "SELECT * FROM git_repositories WHERE workspace = $ws LIMIT 1",
      { ws: workspaceId }  // Pass workspaceId directly - SurrealDB SDK handles RecordId
    );
  }
);

export const getDeployments = cache(
  async (workspaceId: string, limit = 10): Promise<Deployment[]> => {
    return await query<Deployment>(
      "SELECT * FROM deployment_history WHERE workspace = $ws ORDER BY deployed_at DESC LIMIT $limit",
      { ws: workspaceId, limit }  // Pass workspaceId directly - SurrealDB SDK handles RecordId
    );
  }
);

export const getLatestDeployment = cache(
  async (workspaceId: string): Promise<Deployment | null> => {
    return await queryOne<Deployment>(
      "SELECT * FROM deployment_history WHERE workspace = $ws ORDER BY deployed_at DESC LIMIT 1",
      { ws: workspaceId }  // Pass workspaceId directly - SurrealDB SDK handles RecordId
    );
  }
);
