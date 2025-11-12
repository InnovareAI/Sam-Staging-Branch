-- Delete ny@3cubed.ai user (Noriko Yokoi)
-- Run this in Supabase SQL Editor

-- User ID: 567ba664-812c-4bed-8c2f-96113b99f899
-- Email: ny@3cubed.ai

-- Step 1: Delete from auth.users table
-- This will cascade to other auth tables
DELETE FROM auth.users
WHERE id = '567ba664-812c-4bed-8c2f-96113b99f899';

-- Verify deletion
SELECT email, id FROM auth.users WHERE id = '567ba664-812c-4bed-8c2f-96113b99f899';
-- Should return 0 rows if successful
