import {
  pgTable,
  text,
  timestamp,
  integer,
  json,
  boolean,
  date,
  index,
} from "drizzle-orm/pg-core";
import { workspaces } from "../workspace/schema";

export const nodes = pgTable(
  "nodes",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    // Logseq page identification
    pageName: text("page_name").notNull(), // e.g., "guides/setup/intro"
    slug: text("slug").notNull(), // e.g., "intro"
    namespace: text("namespace").notNull().default(""), // e.g., "guides/setup"
    depth: integer("depth").notNull().default(0), // Derived from namespace

    // Content
    title: text("title").notNull(),
    html: text("html"), // Pre-rendered HTML from Rust tool
    content: text("content"), // Original markdown backup
    metadata: json("metadata").$type<{
      tags?: string[];
      properties?: Record<string, unknown>;
      frontmatter?: Record<string, unknown>;
    }>(),

    // Journal pages
    isJournal: boolean("is_journal").notNull().default(false),
    journalDate: date("journal_date"),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    // O(1) path lookups
    workspaceNamespaceSlugIdx: index("workspace_namespace_slug_idx").on(
      table.workspaceId,
      table.namespace,
      table.slug
    ),
    // List children
    workspaceNamespaceIdx: index("workspace_namespace_idx").on(
      table.workspaceId,
      table.namespace
    ),
    // Journal queries
    journalDateIdx: index("journal_date_idx").on(table.journalDate),
  })
);

export type Node = typeof nodes.$inferSelect;
export type NewNode = typeof nodes.$inferInsert;
