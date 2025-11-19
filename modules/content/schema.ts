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
    uuid: text("uuid").primaryKey(), // UUID as primary key (no auto-increment)
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    // Hierarchy (everything is a node: pages and blocks)
    parentUuid: text("parent_uuid").references((): any => nodes.uuid, {
      onDelete: "cascade",
    }), // NULL = page, NOT NULL = block
    order: integer("order").notNull().default(0), // Order within siblings

    // Logseq identification
    pageName: text("page_name").notNull(), // e.g., "guides/setup/intro"
    slug: text("slug").notNull(), // e.g., "intro"

    // Content (HTML only - Git is source of truth for markdown)
    title: text("title").notNull(),
    html: text("html"), // Rendered HTML (NULL for pages, HTML for blocks)
    metadata: json("metadata").$type<{
      tags?: string[];
      properties?: Record<string, unknown>;
      frontmatter?: Record<string, unknown>;
    }>(),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    // Hierarchy queries - parent + order for sibling ordering
    parentOrderIdx: index("parent_order_idx").on(table.parentUuid, table.order),

    // Block queries - get all blocks for a page (getAllBlocksForPage)
    workspacePageNameIdx: index("workspace_pagename_idx").on(
      table.workspaceId,
      table.pageName
    ),
  })
);

export type Node = typeof nodes.$inferSelect;
export type NewNode = typeof nodes.$inferInsert;
