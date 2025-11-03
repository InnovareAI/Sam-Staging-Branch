-- Migration: Add workspace_id to prospect_approval_data table
-- Date: 2025-11-03
-- Purpose: Replace session_id-based isolation with workspace_id for proper multi-tenant security

-- Step 1: Add workspace_id column (nullable initially)
ALTER TABLE prospect_approval_data
ADD COLUMN IF NOT EXISTS workspace_id UUID;

-- Step 2: Create index for performance
CREATE INDEX IF NOT EXISTS idx_prospect_approval_data_workspace_id
ON prospect_approval_data(workspace_id);

-- Step 3: Backfill workspace_id from prospect_approval_sessions
UPDATE prospect_approval_data pad
SET workspace_id = pas.workspace_id
FROM prospect_approval_sessions pas
WHERE pad.session_id = pas.id
  AND pad.workspace_id IS NULL;

-- Step 4: Verify backfill
DO $$
DECLARE
  total_count INTEGER;
  filled_count INTEGER;
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM prospect_approval_data;
  SELECT COUNT(*) INTO filled_count FROM prospect_approval_data WHERE workspace_id IS NOT NULL;
  SELECT COUNT(*) INTO null_count FROM prospect_approval_data WHERE workspace_id IS NULL;

  RAISE NOTICE '✅ Migration Progress:';
  RAISE NOTICE '   Total records: %', total_count;
  RAISE NOTICE '   With workspace_id: %', filled_count;
  RAISE NOTICE '   Still NULL: %', null_count;

  IF null_count > 0 THEN
    RAISE NOTICE '⚠️  Some records could not be backfilled (orphaned sessions)';
  ELSE
    RAISE NOTICE '✅ All records successfully backfilled!';
  END IF;
END $$;

-- Step 5: Add NOT NULL constraint (only after backfill is complete)
-- UNCOMMENT THIS AFTER VERIFYING BACKFILL:
-- ALTER TABLE prospect_approval_data
-- ALTER COLUMN workspace_id SET NOT NULL;

-- Step 6: Add foreign key constraint (optional, for referential integrity)
-- UNCOMMENT THIS AFTER ADDING NOT NULL:
-- ALTER TABLE prospect_approval_data
-- ADD CONSTRAINT fk_prospect_approval_data_workspace
-- FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
-- ON DELETE CASCADE;

-- Step 7: Add comment
COMMENT ON COLUMN prospect_approval_data.workspace_id IS
'Workspace ID for multi-tenant isolation. Replaces session_id-based isolation.';

RAISE NOTICE '✅ Migration complete! Review the output above.';
RAISE NOTICE '';
RAISE NOTICE '📋 Next Steps:';
RAISE NOTICE '1. Verify all records have workspace_id populated';
RAISE NOTICE '2. Uncomment NOT NULL constraint in this file';
RAISE NOTICE '3. Re-run migration to apply NOT NULL constraint';
RAISE NOTICE '4. Uncomment foreign key constraint';
RAISE NOTICE '5. Re-run migration to apply foreign key';
RAISE NOTICE '6. Update RLS policies to use workspace_id instead of session_id';
