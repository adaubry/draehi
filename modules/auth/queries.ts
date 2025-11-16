"use server";

import { db } from "@/lib/db";
import { users } from "./schema";
import { eq } from "drizzle-orm";
import { cache } from "react";

export const getUserById = cache(async (id: number) => {
  return await db.query.users.findFirst({
    where: eq(users.id, id),
  });
});

export const getUserByUsername = cache(async (username: string) => {
  return await db.query.users.findFirst({
    where: eq(users.username, username),
  });
});
