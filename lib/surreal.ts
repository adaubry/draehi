import Surreal from "surrealdb";

// SurrealDB connection singleton
let surrealInstance: Surreal | null = null;

const config = {
  url: process.env.SURREAL_URL || "http://localhost:8000",
  user: process.env.SURREAL_USER || "root",
  pass: process.env.SURREAL_PASS || "root",
  ns: process.env.SURREAL_NS || "draehi",
  db: process.env.SURREAL_DB || "main",
};

export async function getSurreal(): Promise<Surreal> {
  // Return existing connection if still healthy
  if (surrealInstance) {
    try {
      // Quick health check - test that connection is alive
      // Use RETURN statement which is valid in SurrealDB
      await surrealInstance.query("RETURN true;");
      return surrealInstance;
    } catch (error) {
      // Connection died, reset and reconnect
      console.warn("SurrealDB connection lost, reconnecting:", error);
      surrealInstance = null;
    }
  }

  const db = new Surreal();

  try {
    await db.connect(config.url);
    await db.signin({
      username: config.user,
      password: config.pass,
    });
    await db.use({ namespace: config.ns, database: config.db });

    surrealInstance = db;
    return db;
  } catch (error) {
    console.error("Failed to connect to SurrealDB:", error);
    throw error;
  }
}

// Typed query helper
export async function query<T = unknown>(
  sql: string,
  vars?: Record<string, unknown>
): Promise<T[]> {
  const db = await getSurreal();
  const result = await db.query<T[]>(sql, vars);
  // SurrealDB returns array of results per statement
  return (result[0] as T[]) || [];
}

// Single record query
export async function queryOne<T = unknown>(
  sql: string,
  vars?: Record<string, unknown>
): Promise<T | null> {
  const results = await query<T>(sql, vars);
  return results[0] || null;
}

// Create record
export async function create<T = unknown>(
  table: string,
  data: Record<string, unknown>
): Promise<T> {
  const db = await getSurreal();
  const result = await db.query<unknown[]>(
    `CREATE ${table} CONTENT $data RETURN *;`,
    { data }
  );
  const records = result[0] as T[];
  return records[0];
}

// Create record with specific ID
export async function createWithId<T = unknown>(
  thing: string,
  data: Record<string, unknown>
): Promise<T> {
  const db = await getSurreal();

  // Build SQL with proper SurrealDB syntax for record references
  // SurrealDB requires raw SQL for record fields (can't use parameterized values)
  // Example: nodes:`uuid-here` for record references (backticks on UUID only)
  const contentEntries: string[] = [];
  const params: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === null) {
      // Explicitly set to NONE for optional fields
      contentEntries.push(`${key}: NONE`);
    } else if (
      typeof value === "string" &&
      value.includes(":") &&
      (value.startsWith("users:") ||
        value.startsWith("workspaces:") ||
        value.startsWith("nodes:"))
    ) {
      // This is a record ID string - include as raw SQL with backticks around the ID part only
      // e.g., "workspaces:abc-def" becomes workspaces:`abc-def`
      const [table, id] = value.split(":", 2);
      contentEntries.push(`${key}: ${table}:\`${id}\``);
    } else {
      // Regular parameter - use parameterized query
      contentEntries.push(`${key}: $${key}`);
      params[key] = value;
    }
  }

  const contentSql = contentEntries.join(", ");
  // thing is already formatted as "table:uuid", include with backticks around UUID only
  const [thingTable, thingId] = thing.split(":", 2);
  const sql = `CREATE ${thingTable}:\`${thingId}\` CONTENT { ${contentSql} } RETURN *;`;

  const result = await db.query<unknown[]>(sql, params);
  const records = result[0] as T[];
  return records[0];
}

// Update record
export async function update<T = unknown>(
  thing: string,
  data: Record<string, unknown>
): Promise<T> {
  const db = await getSurreal();

  // Convert ISO date strings to SurrealDB datetime format
  // SurrealDB expects datetime objects, not ISO strings
  const cleanData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      // This looks like an ISO datetime string, but SurrealDB will handle it
      // Actually, for datetime fields we need to use time::from() or just pass the string
      cleanData[key] = value;
    } else {
      cleanData[key] = value;
    }
  }

  const result = await db.query<unknown[]>(
    `UPDATE $thing MERGE $data RETURN *;`,
    { thing, data: cleanData }
  );
  const records = result[0] as T[];
  return records[0];
}

// Delete record
export async function remove(thing: string): Promise<void> {
  const db = await getSurreal();
  await db.delete(thing);
}

// Select all from table
export async function selectAll<T = unknown>(table: string): Promise<T[]> {
  const db = await getSurreal();
  const result = await db.select(table) as unknown;
  return (Array.isArray(result) ? result : []) as T[];
}

// Select one by ID
export async function selectOne<T = unknown>(
  thing: string
): Promise<T | null> {
  const db = await getSurreal();
  const result = await db.select(thing) as unknown;
  return Array.isArray(result) ? (result[0] as T) || null : (result as T) || null;
}

// Schema is initialized via scripts/init-surreal-schema.ts
// Do NOT define schema here - use the dedicated script for idempotent "IF NOT EXISTS" behavior
// See: scripts/init-surreal-schema.ts

// Type definitions for records
export interface SurrealUser {
  id: string;
  username: string;
  password: string;
  created_at: string;
}

export interface SurrealWorkspace {
  id: string;
  user: string; // Record link to users
  slug: string;
  name: string;
  domain?: string;
  embed_depth: number;
  created_at: string;
  updated_at: string;
}

export interface SurrealNode {
  id: string;
  workspace: string; // Record link to workspaces
  parent?: string; // Record link to nodes (NULL = page, NOT NULL = block)
  order: number;
  page_name: string;
  slug: string;
  title: string;
  metadata?: {
    tags?: string[];
    properties?: Record<string, unknown>;
    frontmatter?: Record<string, unknown>;
    heading?: { level: number; text: string }; // For TOC display
  };
  created_at: string;
  updated_at: string;
}

export interface SurrealGitRepository {
  id: string;
  workspace: string;
  repo_url: string;
  branch: string;
  deploy_key?: string;
  last_sync?: string;
  sync_status: string;
  error_log?: string;
  created_at: string;
  updated_at: string;
}

export interface SurrealDeployment {
  id: string;
  workspace: string;
  commit_sha: string;
  status: string;
  deployed_at: string;
  error_log?: string;
  build_log?: string[];
}
