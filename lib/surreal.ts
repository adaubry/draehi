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
  if (surrealInstance) {
    return surrealInstance;
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
  const [result] = await db.create<T>(table, data);
  return result;
}

// Create record with specific ID
export async function createWithId<T = unknown>(
  thing: string,
  data: Record<string, unknown>
): Promise<T> {
  const db = await getSurreal();
  const [result] = await db.create<T>(thing, data);
  return result;
}

// Update record
export async function update<T = unknown>(
  thing: string,
  data: Record<string, unknown>
): Promise<T> {
  const db = await getSurreal();
  const [result] = await db.merge<T>(thing, data);
  return result;
}

// Delete record
export async function remove(thing: string): Promise<void> {
  const db = await getSurreal();
  await db.delete(thing);
}

// Select all from table
export async function selectAll<T = unknown>(table: string): Promise<T[]> {
  const db = await getSurreal();
  return (await db.select<T>(table)) as T[];
}

// Select one by ID
export async function selectOne<T = unknown>(
  thing: string
): Promise<T | null> {
  const db = await getSurreal();
  const result = await db.select<T>(thing);
  return Array.isArray(result) ? result[0] || null : result || null;
}

// Initialize schema (run once on startup)
export async function initSchema(): Promise<void> {
  const db = await getSurreal();

  // Users table
  await db.query(`
    DEFINE TABLE users SCHEMAFULL;
    DEFINE FIELD username ON users TYPE string;
    DEFINE FIELD password ON users TYPE string;
    DEFINE FIELD created_at ON users TYPE datetime DEFAULT time::now();
    DEFINE INDEX users_username_unique ON users FIELDS username UNIQUE;
  `);

  // Workspaces table with user link
  await db.query(`
    DEFINE TABLE workspaces SCHEMAFULL;
    DEFINE FIELD user ON workspaces TYPE record<users>;
    DEFINE FIELD slug ON workspaces TYPE string;
    DEFINE FIELD name ON workspaces TYPE string;
    DEFINE FIELD domain ON workspaces TYPE option<string>;
    DEFINE FIELD embed_depth ON workspaces TYPE int DEFAULT 5;
    DEFINE FIELD created_at ON workspaces TYPE datetime DEFAULT time::now();
    DEFINE FIELD updated_at ON workspaces TYPE datetime DEFAULT time::now();
    DEFINE INDEX workspaces_user_unique ON workspaces FIELDS user UNIQUE;
    DEFINE INDEX workspaces_slug_unique ON workspaces FIELDS slug UNIQUE;
  `);

  // Nodes table (pages + blocks) with self-referential hierarchy
  await db.query(`
    DEFINE TABLE nodes SCHEMAFULL;
    DEFINE FIELD workspace ON nodes TYPE record<workspaces>;
    DEFINE FIELD parent ON nodes TYPE option<record<nodes>>;
    DEFINE FIELD order ON nodes TYPE int DEFAULT 0;
    DEFINE FIELD page_name ON nodes TYPE string;
    DEFINE FIELD slug ON nodes TYPE string;
    DEFINE FIELD title ON nodes TYPE string;
    DEFINE FIELD metadata ON nodes TYPE option<object>;
    DEFINE FIELD created_at ON nodes TYPE datetime DEFAULT time::now();
    DEFINE FIELD updated_at ON nodes TYPE datetime DEFAULT time::now();
    DEFINE INDEX nodes_workspace_pagename ON nodes FIELDS workspace, page_name;
    DEFINE INDEX nodes_parent_order ON nodes FIELDS parent, order;
  `);

  // Git repositories table
  await db.query(`
    DEFINE TABLE git_repositories SCHEMAFULL;
    DEFINE FIELD workspace ON git_repositories TYPE record<workspaces>;
    DEFINE FIELD repo_url ON git_repositories TYPE string;
    DEFINE FIELD branch ON git_repositories TYPE string DEFAULT 'main';
    DEFINE FIELD deploy_key ON git_repositories TYPE option<string>;
    DEFINE FIELD last_sync ON git_repositories TYPE option<datetime>;
    DEFINE FIELD sync_status ON git_repositories TYPE string DEFAULT 'idle';
    DEFINE FIELD error_log ON git_repositories TYPE option<string>;
    DEFINE FIELD created_at ON git_repositories TYPE datetime DEFAULT time::now();
    DEFINE FIELD updated_at ON git_repositories TYPE datetime DEFAULT time::now();
    DEFINE INDEX git_repositories_workspace_unique ON git_repositories FIELDS workspace UNIQUE;
  `);

  // Deployment history table
  await db.query(`
    DEFINE TABLE deployment_history SCHEMAFULL;
    DEFINE FIELD workspace ON deployment_history TYPE record<workspaces>;
    DEFINE FIELD commit_sha ON deployment_history TYPE string;
    DEFINE FIELD status ON deployment_history TYPE string;
    DEFINE FIELD deployed_at ON deployment_history TYPE datetime DEFAULT time::now();
    DEFINE FIELD error_log ON deployment_history TYPE option<string>;
    DEFINE FIELD build_log ON deployment_history TYPE option<array<string>>;
  `);

  console.log("SurrealDB schema initialized");
}

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
