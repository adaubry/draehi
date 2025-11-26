import Surreal from "surrealdb";

async function test() {
  const db = new Surreal();
  await db.connect("http://localhost:8000");
  await db.signin({ username: "root", password: "root" });
  await db.use({ namespace: "draehi", database: "main" });

  // Try using the SDK's RecordId class
  const RecordId = (await import("surrealdb")).RecordId;
  
  // Test 1: Create with RecordId object
  try {
    console.log("Test 1: Creating with RecordId object");
    const wsId = new RecordId("workspaces", "test-ws-123");
    const result = await db.query(
      `CREATE $id CONTENT $data RETURN *;`,
      { id: wsId, data: { slug: "test", name: "Test" } }
    );
    console.log("Success:", result);
  } catch (error: any) {
    console.error("Failed:", error.message);
  }

  // Test 2: Create with raw table name and use RecordId
  try {
    console.log("\nTest 2: Using CREATE directly with RecordId");
    const result = await db.query(
      `CREATE workspaces:test-ws-456 CONTENT { slug: "test", name: "Test" } RETURN *;`
    );
    console.log("Success:", result);
  } catch (error: any) {
    console.error("Failed:", error.message);
  }
}

test().catch(console.error);
