"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { createUser, verifyPassword } from "./actions";
import { createWorkspace } from "@/modules/workspace/actions";
import { slugify } from "@/lib/utils";

export async function login(formData: FormData): Promise<void> {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!username || !password) {
    throw new Error("Username and password required");
  }

  const result = await verifyPassword(username, password);
  if (result.error) {
    throw new Error(result.error);
  }

  const user = result.user!;
  const session = await getSession();
  session.userId = user.id;
  session.username = user.username;
  session.isLoggedIn = true;
  await session.save();

  redirect("/dashboard");
}

export async function signup(formData: FormData): Promise<void> {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;
  const workspaceName = formData.get("workspaceName") as string;

  if (!username || !password || !workspaceName) {
    throw new Error("All fields required");
  }

  // Create user
  const userResult = await createUser(username, password);
  if (userResult.error) {
    throw new Error(userResult.error);
  }

  const user = userResult.user!;

  // Create workspace
  const workspaceResult = await createWorkspace(user.id, workspaceName);
  if (workspaceResult.error) {
    throw new Error(workspaceResult.error);
  }

  // Log in
  const session = await getSession();
  session.userId = user.id;
  session.username = user.username;
  session.isLoggedIn = true;
  await session.save();

  redirect("/dashboard");
}

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect("/");
}
