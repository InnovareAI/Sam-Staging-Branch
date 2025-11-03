-- Fix Orphaned SAM Conversation Threads
-- These threads belong to tl@innovareai.com from the old team workspace model
-- Reassigning to InnovareAI Workspace (individual workspace)

BEGIN;

DO $$
DECLARE
  old_workspace_id UUID := 'ffed2d0f-a5a7-4d46-b221-b673a412bf44';
  new_workspace_id UUID := 'babdcab8-1a78-4b2f-913e-6e9fd9821009'; -- InnovareAI Workspace
  thread_count INTEGER;
  message_count INTEGER;
BEGIN
  RAISE NOTICE '🔧 Fixing Orphaned SAM Conversation Threads';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Old (team) workspace_id: %', old_workspace_id;
  RAISE NOTICE 'New (individual) workspace_id: %', new_workspace_id;
  RAISE NOTICE 'User: tl@innovareai.com';
  RAISE NOTICE '';

  -- Count threads to fix
  SELECT COUNT(*) INTO thread_count
  FROM sam_conversation_threads
  WHERE workspace_id = old_workspace_id;

  RAISE NOTICE 'Threads to reassign: %', thread_count;

  -- Count messages in those threads
  SELECT COUNT(*) INTO message_count
  FROM sam_conversation_messages scm
  JOIN sam_conversation_threads sct ON scm.thread_id = sct.id
  WHERE sct.workspace_id = old_workspace_id;

  RAISE NOTICE 'Messages in those threads: %', message_count;
  RAISE NOTICE '';

  -- Update threads
  UPDATE sam_conversation_threads
  SET workspace_id = new_workspace_id
  WHERE workspace_id = old_workspace_id;

  RAISE NOTICE '✅ Threads reassigned to InnovareAI Workspace';
  RAISE NOTICE '';

  -- Verify no orphaned threads remain
  SELECT COUNT(*) INTO thread_count
  FROM sam_conversation_threads sct
  LEFT JOIN workspaces w ON sct.workspace_id = w.id
  WHERE w.id IS NULL;

  IF thread_count > 0 THEN
    RAISE EXCEPTION 'Still have % orphaned threads!', thread_count;
  END IF;

  RAISE NOTICE '✅ Verification: No orphaned threads remaining';
  RAISE NOTICE '================================================';
END $$;

COMMIT;
