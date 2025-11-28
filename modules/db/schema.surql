-- ============================================================
-- Draehi SurrealDB Schema Definition
-- ============================================================
-- This schema enforces data structure and relationships.
-- Executed during docker-setup.sh after database creation.

-- ============================================================
-- NAMESPACE & DATABASE SETUP
-- ============================================================

USE NS draehi DB main;

-- ============================================================
-- TABLES DEFINITION
-- ============================================================

-- Users table (authentication)
DEFINE TABLE users SCHEMALESS;
DEFINE FIELD id ON users TYPE string;
DEFINE FIELD email ON users TYPE string ASSERT string::len($value) > 0;
DEFINE FIELD name ON users TYPE string;
DEFINE FIELD password_hash ON users TYPE string;
DEFINE FIELD created_at ON users TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON users TYPE datetime DEFAULT time::now();
DEFINE INDEX email_unique ON users COLUMNS email UNIQUE;

-- Workspaces table (one per user)
DEFINE TABLE workspaces SCHEMALESS;
DEFINE FIELD id ON workspaces TYPE string;
DEFINE FIELD user_id ON workspaces TYPE record<users>;
DEFINE FIELD slug ON workspaces TYPE string ASSERT string::len($value) > 0;
DEFINE FIELD name ON workspaces TYPE string ASSERT string::len($value) > 0;
DEFINE FIELD domain ON workspaces TYPE string;
DEFINE FIELD embed_depth ON workspaces TYPE number DEFAULT 5;
DEFINE FIELD created_at ON workspaces TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON workspaces TYPE datetime DEFAULT time::now();
DEFINE INDEX user_id_idx ON workspaces COLUMNS user_id;
DEFINE INDEX slug_unique ON workspaces COLUMNS slug UNIQUE;

-- Git repositories table
DEFINE TABLE git_repositories SCHEMALESS;
DEFINE FIELD id ON git_repositories TYPE string;
DEFINE FIELD workspace_id ON git_repositories TYPE record<workspaces>;
DEFINE FIELD repo_url ON git_repositories TYPE string ASSERT string::len($value) > 0;
DEFINE FIELD branch ON git_repositories TYPE string DEFAULT "main";
DEFINE FIELD deploy_key ON git_repositories TYPE string;
DEFINE FIELD last_sync ON git_repositories TYPE datetime;
DEFINE FIELD sync_status ON git_repositories TYPE string DEFAULT "pending";
DEFINE FIELD created_at ON git_repositories TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON git_repositories TYPE datetime DEFAULT time::now();
DEFINE INDEX workspace_id_idx ON git_repositories COLUMNS workspace_id;

-- ============================================================
-- NODES TABLE (unified pages + blocks)
-- ============================================================
DEFINE TABLE nodes SCHEMALESS;

-- Core fields
DEFINE FIELD id ON nodes TYPE string;
DEFINE FIELD uuid ON nodes TYPE string ASSERT string::len($value) > 0;
DEFINE FIELD workspace ON nodes TYPE record<workspaces>;
DEFINE FIELD page_name ON nodes TYPE string ASSERT string::len($value) > 0;
DEFINE FIELD slug ON nodes TYPE string;
DEFINE FIELD title ON nodes TYPE string;
DEFINE FIELD namespace ON nodes TYPE string;
DEFINE FIELD depth ON nodes TYPE number DEFAULT 0;

-- Hierarchy
DEFINE FIELD parent ON nodes TYPE option<record<nodes>>;
DEFINE FIELD order ON nodes TYPE number DEFAULT 0;

-- Content
DEFINE FIELD html ON nodes TYPE option<string>;
DEFINE FIELD metadata ON nodes TYPE option<object>;

-- Timestamps
DEFINE FIELD created_at ON nodes TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON nodes TYPE datetime DEFAULT time::now();

-- Indexes for performance
DEFINE INDEX workspace_namespace ON nodes COLUMNS workspace, namespace;
DEFINE INDEX workspace_page_name ON nodes COLUMNS workspace, page_name;
DEFINE INDEX workspace_parent ON nodes COLUMNS workspace, parent;
DEFINE INDEX uuid_idx ON nodes COLUMNS uuid;
DEFINE INDEX parent_idx ON nodes COLUMNS parent;

-- ============================================================
-- PARENT RELATION TABLE (graph edges)
-- ============================================================
-- This table stores the parent-child relationships between nodes
-- Enables efficient graph traversal with SurrealDB's <-parent* syntax
DEFINE TABLE parent TYPE RELATION IN nodes OUT nodes;

-- Deployment history table
DEFINE TABLE deployment_history SCHEMALESS;
DEFINE FIELD id ON deployment_history TYPE string;
DEFINE FIELD workspace_id ON deployment_history TYPE record<workspaces>;
DEFINE FIELD commit_sha ON deployment_history TYPE string;
DEFINE FIELD status ON deployment_history TYPE string DEFAULT "pending";
DEFINE FIELD error_log ON deployment_history TYPE option<string>;
DEFINE FIELD deployed_at ON deployment_history TYPE datetime DEFAULT time::now();
DEFINE INDEX workspace_id_idx ON deployment_history COLUMNS workspace_id;
DEFINE INDEX status_idx ON deployment_history COLUMNS status;
