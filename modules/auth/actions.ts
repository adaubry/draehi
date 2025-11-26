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
  email: string,
  nickname: string,
  name?: string
) {
  try {
    // Check if user already exists by auth0_sub
    const existingResult = await query<User>(
      "SELECT * FROM users WHERE auth0_sub = $auth0Sub LIMIT 1;",
      { auth0Sub }
    );

    const existingArray = existingResult as unknown as any[];
    const existingUser = existingArray?.[0]?.[0];
    if (existingUser) {
      // User exists - check if they have a workspace
      try {
        const workspaceResult = await query<{ id: string }>(
          "SELECT id FROM workspaces WHERE user = $userId LIMIT 1;",
          { userId: existingUser.id }
        );
        const workspaceArray = workspaceResult as unknown as any[];
        const hasWorkspace = workspaceArray?.[0]?.[0];

        if (!hasWorkspace) {
          // User exists but has no workspace - create one
          const workspaceName = existingUser.username || existingUser.email?.split("@")[0] || "My Workspace";
          await createWorkspace(existingUser.id, workspaceName);
        }
      } catch (error) {
        console.warn("Failed to check/create workspace for existing user:", error);
      }
      return { user: existingUser };
    }

    // Check if email already exists (user might have different auth0_sub)
    const emailCheckResult = await query<User>(
      "SELECT * FROM users WHERE email = $email LIMIT 1;",
      { email }
    );

    const emailCheckArray = emailCheckResult as unknown as any[];
    const existingByEmail = emailCheckArray?.[0]?.[0];
    if (existingByEmail) {
      // User exists with this email but different auth0_sub - update auth0_sub
      console.log("User exists with email but different auth0_sub, updating...");
      const updateResult = await query<User>(
        "UPDATE $thing SET auth0_sub = $auth0Sub RETURN *;",
        { thing: existingByEmail.id, auth0Sub }
      );
      const updatedArray = updateResult as unknown as any[];
      const updatedUser = updatedArray?.[0]?.[0];
      if (updatedUser) {
        // Check if they have a workspace
        try {
          const workspaceResult = await query<{ id: string }>(
            "SELECT id FROM workspaces WHERE user = $userId LIMIT 1;",
            { userId: updatedUser.id }
          );
          const workspaceArray = workspaceResult as unknown as any[];
          const hasWorkspace = workspaceArray?.[0]?.[0];

          if (!hasWorkspace) {
            const workspaceName = updatedUser.username || updatedUser.email?.split("@")[0] || "My Workspace";
            await createWorkspace(updatedUser.id, workspaceName);
          }
        } catch (error) {
          console.warn("Failed to check/create workspace for user:", error);
        }
        return { user: updatedUser };
      }
    }

    // User doesn't exist - create new user
    // Use a random ID suffix since SurrealDB generates table:id format
    const result = await query<User>(
      `CREATE users CONTENT {
         auth0_sub: $auth0Sub,
         email: $email,
         username: $nickname,
         name: $name,
         created_at: time::now()
       }
       RETURN *;`,
      { auth0Sub, email, nickname, name }
    );

    const resultArray = result as unknown as any[];
    const user = resultArray?.[0]?.[0];
    if (!user) {
      return { error: "Failed to create user" };
    }

    // Create default workspace for new user
    try {
      const workspaceName = nickname || email?.split("@")[0] || "My Workspace";
      const workspaceResult = await createWorkspace(user.id, workspaceName);
      if (workspaceResult.error) {
        console.error("Failed to create default workspace:", workspaceResult.error);
      }
    } catch (error) {
      console.error("Failed to create default workspace:", error);
    }

    return { user };
  } catch (error) {
    console.error("Auth0 user sync failed:", error);
    return { error: "Failed to sync user" };
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
