-- Workspace Invitations Deployment Verification
-- Run this in Supabase SQL Editor to verify the migration was applied

-- 1. Check if table exists
SELECT
  CASE
    WHEN EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'workspace_invitations'
    )
    THEN '✅ workspace_invitations table exists'
    ELSE '❌ workspace_invitations table MISSING'
  END as table_status;

-- 2. Check if indexes exist
SELECT
  indexname,
  '✅ Index exists' as status
FROM pg_indexes
WHERE tablename = 'workspace_invitations'
ORDER BY indexname;

-- 3. Check if functions exist
SELECT
  routine_name,
  '✅ Function exists' as status
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('generate_invitation_token', 'is_invitation_valid', 'accept_workspace_invitation');

-- 4. Check RLS policies
SELECT
  policyname,
  '✅ Policy exists' as status
FROM pg_policies
WHERE tablename = 'workspace_invitations'
ORDER BY policyname;

-- 5. If table doesn't exist, show deployment status
SELECT
  CASE
    WHEN NOT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'workspace_invitations'
    )
    THEN '❌ MIGRATION NOT APPLIED - Please run the migration file manually in Supabase SQL Editor'
    ELSE '✅ ALL GOOD - Migration is deployed'
  END as deployment_status;
