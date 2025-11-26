import Surreal from "surrealdb";

async function checkTables() {
  const db = new Surreal();
  await db.connect("http://localhost:8000");
  await db.signin({ username: "root", password: "root" });
  await db.use({ namespace: "draehi", database: "main" });

  const result = await db.query("INFO FOR DB;");
  const tables = (result[0] as any)?.tables || {};

  console.log(`Total tables: ${Object.keys(tables).length}`);

  // Group by prefix
  const prefixes: Record<string, number> = {};
  for (const name of Object.keys(tables)) {
    const prefix = name.split(":")[0] || name;
    prefixes[prefix] = (prefixes[prefix] || 0) + 1;
  }

  console.log("\nTable counts by prefix:");
  for (const [prefix, count] of Object.entries(prefixes).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${prefix}: ${count}`);
  }

  // Show some examples of "nodes:" tables
  const nodesTables = Object.keys(tables).filter((t) => t.startsWith("nodes:"));
  if (nodesTables.length > 0) {
    console.log(`\nExample nodes:* tables (first 5):`);
    nodesTables.slice(0, 5).forEach((t) => console.log(`  ${t}`));
  }
}

checkTables().catch(console.error);
