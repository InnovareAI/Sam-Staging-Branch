-- Delete ny@3cubed.ai user (Noriko Yokoi) with all related data
-- User ID: 567ba664-812c-4bed-8c2f-96113b99f899
-- Run this in Supabase SQL Editor

-- Step 1: Delete SAM conversation messages
DELETE FROM sam_conversation_messages
WHERE user_id = '567ba664-812c-4bed-8c2f-96113b99f899';

-- Step 2: Delete SAM conversation threads
DELETE FROM sam_conversation_threads
WHERE user_id = '567ba664-812c-4bed-8c2f-96113b99f899';

-- Step 3: Delete workspace members (if any left)
DELETE FROM workspace_members
WHERE user_id = '567ba664-812c-4bed-8c2f-96113b99f899';

-- Step 4: Delete any campaign prospects created by this user
DELETE FROM campaign_prospects
WHERE created_by = '567ba664-812c-4bed-8c2f-96113b99f899';

-- Step 5: Delete any campaigns owned by this user
DELETE FROM campaigns
WHERE created_by = '567ba664-812c-4bed-8c2f-96113b99f899';

-- Step 6: Delete any prospect approvals
DELETE FROM prospect_approval_data
WHERE created_by = '567ba664-812c-4bed-8c2f-96113b99f899';

-- Step 7: Delete any workspace prospects
DELETE FROM workspace_prospects
WHERE created_by = '567ba664-812c-4bed-8c2f-96113b99f899';

-- Step 8: Delete from auth.users (this will cascade to auth-related tables)
DELETE FROM auth.users
WHERE id = '567ba664-812c-4bed-8c2f-96113b99f899';

-- Step 9: Verify deletion (should return 0 rows)
SELECT 'Checking auth.users...' as status;
SELECT email, id FROM auth.users WHERE id = '567ba664-812c-4bed-8c2f-96113b99f899';

SELECT 'Checking sam_conversation_messages...' as status;
SELECT COUNT(*) FROM sam_conversation_messages WHERE user_id = '567ba664-812c-4bed-8c2f-96113b99f899';

SELECT 'Checking workspace_members...' as status;
SELECT COUNT(*) FROM workspace_members WHERE user_id = '567ba664-812c-4bed-8c2f-96113b99f899';

-- Should all return 0
SELECT '✅ User deleted successfully' as result;
