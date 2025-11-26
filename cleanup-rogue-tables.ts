import Surreal from "surrealdb";

async function cleanupRogueTables() {
  const db = new Surreal();
  await db.connect("http://localhost:8000");
  await db.signin({ username: "root", password: "root" });
  await db.use({ namespace: "draehi", database: "main" });

  console.log("🗑️  Cleaning up rogue nodes:* tables...\n");

  const result = await db.query("INFO FOR DB;");
  const tables = (result[0] as any)?.tables || {};

  const rogueTables = Object.keys(tables).filter((t) =>
    t.match(/^nodes:[a-f0-9\-]{36}$/)
  );

  console.log(`Found ${rogueTables.length} rogue tables to delete`);

  if (rogueTables.length === 0) {
    console.log("✅ No rogue tables found!");
    return;
  }

  // Delete them - need backticks around table names with colons
  let deleted = 0;
  for (const table of rogueTables) {
    try {
      const [prefix, id] = table.split(":", 2);
      await db.query(`REMOVE TABLE ${prefix}:\`${id}\`;`);
      deleted++;
      if (deleted % 100 === 0) {
        console.log(`  Deleted ${deleted}/${rogueTables.length}...`);
      }
    } catch (error) {
      console.error(`Failed to delete ${table}:`, error);
    }
  }

  console.log(`\n✅ Deleted ${deleted} rogue tables`);

  // Verify
  const verifyResult = await db.query("INFO FOR DB;");
  const verifyTables = (verifyResult[0] as any)?.tables || {};
  const remainingRogue = Object.keys(verifyTables).filter((t) =>
    t.match(/^nodes:[a-f0-9\-]{36}$/)
  );

  console.log(`Remaining rogue tables: ${remainingRogue.length}`);
  console.log(`Total tables now: ${Object.keys(verifyTables).length}`);
}

cleanupRogueTables().catch(console.error);
