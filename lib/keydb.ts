import { createClient, RedisClientType } from "redis";

// KeyDB (Redis-compatible) connection singleton
let keydbInstance: RedisClientType | null = null;

const config = {
  url: process.env.KEYDB_URL || "redis://localhost:6379",
};

export async function getKeyDB(): Promise<RedisClientType> {
  if (keydbInstance && keydbInstance.isOpen) {
    return keydbInstance;
  }

  const client = createClient({
    url: config.url,
  });

  client.on("error", (err) => console.error("KeyDB Client Error:", err));

  await client.connect();
  keydbInstance = client as RedisClientType;

  return keydbInstance;
}

// ============================================
// HTML Cache Operations
// ============================================

// Key patterns:
// - workspace:{workspaceId}:block:{uuid} → HTML string
// - workspace:{workspaceId}:page:{pageName}:blocks → JSON array of block UUIDs in order

// Normalize UUID to 32-char hex format (remove hyphens)
function normalizeUuid(uuid: string): string {
  return uuid.replace(/-/g, "");
}

function blockKey(workspaceId: string, uuid: string): string {
  const normalizedUuid = normalizeUuid(uuid);
  return `workspace:${workspaceId}:block:${normalizedUuid}`;
}

function pageBlocksKey(workspaceId: string, pageName: string): string {
  return `workspace:${workspaceId}:page:${pageName}:blocks`;
}

function workspacePattern(workspaceId: string): string {
  return `workspace:${workspaceId}:*`;
}

// Set block HTML
export async function setBlockHTML(
  workspaceId: string,
  uuid: string,
  html: string
): Promise<void> {
  const client = await getKeyDB();
  await client.set(blockKey(workspaceId, uuid), html);
}

// Get block HTML
export async function getBlockHTML(
  workspaceId: string,
  uuid: string
): Promise<string | null> {
  const client = await getKeyDB();
  const html = await client.get(blockKey(workspaceId, uuid));
  console.log(`[Display] getBlockHTML: Block ${uuid} found=${html !== null}, size=${html?.length || 0} bytes`);
  return html;
}

// Set multiple block HTMLs at once (pipeline for performance)
export async function setBlockHTMLBatch(
  workspaceId: string,
  blocks: Array<{ uuid: string; html: string }>
): Promise<void> {
  if (blocks.length === 0) return;

  const totalSize = blocks.reduce((sum, b) => sum + b.html.length, 0);
  console.log(`[Display] setBlockHTMLBatch: Storing ${blocks.length} blocks (~${totalSize} bytes total) to KeyDB`);

  // Log first 3 UUIDs being stored
  if (blocks.length > 0) {
    console.log(`[Display] setBlockHTMLBatch: Sample UUIDs stored: ${blocks.slice(0, 3).map(b => `"${b.uuid}"`).join(", ")}`);
  }

  const client = await getKeyDB();
  const multi = client.multi();

  for (const block of blocks) {
    multi.set(blockKey(workspaceId, block.uuid), block.html);
  }

  try {
    await multi.exec();
    console.log(`[Display] setBlockHTMLBatch: Successfully stored ${blocks.length} blocks to KeyDB`);
  } catch (error) {
    console.error(
      `[Display] setBlockHTMLBatch: Failed to batch set HTML for ${blocks.length} blocks in workspace ${workspaceId}:`,
      error
    );
    throw new Error(
      `KeyDB batch operation failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

// Get multiple block HTMLs at once
export async function getBlockHTMLBatch(
  workspaceId: string,
  uuids: string[]
): Promise<Map<string, string | null>> {
  if (uuids.length === 0) return new Map();

  console.log(`[Display] getBlockHTMLBatch: Fetching HTML for ${uuids.length} blocks from KeyDB`);

  // Log first 3 UUIDs being requested
  if (uuids.length > 0) {
    console.log(`[Display] getBlockHTMLBatch: Sample UUIDs requested: ${uuids.slice(0, 3).map(u => `"${u}"`).join(", ")}`);
  }

  const client = await getKeyDB();
  const keys = uuids.map((uuid) => blockKey(workspaceId, uuid));

  // Log first 3 keys being looked up
  console.log(`[Display] getBlockHTMLBatch: Sample keys: ${keys.slice(0, 3).map(k => `"${k}"`).join(", ")}`);

  const values = await client.mGet(keys);

  const result = new Map<string, string | null>();
  let foundCount = 0;
  let totalSize = 0;

  uuids.forEach((uuid, i) => {
    result.set(uuid, values[i]);
    if (values[i] !== null) {
      foundCount++;
      totalSize += values[i].length;
    }
  });

  console.log(`[Display] getBlockHTMLBatch: Found ${foundCount}/${uuids.length} blocks, total size ${totalSize} bytes`);
  return result;
}

// Store ordered block UUIDs for a page
export async function setPageBlockOrder(
  workspaceId: string,
  pageName: string,
  blockUuids: string[]
): Promise<void> {
  const client = await getKeyDB();
  await client.set(
    pageBlocksKey(workspaceId, pageName),
    JSON.stringify(blockUuids)
  );
}

// Get ordered block UUIDs for a page
export async function getPageBlockOrder(
  workspaceId: string,
  pageName: string
): Promise<string[]> {
  const client = await getKeyDB();
  const data = await client.get(pageBlocksKey(workspaceId, pageName));
  return data ? JSON.parse(data) : [];
}

// Get all blocks for a page in order with their HTML
export async function getPageBlocksWithHTML(
  workspaceId: string,
  pageName: string
): Promise<Array<{ uuid: string; html: string | null }>> {
  const uuids = await getPageBlockOrder(workspaceId, pageName);
  if (uuids.length === 0) return [];

  const htmlMap = await getBlockHTMLBatch(workspaceId, uuids);

  return uuids.map((uuid) => ({
    uuid,
    html: htmlMap.get(uuid) || null,
  }));
}

// Delete all cached data for a workspace
export async function clearWorkspaceCache(workspaceId: string): Promise<void> {
  const client = await getKeyDB();
  const pattern = workspacePattern(workspaceId);

  // Use SCAN to find all keys (safe for production)
  let cursor = 0;
  do {
    const result = await client.scan(cursor, {
      MATCH: pattern,
      COUNT: 1000,
    });
    cursor = result.cursor;

    if (result.keys.length > 0) {
      await client.del(result.keys);
    }
  } while (cursor !== 0);
}

// Delete specific block HTML
export async function deleteBlockHTML(
  workspaceId: string,
  uuid: string
): Promise<void> {
  const client = await getKeyDB();
  await client.del(blockKey(workspaceId, uuid));
}

// Check if block HTML exists
export async function hasBlockHTML(
  workspaceId: string,
  uuid: string
): Promise<boolean> {
  const client = await getKeyDB();
  return (await client.exists(blockKey(workspaceId, uuid))) === 1;
}

// Get cache stats for a workspace
export async function getWorkspaceCacheStats(
  workspaceId: string
): Promise<{ blockCount: number; totalSize: number }> {
  const client = await getKeyDB();
  const pattern = `workspace:${workspaceId}:block:*`;

  let blockCount = 0;
  let totalSize = 0;
  let cursor = 0;

  do {
    const result = await client.scan(cursor, {
      MATCH: pattern,
      COUNT: 1000,
    });
    cursor = result.cursor;
    blockCount += result.keys.length;

    // Get size of each key
    for (const key of result.keys) {
      const size = await client.strLen(key);
      totalSize += size;
    }
  } while (cursor !== 0);

  return { blockCount, totalSize };
}

// Health check
export async function pingKeyDB(): Promise<boolean> {
  try {
    const client = await getKeyDB();
    const result = await client.ping();
    return result === "PONG";
  } catch {
    return false;
  }
}

// Graceful shutdown
export async function closeKeyDB(): Promise<void> {
  if (keydbInstance && keydbInstance.isOpen) {
    await keydbInstance.quit();
    keydbInstance = null;
  }
}
