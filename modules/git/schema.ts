import { pgTable, text, timestamp, integer, json } from "drizzle-orm/pg-core";
import { workspaces } from "../workspace/schema";

export const gitRepositories = pgTable("git_repositories", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: integer("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" })
    .unique(), // One repo per workspace
  repoUrl: text("repo_url").notNull(),
  branch: text("branch").notNull().default("main"),
  deployKey: text("deploy_key"), // Encrypted deploy key or token
  lastSync: timestamp("last_sync"),
  syncStatus: text("sync_status").notNull().default("idle"), // idle, syncing, success, error
  errorLog: text("error_log"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const deploymentHistory = pgTable("deployment_history", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: integer("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  commitSha: text("commit_sha").notNull(),
  status: text("status").notNull(), // pending, building, success, failed
  deployedAt: timestamp("deployed_at").notNull().defaultNow(),
  errorLog: text("error_log"),
  buildLog: json("build_log").$type<string[]>(), // Array of log lines
});

export type GitRepository = typeof gitRepositories.$inferSelect;
export type NewGitRepository = typeof gitRepositories.$inferInsert;
export type Deployment = typeof deploymentHistory.$inferSelect;
export type NewDeployment = typeof deploymentHistory.$inferInsert;
