"use server";

import { db } from "@/lib/db";
import { users, type NewUser } from "./schema";
import { getUserByUsername } from "./queries";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

export async function createUser(username: string, password: string) {
  // Check if user exists
  const existing = await getUserByUsername(username);
  if (existing) {
    return { error: "Username already exists" };
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user
  const [user] = await db
    .insert(users)
    .values({
      username,
      password: hashedPassword,
    })
    .returning();

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

export async function deleteUser(userId: number) {
  try {
    // Cascading deletes will handle:
    // - workspaces (via ON DELETE CASCADE)
    // - git_repositories (via workspace cascade)
    // - deployment_history (via workspace cascade)
    // - nodes (via workspace cascade)
    await db.delete(users).where(eq(users.id, userId));

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to delete user",
    };
  }
}
