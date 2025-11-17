#!/usr/bin/env tsx

/**
 * Trigger Git sync for test workspace
 * Simulates the sync process that normally happens via webhook
 */

import { db } from "../lib/db";
import * as gitSchema from "../modules/git/schema";
import * as workspaceSchema from "../modules/workspace/schema";
import { eq } from "drizzle-orm";
import { config } from "dotenv";
import { resolve } from "path";

// Load test config
config({ path: resolve(process.cwd(), ".test.env") });

const TEST_WORKSPACE_SLUG =
  process.env.TEST_WORKSPACE_SLUG || "testuser";

async function triggerSync() {
  console.log("🔄 Triggering Git sync...\n");

  try {
    // Find workspace
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaceSchema.workspaces.slug, TEST_WORKSPACE_SLUG),
    });

    if (!workspace) {
      throw new Error(`Workspace not found: ${TEST_WORKSPACE_SLUG}`);
    }

    console.log(`   Workspace: ${workspace.slug} (ID: ${workspace.id})`);

    // Find Git repository
    const gitRepo = await db.query.gitRepositories.findFirst({
      where: eq(gitSchema.gitRepositories.workspaceId, workspace.id),
    });

    if (!gitRepo) {
      throw new Error(`No Git repository connected to workspace ${workspace.slug}`);
    }

    console.log(`   Repository: ${gitRepo.repoUrl}`);
    console.log(`   Branch: ${gitRepo.branch}`);

    // Update sync status to trigger sync
    console.log("\n   Triggering sync...");

    await db
      .update(gitSchema.gitRepositories)
      .set({
        syncStatus: "syncing",
        lastSync: new Date(),
      })
      .where(eq(gitSchema.gitRepositories.id, gitRepo.id));

    console.log("   ✅ Sync triggered!");
    console.log("\n📝 Note: Actual sync happens via background process/webhook");
    console.log("   Monitor sync status in dashboard or check database");
    console.log(`   Status query: SELECT sync_status FROM git_repositories WHERE id = '${gitRepo.id}';`);

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Sync trigger failed:", error);
    process.exit(1);
  }
}

triggerSync();
