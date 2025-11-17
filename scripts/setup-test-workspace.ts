#!/usr/bin/env tsx

/**
 * Automated test workspace setup
 * Creates test user, workspace, and connects Git repository
 */

import { db } from "../lib/db";
import * as authSchema from "../modules/auth/schema";
import * as workspaceSchema from "../modules/workspace/schema";
import * as gitSchema from "../modules/git/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import { resolve } from "path";

// Load test config
config({ path: resolve(process.cwd(), ".test.env") });

const TEST_USER_USERNAME = process.env.TEST_USER_EMAIL || "testuser";
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || "testpass123";
const TEST_WORKSPACE_SLUG =
  process.env.TEST_WORKSPACE_SLUG || "testuser";
const TEST_WORKSPACE_NAME = process.env.TEST_USER_NAME || "Test User's Workspace";
const TEST_REPO_PATH =
  process.env.TEST_REPO_PATH ||
  resolve(process.cwd(), "test-data/logseq-docs-graph");
const TEST_REPO_BRANCH = process.env.TEST_REPO_BRANCH || "master";

async function setupTestWorkspace() {
  console.log("╔════════════════════════════════════════╗");
  console.log("║  Automated Test Workspace Setup       ║");
  console.log("╚════════════════════════════════════════╝\n");

  try {
    // 1. Check if user exists
    console.log("👤 Checking for existing test user...");
    let user = await db.query.users.findFirst({
      where: eq(authSchema.users.username, TEST_USER_USERNAME),
    });

    if (user) {
      console.log(`   ✅ User already exists: ${user.username} (ID: ${user.id})`);
    } else {
      // Create user
      console.log(`   Creating user: ${TEST_USER_USERNAME}`);
      const hashedPassword = await bcrypt.hash(TEST_USER_PASSWORD, 10);

      const [newUser] = await db
        .insert(authSchema.users)
        .values({
          username: TEST_USER_USERNAME,
          password: hashedPassword,
        })
        .returning();

      user = newUser;
      console.log(`   ✅ User created: ${user.username} (ID: ${user.id})`);
    }

    // 2. Check if workspace exists
    console.log("\n🏢 Checking for existing workspace...");
    let workspace = await db.query.workspaces.findFirst({
      where: eq(workspaceSchema.workspaces.userId, user.id),
    });

    if (workspace) {
      console.log(
        `   ✅ Workspace already exists: ${workspace.slug} (ID: ${workspace.id})`
      );

      // Update slug if different
      if (workspace.slug !== TEST_WORKSPACE_SLUG) {
        console.log(
          `   Updating workspace slug: ${workspace.slug} → ${TEST_WORKSPACE_SLUG}`
        );
        await db
          .update(workspaceSchema.workspaces)
          .set({ slug: TEST_WORKSPACE_SLUG })
          .where(eq(workspaceSchema.workspaces.id, workspace.id));

        workspace = await db.query.workspaces.findFirst({
          where: eq(workspaceSchema.workspaces.id, workspace.id),
        });
      }
    } else {
      // Create workspace
      console.log(`   Creating workspace: ${TEST_WORKSPACE_SLUG}`);

      const [newWorkspace] = await db
        .insert(workspaceSchema.workspaces)
        .values({
          userId: user.id,
          slug: TEST_WORKSPACE_SLUG,
          name: TEST_WORKSPACE_NAME,
          embedDepth: 5,
        })
        .returning();

      workspace = newWorkspace!;
      console.log(
        `   ✅ Workspace created: ${workspace.slug} (ID: ${workspace.id})`
      );
    }

    // 3. Check if Git repository is connected
    console.log("\n📦 Checking Git repository connection...");
    let gitRepo = await db.query.gitRepositories.findFirst({
      where: eq(gitSchema.gitRepositories.workspaceId, workspace!.id),
    });

    const repoUrl = `file://${TEST_REPO_PATH}`;

    if (gitRepo) {
      console.log(`   ✅ Git repository already connected: ${gitRepo.repoUrl}`);

      // Update if URL changed
      if (gitRepo.repoUrl !== repoUrl || gitRepo.branch !== TEST_REPO_BRANCH) {
        console.log("   Updating repository configuration...");
        await db
          .update(gitSchema.gitRepositories)
          .set({
            repoUrl,
            branch: TEST_REPO_BRANCH,
          })
          .where(eq(gitSchema.gitRepositories.id, gitRepo.id));

        console.log(`   ✅ Updated: ${repoUrl} (branch: ${TEST_REPO_BRANCH})`);
      }
    } else {
      // Connect Git repository
      console.log(`   Connecting repository: ${repoUrl}`);

      await db.insert(gitSchema.gitRepositories).values({
        workspaceId: workspace!.id,
        repoUrl,
        branch: TEST_REPO_BRANCH,
        deployKey: null, // Local file:// doesn't need auth
        syncStatus: "pending",
      });

      console.log(
        `   ✅ Repository connected: ${repoUrl} (branch: ${TEST_REPO_BRANCH})`
      );
    }

    // Summary
    console.log("\n╔════════════════════════════════════════╗");
    console.log("║  Setup Complete                        ║");
    console.log("╚════════════════════════════════════════╝\n");

    console.log("📋 Test Configuration:");
    console.log(`   Username:   ${user.username}`);
    console.log(`   Password:   ${TEST_USER_PASSWORD}`);
    console.log(`   Workspace:  ${workspace!.slug}`);
    console.log(`   Repository: ${repoUrl}`);
    console.log(`   Branch:     ${TEST_REPO_BRANCH}`);

    console.log("\n✅ Ready for testing!");
    console.log(`   Login at:   ${process.env.TEST_APP_URL || "http://localhost:3000"}/login`);
    console.log(`   Workspace:  ${process.env.TEST_APP_URL || "http://localhost:3000"}/${workspace!.slug}`);

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Setup failed:", error);
    process.exit(1);
  }
}

setupTestWorkspace();
