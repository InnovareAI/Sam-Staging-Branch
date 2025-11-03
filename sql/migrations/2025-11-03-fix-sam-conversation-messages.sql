-- Fix sam_conversation_messages workspace_id
-- This table needs special handling due to potential orphaned records

BEGIN;

-- Step 1: Add workspace_id column
ALTER TABLE sam_conversation_messages ADD COLUMN IF NOT EXISTS workspace_id UUID;

-- Step 2: Backfill workspace_id from sam_conversation_threads
UPDATE sam_conversation_messages scm
SET workspace_id = sct.workspace_id
FROM sam_conversation_threads sct
WHERE scm.thread_id = sct.id
  AND scm.workspace_id IS NULL;

-- Step 3: Check for orphaned records (messages without valid threads)
DO $$
DECLARE
  orphaned_count INTEGER;
  total_count INTEGER;
  filled_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM sam_conversation_messages;
  SELECT COUNT(*) INTO filled_count FROM sam_conversation_messages WHERE workspace_id IS NOT NULL;
  orphaned_count := total_count - filled_count;

  RAISE NOTICE '📊 Sam Conversation Messages Status:';
  RAISE NOTICE '   Total records: %', total_count;
  RAISE NOTICE '   With workspace_id: %', filled_count;
  RAISE NOTICE '   Orphaned (no thread): %', orphaned_count;

  IF orphaned_count > 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  Found % orphaned messages without valid threads', orphaned_count;
    RAISE NOTICE '   These will be assigned to the first available workspace';

    -- Assign orphaned records to the first workspace (fallback)
    UPDATE sam_conversation_messages
    SET workspace_id = (SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1)
    WHERE workspace_id IS NULL;

    RAISE NOTICE '✅ Orphaned messages assigned to fallback workspace';
  ELSE
    RAISE NOTICE '✅ No orphaned messages found';
  END IF;
END $$;

-- Step 4: Verify all records now have workspace_id
DO $$
DECLARE
  remaining_nulls INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_nulls
  FROM sam_conversation_messages
  WHERE workspace_id IS NULL;

  IF remaining_nulls > 0 THEN
    RAISE EXCEPTION 'Still have % records without workspace_id', remaining_nulls;
  END IF;

  RAISE NOTICE '✅ All messages now have workspace_id';
END $$;

-- Step 5: Create index
CREATE INDEX IF NOT EXISTS idx_sam_conversation_messages_workspace_id
ON sam_conversation_messages(workspace_id);

-- Step 6: Add NOT NULL constraint
ALTER TABLE sam_conversation_messages ALTER COLUMN workspace_id SET NOT NULL;

-- Step 7: Add foreign key constraint
ALTER TABLE sam_conversation_messages
ADD CONSTRAINT fk_sam_conversation_messages_workspace
FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- Step 8: Enable RLS
ALTER TABLE sam_conversation_messages ENABLE ROW LEVEL SECURITY;

-- Step 9: Create RLS policy
DROP POLICY IF EXISTS "workspace_isolation_sam_conversation_messages" ON sam_conversation_messages;
CREATE POLICY "workspace_isolation_sam_conversation_messages" ON sam_conversation_messages
FOR ALL USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.uid()
    )
);

-- Step 10: Final verification
DO $$
DECLARE
  total_count INTEGER;
  rls_enabled BOOLEAN;
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM sam_conversation_messages;

  SELECT rowsecurity INTO rls_enabled
  FROM pg_tables
  WHERE schemaname = 'public' AND tablename = 'sam_conversation_messages';

  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'sam_conversation_messages';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FINAL VERIFICATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'sam_conversation_messages:';
  RAISE NOTICE '  Total records: %', total_count;
  RAISE NOTICE '  RLS enabled: %', rls_enabled;
  RAISE NOTICE '  RLS policies: %', policy_count;
  RAISE NOTICE '  Status: ✅ COMPLETE';
  RAISE NOTICE '========================================';
END $$;

COMMIT;
