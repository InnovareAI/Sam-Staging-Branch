-- Delete ny@3cubed.ai user (Noriko Yokoi)
-- User ID: 567ba664-812c-4bed-8c2f-96113b99f899
-- Run this in Supabase SQL Editor

-- Found references:
-- - sam_conversation_messages: 12 rows
-- - sam_conversation_threads: 7 rows

-- Step 1: Delete SAM conversation messages (12 rows)
DELETE FROM sam_conversation_messages
WHERE user_id = '567ba664-812c-4bed-8c2f-96113b99f899';

-- Step 2: Delete SAM conversation threads (7 rows)
DELETE FROM sam_conversation_threads
WHERE user_id = '567ba664-812c-4bed-8c2f-96113b99f899';

-- Step 3: Delete from auth.users (will cascade to auth-related tables)
DELETE FROM auth.users
WHERE id = '567ba664-812c-4bed-8c2f-96113b99f899';

-- Verify deletion (should all return 0)
SELECT 'auth.users check:' as status, COUNT(*) as count
FROM auth.users
WHERE id = '567ba664-812c-4bed-8c2f-96113b99f899'
UNION ALL
SELECT 'sam_conversation_messages check:' as status, COUNT(*) as count
FROM sam_conversation_messages
WHERE user_id = '567ba664-812c-4bed-8c2f-96113b99f899'
UNION ALL
SELECT 'sam_conversation_threads check:' as status, COUNT(*) as count
FROM sam_conversation_threads
WHERE user_id = '567ba664-812c-4bed-8c2f-96113b99f899';

-- Should show:
-- auth.users check: 0
-- sam_conversation_messages check: 0
-- sam_conversation_threads check: 0
