"use server";

import { queryOne, selectOne } from "@/lib/surreal";
import { type User, userRecordId } from "./schema";
import { cache } from "react";

export const getUserById = cache(async (id: string): Promise<User | null> => {
  return await selectOne<User>(userRecordId(id));
});

export const getUserByUsername = cache(
  async (username: string): Promise<User | null> => {
    return await queryOne<User>(
      "SELECT * FROM users WHERE username = $username LIMIT 1",
      { username }
    );
  }
);
