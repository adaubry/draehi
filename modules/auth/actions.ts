"use server";

import { create, remove, query } from "@/lib/surreal";
import { type User, type NewUser, userRecordId } from "./schema";
import { getUserByUsername } from "./queries";
import bcrypt from "bcryptjs";

export async function createUser(username: string, password: string) {
  // Check if user exists
  const existing = await getUserByUsername(username);
  if (existing) {
    return { error: "Username already exists" };
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user
  const user = await create<User>("users", {
    username,
    password: hashedPassword,
  });

  return { user };
}

export async function verifyPassword(username: string, password: string) {
  const user = await getUserByUsername(username);
  if (!user) {
    return { error: "Invalid credentials" };
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return { error: "Invalid credentials" };
  }

  return { user };
}

export async function deleteUser(userId: string) {
  try {
    // Delete user - SurrealDB handles cascading via graph relations
    // We need to manually delete related records since SurrealDB doesn't auto-cascade
    // 1. Find user's workspace
    const workspaces = await query<{ id: string }>(
      "SELECT id FROM workspaces WHERE user = $user",
      { user: userRecordId(userId) }
    );

    for (const workspace of workspaces) {
      // Delete workspace's git repos
      await query("DELETE git_repositories WHERE workspace = $ws", {
        ws: workspace.id,
      });

      // Delete workspace's deployment history
      await query("DELETE deployment_history WHERE workspace = $ws", {
        ws: workspace.id,
      });

      // Delete workspace's nodes
      await query("DELETE nodes WHERE workspace = $ws", {
        ws: workspace.id,
      });

      // Delete workspace
      await remove(workspace.id);
    }

    // Delete user
    await remove(userRecordId(userId));

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to delete user",
    };
  }
}
