#!/usr/bin/env tsx
/**
 * Test asset upload functionality
 *
 * Creates a test workspace with a sample image and verifies:
 * 1. Local image path detected in markdown
 * 2. Image uploaded to MinIO/S3
 * 3. HTML contains S3 URL instead of local path
 *
 * Prerequisites:
 * - MinIO running (npm run minio)
 * - Database set up
 *
 * Usage: npx tsx scripts/test-asset-upload.ts
 */

import { processAssets } from "../modules/logseq/parse";
import fs from "fs/promises";
import path from "path";

const TEST_WORKSPACE_ID = 999;
const TEST_REPO_PATH = "/tmp/draehi-test-assets";

async function setupTestFiles() {
  console.log("→ Setting up test files...");

  // Create test directory structure
  await fs.mkdir(TEST_REPO_PATH, { recursive: true });
  await fs.mkdir(path.join(TEST_REPO_PATH, "assets"), { recursive: true });

  // Create a simple 1x1 PNG (base64 encoded)
  const pngData = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  );

  await fs.writeFile(path.join(TEST_REPO_PATH, "assets", "test-image.png"), pngData);

  console.log("✓ Test files created");
}

async function testAssetProcessing() {
  console.log("\n→ Testing asset processing...");

  // Test both path styles that Logseq uses
  const testCases = [
    {
      name: "Relative path from pages/ (../assets/...)",
      html: `<p>Image from pages/:</p><img src="../assets/test-image.png" alt="Test" />`,
      expectedPath: "../assets/test-image.png",
    },
    {
      name: "Direct path (assets/...)",
      html: `<p>Direct reference:</p><img src="assets/test-image.png" alt="Test" />`,
      expectedPath: "assets/test-image.png",
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n[Test] ${testCase.name}`);
    console.log("Input HTML:", testCase.html);

    const htmlAfter = await processAssets(testCase.html, TEST_WORKSPACE_ID, TEST_REPO_PATH);

    console.log("Output HTML:", htmlAfter);

    const hasLocalPath = htmlAfter.includes(testCase.expectedPath);
    const hasS3Url =
      htmlAfter.includes("http://localhost:9000") || htmlAfter.includes("s3.amazonaws.com");

    console.log(`  Local path removed: ${!hasLocalPath ? "✓" : "✗ FAILED"}`);
    console.log(`  S3 URL present: ${hasS3Url ? "✓" : "✗ FAILED"}`);

    if (hasLocalPath) {
      console.error(`\n✗ ERROR: HTML still contains local path: ${testCase.expectedPath}`);
      process.exit(1);
    }

    if (!hasS3Url) {
      console.error("\n✗ ERROR: HTML doesn't contain S3 URL!");
      process.exit(1);
    }
  }

  console.log("\n✓ All asset processing tests passed!");
}

async function cleanup() {
  console.log("\n→ Cleaning up...");
  await fs.rm(TEST_REPO_PATH, { recursive: true, force: true });
  console.log("✓ Cleanup complete");
}

async function main() {
  console.log("╔═══════════════════════════════════════╗");
  console.log("║   Testing Asset Upload                ║");
  console.log("╚═══════════════════════════════════════╝\n");

  try {
    await setupTestFiles();
    await testAssetProcessing();
    await cleanup();

    console.log("\n╔═══════════════════════════════════════╗");
    console.log("║   ✓ All Tests Passed                  ║");
    console.log("╚═══════════════════════════════════════╝\n");
  } catch (error) {
    console.error("\n✗ Test failed:", error);
    await cleanup().catch(() => {}); // Best effort cleanup
    process.exit(1);
  }
}

main();
