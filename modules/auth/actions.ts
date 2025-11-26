"use server";

import { query, remove } from "@/lib/surreal";
import { type User } from "./schema";
import { createWorkspace } from "@/modules/workspace/actions";

/**
 * AUTH0 SYNC: Create/update user in SurrealDB from Auth0
 * Called by: /app/api/webhooks/auth0/route.ts
 * Auth0 manages auth, we sync identities to SurrealDB
 */
export async function syncAuth0UserToDb(
  auth0Sub: string,
  _email: string,
  nickname: string,
  _name?: string
) {
  try {
    // Check if user already exists by auth0_sub (Auth0 ensures uniqueness)
    const existingResult = await query<User>(
      "SELECT * FROM users WHERE auth0_sub = $auth0Sub LIMIT 1;",
      { auth0Sub }
    );

    const existingArray = existingResult as unknown as any[];
    const existingUser = existingArray?.[0]?.[0];
    if (existingUser) {
      // User exists - ensure they have a workspace
      await ensureWorkspace(existingUser.id, existingUser.username);
      return { user: existingUser };
    }

    // User doesn't exist - create new user
    const result = await query<User>(
      `CREATE users CONTENT {
         auth0_sub: $auth0Sub,
         username: $nickname,
         created_at: time::now()
       }
       RETURN *;`,
      { auth0Sub, nickname }
    );

    const resultArray = result as unknown as any[];
    const user = resultArray?.[0]?.[0];
    if (!user) {
      return { error: "Failed to create user" };
    }

    // Create default workspace for new user
    await ensureWorkspace(user.id, nickname);
    return { user };
  } catch (error) {
    console.error("Auth0 user sync failed:", error);
    return { error: "Failed to sync user" };
  }
}

async function ensureWorkspace(userId: string, username: string): Promise<void> {
  try {
    const workspaceResult = await query<{ id: string }>(
      "SELECT id FROM workspaces WHERE user = $userId LIMIT 1;",
      { userId }
    );
    const workspaceArray = workspaceResult as unknown as any[];
    const hasWorkspace = workspaceArray?.[0]?.[0];

    if (!hasWorkspace) {
      await createWorkspace(userId, username || "My Workspace");
    }
  } catch (error) {
    console.warn("Failed to ensure workspace for user:", error);
  }
}

/**
 * AUTH0 DELETE: Remove user from SurrealDB
 * Called by: /app/api/webhooks/auth0/route.ts (user.deleted event)
 * Cascades deletion to all user workspaces and data
 */
export async function deleteAuth0User(auth0Sub: string) {
  try {
    if (!auth0Sub) {
      return { error: "Auth0 sub required" };
    }

    // Find user by auth0_sub
    const usersResult = await query<{ id: string }>(
      "SELECT id FROM users WHERE auth0_sub = $auth0Sub LIMIT 1;",
      { auth0Sub }
    );

    const usersArray = usersResult as unknown as any[];
    const user = usersArray?.[0]?.[0];
    if (!user) {
      return { success: true }; // Already deleted
    }

    // Cascade delete all user data
    await query(
      "DELETE nodes WHERE workspace IN (SELECT id FROM workspaces WHERE user = $userId);",
      { userId: user.id }
    );

    await query(
      "DELETE git_repositories WHERE workspace IN (SELECT id FROM workspaces WHERE user = $userId);",
      { userId: user.id }
    );

    await query(
      "DELETE deployment_history WHERE workspace IN (SELECT id FROM workspaces WHERE user = $userId);",
      { userId: user.id }
    );

    await query(
      "DELETE workspaces WHERE user = $userId;",
      { userId: user.id }
    );

    // Delete user
    await remove(user.id);

    return { success: true };
  } catch (error) {
    console.error("Auth0 user deletion failed:", error);
    return { error: "Failed to delete user" };
  }
}
