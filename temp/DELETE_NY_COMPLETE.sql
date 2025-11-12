-- Delete ny@3cubed.ai user (Noriko Yokoi) - COMPLETE VERSION
-- User ID: 567ba664-812c-4bed-8c2f-96113b99f899
-- Run this in Supabase SQL Editor

-- Total data to delete:
-- - 12 SAM conversation messages
-- - 7 SAM conversation threads
-- - 120 workspace prospects
-- - 1 auth user record

-- Step 1: Delete SAM conversation messages (12 rows)
DELETE FROM sam_conversation_messages
WHERE user_id = '567ba664-812c-4bed-8c2f-96113b99f899';

-- Step 2: Delete SAM conversation threads (7 rows)
DELETE FROM sam_conversation_threads
WHERE user_id = '567ba664-812c-4bed-8c2f-96113b99f899';

-- Step 3: Delete workspace prospects added by this user (120 rows)
DELETE FROM workspace_prospects
WHERE added_by = '567ba664-812c-4bed-8c2f-96113b99f899';

-- Step 4: Delete the auth user (will cascade to auth-related tables)
DELETE FROM auth.users
WHERE id = '567ba664-812c-4bed-8c2f-96113b99f899';

-- Verify deletion (should all return 0)
SELECT 'Verification Results:' as status, '---' as count
UNION ALL
SELECT 'auth.users:', COUNT(*)::text
FROM auth.users
WHERE id = '567ba664-812c-4bed-8c2f-96113b99f899'
UNION ALL
SELECT 'sam_conversation_messages:', COUNT(*)::text
FROM sam_conversation_messages
WHERE user_id = '567ba664-812c-4bed-8c2f-96113b99f899'
UNION ALL
SELECT 'sam_conversation_threads:', COUNT(*)::text
FROM sam_conversation_threads
WHERE user_id = '567ba664-812c-4bed-8c2f-96113b99f899'
UNION ALL
SELECT 'workspace_prospects:', COUNT(*)::text
FROM workspace_prospects
WHERE added_by = '567ba664-812c-4bed-8c2f-96113b99f899';

-- All counts should be 0
-- If successful, you should see:
-- auth.users: 0
-- sam_conversation_messages: 0
-- sam_conversation_threads: 0
-- workspace_prospects: 0
