import { getSurreal, createWithId, query } from "@/lib/surreal";

async function test() {
  const db = await getSurreal();
  
  // Create a test workspace
  const wsResult = await createWithId("workspaces:test-ws-uuid", {
    user: "users:test-user-uuid",
    slug: "test",
    name: "Test Workspace",
    embed_depth: 5
  });
  console.log("Created workspace:", wsResult);

  // Try creating a node with a string parent reference
  try {
    const nodeResult = await createWithId("nodes:test-node-uuid", {
      workspace: "workspaces:test-ws-uuid",
      page_name: "Test",
      slug: "test",
      title: "Test Node",
      order: 0,
      metadata: {}
    });
    console.log("Created node:", nodeResult);

    // Now try to UPDATE with parent as string
    const updateResult = await query(
      `UPDATE nodes:test-node-uuid SET parent = $parent;`,
      { parent: "nodes:parent-uuid" }
    );
    console.log("Update result:", updateResult);
  } catch (error) {
    console.error("Error:", error);
  }
}

test().catch(console.error);
