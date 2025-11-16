import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { users } from "../auth/schema";

export const workspaces = pgTable("workspaces", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(), // One workspace per user
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  domain: text("domain"), // Custom domain (future)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
