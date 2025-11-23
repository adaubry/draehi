#!/usr/bin/env npx tsx
/**
 * Initialize SurrealDB schema
 * Run after Docker services are up
 */

import { initSchema, getSurreal } from "../lib/surreal";

async function main() {
  console.log("Connecting to SurrealDB...");

  try {
    await initSchema();
    console.log("Schema initialized successfully!");

    // Close connection
    const db = await getSurreal();
    await db.close();

    process.exit(0);
  } catch (error) {
    console.error("Failed to initialize schema:", error);
    process.exit(1);
  }
}

main();
