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

    // Hierarchy (everything is a node: pages and blocks)
    parentId: integer("parent_id").references((): any => nodes.id, {
      onDelete: "cascade",
    }),
    order: integer("order").notNull().default(0), // Order within siblings
    nodeType: text("node_type").notNull().default("page"), // 'page' | 'block'

    // Logseq identification
    pageName: text("page_name").notNull(), // e.g., "guides/setup/intro"
    slug: text("slug").notNull(), // e.g., "intro"
    namespace: text("namespace").notNull().default(""), // e.g., "guides/setup"
    depth: integer("depth").notNull().default(0), // Derived from namespace
    blockUuid: text("block_uuid"), // Logseq block UUID (for blocks only)

    // Content (HTML only - Git is source of truth for markdown)
    title: text("title").notNull(),
    html: text("html"), // Rendered HTML (NULL for pages, HTML for blocks)
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
    // Hierarchy queries - parent + order for sibling ordering
    parentOrderIdx: index("parent_order_idx").on(table.parentId, table.order),

    // Block UUID lookups
    blockUuidIdx: index("block_uuid_idx").on(table.blockUuid),

    // O(1) path lookups
    workspaceNamespaceSlugIdx: index("workspace_namespace_slug_idx").on(
      table.workspaceId,
      table.namespace,
      table.slug
    ),

    // Workspace + namespace for page listing
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
