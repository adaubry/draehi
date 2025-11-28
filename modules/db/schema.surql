-- ============================================================
-- Draehi SurrealDB Schema Definition
-- ============================================================
-- Based on TypeScript interface definitions in /modules/**/schema.ts
-- Defines graph relationships with RELATE edges for parent-child hierarchy
-- Executed during docker-setup.sh after database creation.

-- ============================================================
-- NAMESPACE & DATABASE SETUP
-- ============================================================

USE NS draehi DB main;

-- ============================================================
-- USERS TABLE (from /modules/auth/schema.ts)
-- ============================================================
DEFINE TABLE users SCHEMALESS;
DEFINE FIELD id ON users TYPE string;
DEFINE FIELD auth0_sub ON users TYPE string;
DEFINE FIELD username ON users TYPE string;
DEFINE FIELD created_at ON users TYPE datetime DEFAULT time::now();
DEFINE INDEX auth0_sub_unique ON users COLUMNS auth0_sub UNIQUE;

-- ============================================================
-- WORKSPACES TABLE (from /modules/workspace/schema.ts)
-- ============================================================
DEFINE TABLE workspaces SCHEMALESS;
DEFINE FIELD id ON workspaces TYPE string;
DEFINE FIELD user ON workspaces TYPE record<users>;
DEFINE FIELD slug ON workspaces TYPE string;
DEFINE FIELD name ON workspaces TYPE string;
DEFINE FIELD domain ON workspaces TYPE string;
DEFINE FIELD embed_depth ON workspaces TYPE number DEFAULT 5;
DEFINE FIELD created_at ON workspaces TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON workspaces TYPE datetime DEFAULT time::now();
DEFINE INDEX user_idx ON workspaces COLUMNS user;
DEFINE INDEX slug_unique ON workspaces COLUMNS slug UNIQUE;

-- ============================================================
-- GIT_REPOSITORIES TABLE (from /modules/git/schema.ts)
-- ============================================================
DEFINE TABLE git_repositories SCHEMALESS;
DEFINE FIELD id ON git_repositories TYPE string;
DEFINE FIELD workspace ON git_repositories TYPE record<workspaces>;
DEFINE FIELD repo_url ON git_repositories TYPE string;
DEFINE FIELD branch ON git_repositories TYPE string;
DEFINE FIELD deploy_key ON git_repositories TYPE string;
DEFINE FIELD last_sync ON git_repositories TYPE datetime;
DEFINE FIELD sync_status ON git_repositories TYPE string;
DEFINE FIELD error_log ON git_repositories TYPE string;
DEFINE FIELD created_at ON git_repositories TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON git_repositories TYPE datetime DEFAULT time::now();
DEFINE INDEX workspace_idx ON git_repositories COLUMNS workspace;

-- ============================================================
-- NODES TABLE (from /modules/content/schema.ts)
-- Unified table for pages (parent=null) and blocks (parent=nodes:uuid)
-- HTML content is stored in KeyDB, not in SurrealDB
-- ============================================================
DEFINE TABLE nodes SCHEMALESS;
DEFINE FIELD id ON nodes TYPE string;
DEFINE FIELD uuid ON nodes TYPE string;
DEFINE FIELD workspace ON nodes TYPE record<workspaces>;
DEFINE FIELD parent ON nodes TYPE option<record<nodes>>;
DEFINE FIELD parentUuid ON nodes TYPE option<string>;
DEFINE FIELD order ON nodes TYPE number DEFAULT 0;
DEFINE FIELD page_name ON nodes TYPE string;
DEFINE FIELD pageName ON nodes TYPE string;
DEFINE FIELD slug ON nodes TYPE string;
DEFINE FIELD title ON nodes TYPE string;
DEFINE FIELD metadata ON nodes TYPE option<object>;
DEFINE FIELD created_at ON nodes TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON nodes TYPE datetime DEFAULT time::now();
DEFINE INDEX workspace_page_name ON nodes COLUMNS workspace, page_name;
DEFINE INDEX workspace_parent ON nodes COLUMNS workspace, parent;
DEFINE INDEX uuid_idx ON nodes COLUMNS uuid;
DEFINE INDEX parent_idx ON nodes COLUMNS parent;

-- ============================================================
-- PARENT RELATION TABLE (graph edges)
-- ============================================================
-- IMPORTANT: This RELATE table defines parent-child relationships
-- Enables efficient graph traversal with SurrealDB's <-parent* syntax
-- Child--(parent)-->Parent relationship
-- Query: SELECT * FROM <-parent* FROM pageNodeId
-- This replaces sequential queries with single graph traversal
DEFINE TABLE parent TYPE RELATION IN nodes OUT nodes;

-- ============================================================
-- DEPLOYMENT_HISTORY TABLE (from /modules/git/schema.ts)
-- ============================================================
DEFINE TABLE deployment_history SCHEMALESS;
DEFINE FIELD id ON deployment_history TYPE string;
DEFINE FIELD workspace ON deployment_history TYPE record<workspaces>;
DEFINE FIELD commit_sha ON deployment_history TYPE string;
DEFINE FIELD status ON deployment_history TYPE string;
DEFINE FIELD deployed_at ON deployment_history TYPE datetime DEFAULT time::now();
DEFINE FIELD error_log ON deployment_history TYPE string;
DEFINE FIELD build_log ON deployment_history TYPE array;
DEFINE INDEX workspace_idx ON deployment_history COLUMNS workspace;
DEFINE INDEX status_idx ON deployment_history COLUMNS status;
