-- Migration: Add prospect ownership tracking for LinkedIn TOS compliance
-- Date: 2025-10-29
-- Purpose: Ensure users can ONLY message prospects they personally added

-- Step 1: Add added_by column to workspace_prospects
ALTER TABLE workspace_prospects
ADD COLUMN IF NOT EXISTS added_by UUID REFERENCES auth.users(id);

-- Step 2: Add added_by column to campaign_prospects
ALTER TABLE campaign_prospects
ADD COLUMN IF NOT EXISTS added_by UUID REFERENCES auth.users(id);

-- Step 3: Create index for performance
CREATE INDEX IF NOT EXISTS idx_workspace_prospects_added_by ON workspace_prospects(added_by);
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_added_by ON campaign_prospects(added_by);

-- Step 4: Backfill existing workspace_prospects with campaign creator
-- Find the user who created campaigns containing these prospects
UPDATE workspace_prospects wp
SET added_by = c.created_by
FROM campaign_prospects cp
JOIN campaigns c ON c.id = cp.campaign_id
WHERE wp.id = cp.prospect_id
  AND wp.added_by IS NULL
  AND cp.campaign_id IN (
    SELECT DISTINCT campaign_id
    FROM campaign_prospects
    WHERE prospect_id = wp.id
    LIMIT 1
  );

-- Step 5: Backfill campaign_prospects with campaign creator
UPDATE campaign_prospects cp
SET added_by = c.created_by
FROM campaigns c
WHERE cp.campaign_id = c.id
  AND cp.added_by IS NULL;

-- Step 6: Add comment for documentation
COMMENT ON COLUMN workspace_prospects.added_by IS 'User who added this prospect - required for LinkedIn TOS compliance';
COMMENT ON COLUMN campaign_prospects.added_by IS 'User who added this prospect to campaign - required for LinkedIn TOS compliance';

-- Step 7: Make added_by NOT NULL for future records (existing records can be null for now)
-- We'll enforce this in application code for new records

-- Verification queries
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully';
  RAISE NOTICE 'workspace_prospects with added_by: %', (SELECT COUNT(*) FROM workspace_prospects WHERE added_by IS NOT NULL);
  RAISE NOTICE 'campaign_prospects with added_by: %', (SELECT COUNT(*) FROM campaign_prospects WHERE added_by IS NOT NULL);
END $$;
