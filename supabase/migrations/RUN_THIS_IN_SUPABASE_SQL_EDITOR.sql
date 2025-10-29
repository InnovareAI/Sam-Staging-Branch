-- ============================================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- ============================================================================
-- Purpose: Add prospect ownership tracking for LinkedIn TOS compliance
-- Date: 2025-10-29
--
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Copy and paste this entire file
-- 3. Click "Run"
-- 4. Verify success in output
-- ============================================================================

-- Step 1: Add added_by column to workspace_prospects
ALTER TABLE workspace_prospects
ADD COLUMN IF NOT EXISTS added_by UUID REFERENCES auth.users(id);

-- Step 2: Add added_by column to campaign_prospects
ALTER TABLE campaign_prospects
ADD COLUMN IF NOT EXISTS added_by UUID REFERENCES auth.users(id);

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspace_prospects_added_by
ON workspace_prospects(added_by);

CREATE INDEX IF NOT EXISTS idx_campaign_prospects_added_by
ON campaign_prospects(added_by);

-- Step 4: Add comments for documentation
COMMENT ON COLUMN workspace_prospects.added_by IS
'User who added this prospect - REQUIRED for LinkedIn TOS compliance. Prospects can ONLY be messaged by the user who added them.';

COMMENT ON COLUMN campaign_prospects.added_by IS
'User who added this prospect to campaign - REQUIRED for LinkedIn TOS compliance. Prevents account sharing violations.';

-- Step 5: Verify columns were added
DO $$
DECLARE
  wp_has_column BOOLEAN;
  cp_has_column BOOLEAN;
BEGIN
  -- Check workspace_prospects
  SELECT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_name = 'workspace_prospects'
    AND column_name = 'added_by'
  ) INTO wp_has_column;

  -- Check campaign_prospects
  SELECT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_name = 'campaign_prospects'
    AND column_name = 'added_by'
  ) INTO cp_has_column;

  -- Report results
  IF wp_has_column AND cp_has_column THEN
    RAISE NOTICE '✅ SUCCESS: Both columns added successfully!';
    RAISE NOTICE '   - workspace_prospects.added_by: EXISTS';
    RAISE NOTICE '   - campaign_prospects.added_by: EXISTS';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  NEXT STEP: Run the backfill script:';
    RAISE NOTICE '   node scripts/js/add-prospect-ownership.mjs';
  ELSE
    RAISE WARNING '❌ ERROR: Columns not added properly';
    IF NOT wp_has_column THEN
      RAISE WARNING '   - workspace_prospects.added_by: MISSING';
    END IF;
    IF NOT cp_has_column THEN
      RAISE WARNING '   - campaign_prospects.added_by: MISSING';
    END IF;
  END IF;
END $$;
