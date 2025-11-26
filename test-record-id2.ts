import Surreal from "surrealdb";

async function test() {
  const db = new Surreal();
  await db.connect("http://localhost:8000");
  await db.signin({ username: "root", password: "root" });
  await db.use({ namespace: "draehi", database: "main" });

  // Test: Create with quoted record ID and record type fields
  try {
    console.log("Test: Creating node with workspace and parent references");
    const result = await db.query(
      `CREATE nodes:\`test-node-abc-def-ghijk\` CONTENT {
        workspace: workspaces:\`test-ws-123\`,
        page_name: "Test",
        slug: "test",
        title: "Test Node",
        order: 0,
        metadata: {},
        parent: nodes:\`parent-node-xyz\`
      } RETURN *;`
    );
    console.log("Success:", result);
  } catch (error: any) {
    console.error("Failed:", error.message);
  }

  // Test 2: Try with type conversion functions
  try {
    console.log("\nTest 2: Using type::record() function");
    const result = await db.query(
      `CREATE nodes:\`test-node-456\` CONTENT {
        workspace: type::record('workspaces', 'test-ws-789'),
        page_name: "Test2",
        slug: "test2",
        title: "Test Node 2",
        order: 0,
        metadata: {},
        parent: type::record('nodes', 'parent-node-456')
      } RETURN *;`
    );
    console.log("Success:", result);
  } catch (error: any) {
    console.error("Failed:", error.message);
  }
}

test().catch(console.error);
