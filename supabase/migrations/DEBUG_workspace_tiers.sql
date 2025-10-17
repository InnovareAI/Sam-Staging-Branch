-- Debug: Check workspace_tiers table status

-- 1. Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'workspace_tiers'
) as table_exists;

-- 2. Check all columns in workspace_tiers
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'workspace_tiers'
ORDER BY ordinal_position;

-- 3. Check sample data
SELECT * FROM workspace_tiers LIMIT 3;

-- 4. Try adding column manually to see error message
ALTER TABLE workspace_tiers
ADD COLUMN IF NOT EXISTS lead_search_tier TEXT DEFAULT 'external';
