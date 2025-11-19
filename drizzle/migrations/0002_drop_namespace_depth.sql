-- Drop columns that were removed from schema
-- All nodes already have empty strings for namespace, so this is safe

-- Drop indexes that depend on namespace column
DROP INDEX IF EXISTS "workspace_namespace_idx";
DROP INDEX IF EXISTS "workspace_namespace_slug_idx";

-- Drop the columns
ALTER TABLE "nodes" DROP COLUMN IF EXISTS "namespace";
ALTER TABLE "nodes" DROP COLUMN IF EXISTS "depth";
