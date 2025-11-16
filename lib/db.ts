import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as authSchema from "@/modules/auth/schema";
import * as workspaceSchema from "@/modules/workspace/schema";
import * as contentSchema from "@/modules/content/schema";
import * as gitSchema from "@/modules/git/schema";

const connectionString = process.env.DATABASE_URL || "";

// Allow build without DATABASE_URL
if (!connectionString && process.env.NODE_ENV !== "production") {
  console.warn(
    "DATABASE_URL not set - using placeholder for build. Set DATABASE_URL in .env.local for runtime."
  );
}

// Create postgres client (will fail at runtime if not set)
const client = connectionString
  ? postgres(connectionString)
  : postgres("postgresql://placeholder");

// Create drizzle instance with all schemas
export const db = drizzle(client, {
  schema: {
    ...authSchema,
    ...workspaceSchema,
    ...contentSchema,
    ...gitSchema,
  },
});

export type DbClient = typeof db;
