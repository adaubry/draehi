#!/usr/bin/env tsx

/**
 * Test block structure logic without database
 * Simulates the ingestion and display logic to find bugs
 */

type Block = {
  id: number;
  parentId: number | null;
  order: number;
  nodeType: "page" | "block";
  pageName: string;
  html: string | null;
  title: string;
};

// Simulate a page with blocks
const testBlocks: Block[] = [
  // Page node
  {
    id: 1,
    parentId: null,
    order: 0,
    nodeType: "page",
    pageName: "test-page",
    html: null,
    title: "Test Page",
  },
  // Top-level blocks
  {
    id: 2,
    parentId: 1, // parent is page
    order: 0,
    nodeType: "block",
    pageName: "test-page",
    html: "<p>Block A</p>",
    title: "",
  },
  {
    id: 3,
    parentId: 2, // parent is block A
    order: 0,
    nodeType: "block",
    pageName: "test-page",
    html: "<p>Block A.1</p>",
    title: "",
  },
  {
    id: 4,
    parentId: 2, // parent is block A
    order: 1,
    nodeType: "block",
    pageName: "test-page",
    html: "<p>Block A.2</p>",
    title: "",
  },
  {
    id: 5,
    parentId: 1, // parent is page
    order: 1,
    nodeType: "block",
    pageName: "test-page",
    html: "<p>Block B</p>",
    title: "",
  },
];

// Simulate BlockTree logic
function testBlockTree(blocks: Block[]) {
  console.log("Testing BlockTree logic...\n");

  // Find page node
  const pageNode = blocks.find((b) => b.nodeType === "page");
  console.log("Page node:", pageNode);

  if (!pageNode) {
    console.error("❌ No page node found!");
    return;
  }

  // Find top-level blocks
  const topLevelBlocks = blocks
    .filter(
      (b) => b.nodeType === "block" && b.parentId === pageNode.id
    )
    .sort((a, b) => a.order - b.order);

  console.log("\nTop-level blocks:");
  console.log(topLevelBlocks);

  if (topLevelBlocks.length === 0) {
    console.error("❌ No top-level blocks found!");
    console.log("\nAll blocks:");
    blocks.forEach((b) => {
      console.log(`  ID: ${b.id}, Type: ${b.nodeType}, ParentID: ${b.parentId}, Order: ${b.order}`);
    });
    return;
  }

  console.log("\n✅ Found", topLevelBlocks.length, "top-level blocks");

  // Test finding children
  topLevelBlocks.forEach((block) => {
    const children = blocks
      .filter((b) => b.nodeType === "block" && b.parentId === block.id)
      .sort((a, b) => a.order - b.order);

    console.log(`\nBlock ${block.id} has ${children.length} children:`);
    children.forEach((child) => {
      console.log(`  - ${child.id}: ${child.html}`);
    });
  });
}

testBlockTree(testBlocks);

console.log("\n" + "=".repeat(60));
console.log("Testing with NULL parentId (bug scenario)");
console.log("=".repeat(60));

// Test with blocks that have null parentId (bug scenario)
const buggyBlocks: Block[] = [
  {
    id: 1,
    parentId: null,
    order: 0,
    nodeType: "page",
    pageName: "test-page",
    html: null,
    title: "Test Page",
  },
  {
    id: 2,
    parentId: null, // BUG: should be 1
    order: 0,
    nodeType: "block",
    pageName: "test-page",
    html: "<p>Block A</p>",
    title: "",
  },
  {
    id: 3,
    parentId: null, // BUG: should be 2
    order: 0,
    nodeType: "block",
    pageName: "test-page",
    html: "<p>Block A.1</p>",
    title: "",
  },
];

testBlockTree(buggyBlocks);
