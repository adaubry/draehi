#!/usr/bin/env tsx

/**
 * Cleanup test user and workspace
 * Run before each test to ensure clean state
 */

import { db } from '../lib/db.js';
import { users } from '../modules/auth/schema.js';
import { workspaces } from '../modules/workspace/schema.js';
import { gitRepositories } from '../modules/git/schema.js';
import { nodes } from '../modules/content/schema.js';
import { eq } from 'drizzle-orm';

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'testuser';
const TEST_WORKSPACE_SLUG = process.env.TEST_WORKSPACE_SLUG || 'test';

async function cleanupTestUser() {
  console.log('\n🧹 Cleaning up test user...\n');

  try {
    // Also cleanup orphaned workspaces with test slug (in case user was deleted but workspace wasn't)
    const orphanedWorkspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.slug, TEST_WORKSPACE_SLUG),
    });

    if (orphanedWorkspace) {
      console.log(`Found orphaned workspace: ${orphanedWorkspace.slug} (ID: ${orphanedWorkspace.id})`);

      // Delete associated data
      await db.delete(nodes).where(eq(nodes.workspaceId, orphanedWorkspace.id));
      await db.delete(gitRepositories).where(eq(gitRepositories.workspaceId, orphanedWorkspace.id));
      await db.delete(workspaces).where(eq(workspaces.id, orphanedWorkspace.id));
      console.log(`✓ Deleted orphaned workspace ${orphanedWorkspace.slug}`);
    }

    // Find test user
    const testUser = await db.query.users.findFirst({
      where: eq(users.username, TEST_USER_EMAIL),
    });

    if (!testUser) {
      console.log('✓ No test user found - clean state');
      process.exit(0);
    }

    console.log(`Found test user: ${testUser.username} (ID: ${testUser.id})`);

    // Find workspace
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.userId, testUser.id),
    });

    if (workspace) {
      console.log(`Found workspace: ${workspace.slug} (ID: ${workspace.id})`);

      // Delete nodes (cascades from workspace)
      await db.delete(nodes).where(eq(nodes.workspaceId, workspace.id));
      console.log(`✓ Deleted nodes for workspace ${workspace.id}`);

      // Delete git repositories (cascades from workspace)
      await db.delete(gitRepositories).where(eq(gitRepositories.workspaceId, workspace.id));
      console.log(`✓ Deleted git repositories for workspace ${workspace.id}`);

      // Delete workspace
      await db.delete(workspaces).where(eq(workspaces.id, workspace.id));
      console.log(`✓ Deleted workspace ${workspace.slug}`);
    }

    // Delete user
    await db.delete(users).where(eq(users.id, testUser.id));
    console.log(`✓ Deleted user ${testUser.username}`);

    console.log('\n✅ Cleanup complete - ready for fresh test\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  }
}

cleanupTestUser();
