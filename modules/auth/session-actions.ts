"use server";

import { redirect } from "next/navigation";

/**
 * AUTH0 LOGIN: Redirects to Auth0
 * Auth0 API routes handle authentication, returns via /api/auth/callback
 */
export async function login(): Promise<void> {
  redirect("/api/auth/login");
}

/**
 * AUTH0 SIGNUP: Redirects to Auth0 signup
 * Auth0 API routes handle registration, returns via /api/auth/callback
 */
export async function signup(): Promise<void> {
  redirect("/api/auth/login?screen_hint=signup");
}

/**
 * AUTH0 LOGOUT: Clears session and redirects to Auth0 logout
 */
export async function logout(): Promise<void> {
  redirect("/api/auth/logout");
}
