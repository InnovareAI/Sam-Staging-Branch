-- ============================================================================
-- QUICK FIX: Run this SQL NOW to enable Commenting Agent feature
-- ============================================================================
-- This adds the required column to workspaces table
-- Run this in Supabase SQL Editor before using the Commenting Agent

-- Step 1: Add the column (REQUIRED - Run this first!)
ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS commenting_agent_enabled BOOLEAN DEFAULT FALSE;

-- Step 2: Create index for performance
CREATE INDEX IF NOT EXISTS idx_workspaces_commenting_enabled
ON workspaces(commenting_agent_enabled)
WHERE commenting_agent_enabled = TRUE;

-- Step 3: Verify it worked
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'workspaces'
  AND column_name = 'commenting_agent_enabled';

-- You should see:
-- column_name                | data_type | column_default
-- ---------------------------|-----------|----------------
-- commenting_agent_enabled   | boolean   | false

-- ✅ Done! Now you can activate the Commenting Agent in AI Configuration
