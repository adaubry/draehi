"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { createUser, verifyPassword } from "./actions";
import { createWorkspace } from "@/modules/workspace/actions";
import { slugify } from "@/lib/utils";

type ActionState = { error?: string };

export async function login(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!username || !password) {
    return { error: "Username and password required" };
  }

  const result = await verifyPassword(username, password);
  if (result.error) {
    return { error: result.error };
  }

  const user = result.user!;
  const session = await getSession();
  session.userId = user.id;
  session.username = user.username;
  session.isLoggedIn = true;
  await session.save();

  redirect("/dashboard");
}

export async function signup(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;
  const workspaceName = formData.get("workspaceName") as string;

  if (!username || !password || !workspaceName) {
    return { error: "All fields required" };
  }

  // Create user
  const userResult = await createUser(username, password);
  if (userResult.error) {
    return { error: userResult.error };
  }

  const user = userResult.user!;

  // Create workspace
  const workspaceResult = await createWorkspace(user.id, workspaceName);
  if (workspaceResult.error) {
    return { error: workspaceResult.error };
  }

  // Log in
  const session = await getSession();
  session.userId = user.id;
  session.username = user.username;
  session.isLoggedIn = true;
  await session.save();

  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  const session = await getSession();
  session.destroy();
  redirect("/");
}
