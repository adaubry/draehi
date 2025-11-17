#!/usr/bin/env tsx

import { db } from "../lib/db";
import * as contentSchema from "../modules/content/schema";
import { eq } from "drizzle-orm";

async function validate() {
  try {
    // Count pages
    const pages = await db.query.nodes.findMany({
      where: eq(contentSchema.nodes.nodeType, "page"),
    });

    console.log(`✓ Pages: ${pages.length}`);

    // Count blocks
    const blocks = await db.query.nodes.findMany({
      where: eq(contentSchema.nodes.nodeType, "block"),
    });

    console.log(`✓ Blocks: ${blocks.length}`);

    // Check for specific features
    const tasksPage = pages.find((p) => p.pageName === "Task Management");
    if (tasksPage) {
      console.log("✓ Task Management page found");
    }

    const refsPage = pages.find((p) => p.pageName === "Block References");
    if (refsPage) {
      console.log("✓ Block References page found");
    }

    const namespacePage = pages.find(
      (p) => p.pageName === "guides/getting-started"
    );
    if (namespacePage) {
      console.log("✓ Namespaced page found");
    }

    process.exit(0);
  } catch (err) {
    console.error("Validation error:", err);
    process.exit(1);
  }
}

validate();
