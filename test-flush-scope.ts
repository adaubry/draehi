import { getKeyDB } from "@/lib/keydb";
import { getStorageClient } from "@/modules/storage/s3";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

async function testFlushScope() {
  console.log("🔍 Checking what would be flushed...\n");

  // Check KeyDB
  try {
    console.log("KeyDB:");
    const client = await getKeyDB();
    const result = await client.scan(0, { MATCH: "*", COUNT: 100 });
    console.log(`  Total keys: ${result.keys.length}`);
    if (result.keys.length > 0) {
      console.log(`  Sample keys: ${result.keys.slice(0, 5).join(", ")}`);
    }
    console.log(`  Cursor: ${result.cursor} (0 = done)\n`);
  } catch (error) {
    console.error("  Error scanning KeyDB:", error);
  }

  // Check MinIO
  try {
    console.log("MinIO/S3:");
    const s3Client = getStorageClient();
    const bucket = process.env.S3_BUCKET || "draehi-assets";

    const result = await s3Client.send(new ListObjectsV2Command({
      Bucket: bucket,
      MaxKeys: 10
    }));

    console.log(`  Bucket: ${bucket}`);
    console.log(`  Objects: ${result.Contents?.length || 0}`);
    if (result.Contents && result.Contents.length > 0) {
      console.log(`  Sample keys: ${result.Contents.slice(0, 3).map(o => o.Key).join(", ")}`);
    }
  } catch (error: any) {
    console.error("  Error listing S3:", error.message);
  }
}

testFlushScope().catch(console.error);
