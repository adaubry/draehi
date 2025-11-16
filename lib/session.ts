import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import type { User } from "@/modules/auth/schema";

export interface SessionData {
  userId?: number;
  username?: string;
  isLoggedIn: boolean;
}

const sessionOptions = {
  password: process.env.SESSION_SECRET || "",
  cookieName: "draehi_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7, // 1 week
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return null;
  }

  // Import here to avoid circular dependency
  const { getUserById } = await import("@/modules/auth/queries");
  const user = await getUserById(session.userId);
  return user || null;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
