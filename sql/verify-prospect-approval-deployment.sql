-- ================================================================
-- VERIFICATION QUERIES FOR PROSPECT APPROVAL SYSTEM DEPLOYMENT
-- Run these after deploying the migration to verify everything works
-- ================================================================

-- ================================================================
-- TEST 1: Verify All Tables Exist
-- ================================================================
-- Expected: 6 rows (one for each table)
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = 'public' AND columns.table_name = tables.table_name) as column_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'prospect_approval_sessions',
    'prospect_approval_data',
    'prospect_approval_decisions',
    'prospect_learning_logs',
    'prospect_exports',
    'sam_learning_models'
  )
ORDER BY table_name;

-- Expected Output:
-- prospect_approval_data       | 13
-- prospect_approval_decisions  | 8
-- prospect_approval_sessions   | 13
-- prospect_exports             | 10
-- prospect_learning_logs       | 10
-- sam_learning_models          | 11


-- ================================================================
-- TEST 2: Verify Column Data Types (Critical Check)
-- ================================================================
-- Expected: All user_id, workspace_id, organization_id should be UUID, not TEXT
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'prospect_approval_sessions',
    'prospect_approval_data',
    'prospect_approval_decisions',
    'prospect_learning_logs',
    'prospect_exports',
    'sam_learning_models'
  )
  AND column_name IN ('user_id', 'workspace_id', 'organization_id', 'decided_by')
ORDER BY table_name, column_name;

-- Expected Output:
-- All user_id, workspace_id, organization_id columns should show data_type = 'uuid' (NOT 'text')


-- ================================================================
-- TEST 3: Verify RLS is Enabled on All Tables
-- ================================================================
-- Expected: All 6 tables should have rls_enabled = true
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'prospect_approval_sessions',
    'prospect_approval_data',
    'prospect_approval_decisions',
    'prospect_learning_logs',
    'prospect_exports',
    'sam_learning_models'
  )
ORDER BY tablename;

-- Expected Output:
-- All tables should show: rls_enabled = true (✅)
-- If any show false (❌), RLS is NOT protecting that table!


-- ================================================================
-- TEST 4: Verify RLS Policies Exist
-- ================================================================
-- Expected: 13 policies total
SELECT
  tablename,
  policyname,
  permissive,
  cmd as operation,
  CASE
    WHEN cmd = 'SELECT' THEN 'Read'
    WHEN cmd = 'INSERT' THEN 'Create'
    WHEN cmd = 'UPDATE' THEN 'Update'
    WHEN cmd = 'DELETE' THEN 'Delete'
    WHEN cmd = '*' THEN 'All Operations'
  END as action_type
FROM pg_policies
WHERE schemaname = 'public'
  AND (tablename LIKE 'prospect_%' OR tablename = 'sam_learning_models')
ORDER BY tablename, policyname;

-- Expected Output: Should see policies like:
-- prospect_approval_sessions | Users can view their workspace sessions
-- prospect_approval_sessions | Users can create sessions in their workspace
-- prospect_approval_sessions | Users can update their workspace sessions
-- prospect_approval_data     | Users can view prospect data in their workspace
-- prospect_approval_data     | Users can insert prospect data in their workspace
-- (... and 8 more policies)


-- ================================================================
-- TEST 5: Verify Foreign Keys Are Correct
-- ================================================================
-- Expected: Foreign keys to auth.users, workspaces, organizations
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN (
    'prospect_approval_sessions',
    'prospect_approval_data',
    'prospect_approval_decisions',
    'prospect_learning_logs',
    'prospect_exports',
    'sam_learning_models'
  )
ORDER BY tc.table_name, kcu.column_name;

-- Expected Output: Should see foreign keys like:
-- prospect_approval_sessions | user_id         | users         | id | CASCADE
-- prospect_approval_sessions | workspace_id    | workspaces    | id | CASCADE
-- prospect_approval_sessions | organization_id | organizations | id | CASCADE
-- (... and more)


-- ================================================================
-- TEST 6: Verify Indexes Exist
-- ================================================================
-- Expected: 8 indexes + primary keys
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (tablename LIKE 'prospect_%' OR tablename = 'sam_learning_models')
ORDER BY tablename, indexname;

-- Expected Output: Should see indexes like:
-- idx_prospect_sessions_user_workspace
-- idx_prospect_sessions_org
-- idx_prospect_sessions_status
-- idx_prospect_data_session
-- (... and 4 more)


-- ================================================================
-- TEST 7: Verify Triggers Exist
-- ================================================================
-- Expected: 1 trigger on sam_learning_models
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN (
    'prospect_approval_sessions',
    'prospect_approval_data',
    'prospect_approval_decisions',
    'prospect_learning_logs',
    'prospect_exports',
    'sam_learning_models'
  )
ORDER BY event_object_table, trigger_name;

-- Expected Output:
-- update_sam_learning_models_updated_at | UPDATE | sam_learning_models | ...


-- ================================================================
-- TEST 8: Verify Unique Constraints
-- ================================================================
-- Expected: Unique constraints to prevent duplicates
SELECT
  tc.table_name,
  tc.constraint_name,
  STRING_AGG(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'UNIQUE'
  AND tc.table_schema = 'public'
  AND tc.table_name IN (
    'prospect_approval_sessions',
    'prospect_approval_data',
    'prospect_approval_decisions',
    'prospect_learning_logs',
    'prospect_exports',
    'sam_learning_models'
  )
GROUP BY tc.table_name, tc.constraint_name
ORDER BY tc.table_name;

-- Expected Output:
-- prospect_approval_sessions  | user_id, workspace_id, batch_number
-- prospect_approval_data      | session_id, prospect_id
-- prospect_approval_decisions | session_id, prospect_id
-- sam_learning_models         | user_id, workspace_id, model_type


-- ================================================================
-- TEST 9: Verify Check Constraints
-- ================================================================
-- Expected: Status and decision validation constraints
SELECT
  tc.table_name,
  tc.constraint_name,
  cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'CHECK'
  AND tc.table_name IN (
    'prospect_approval_sessions',
    'prospect_approval_data',
    'prospect_approval_decisions',
    'prospect_learning_logs',
    'prospect_exports',
    'sam_learning_models'
  )
ORDER BY tc.table_name, tc.constraint_name;

-- Expected Output:
-- prospect_approval_sessions  | status IN ('active', 'completed', 'archived')
-- prospect_approval_decisions | decision IN ('approved', 'rejected')
-- prospect_exports            | export_format IN ('json', 'csv', 'google_sheets')
-- sam_learning_models         | model_type IN ('prospect_approval', 'icp_optimization')


-- ================================================================
-- TEST 10: Verify Permissions (GRANTS)
-- ================================================================
-- Expected: authenticated role should have access
SELECT
  table_name,
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN (
    'prospect_approval_sessions',
    'prospect_approval_data',
    'prospect_approval_decisions',
    'prospect_learning_logs',
    'prospect_exports',
    'sam_learning_models'
  )
  AND grantee = 'authenticated'
ORDER BY table_name, privilege_type;

-- Expected Output: Each table should have:
-- SELECT, INSERT, UPDATE, DELETE privileges for 'authenticated' role


-- ================================================================
-- TEST 11: Quick Row Count Check (Should Be Empty)
-- ================================================================
-- Expected: All tables should have 0 rows (fresh deployment)
SELECT
  'prospect_approval_sessions' as table_name,
  COUNT(*) as row_count
FROM prospect_approval_sessions
UNION ALL
SELECT 'prospect_approval_data', COUNT(*) FROM prospect_approval_data
UNION ALL
SELECT 'prospect_approval_decisions', COUNT(*) FROM prospect_approval_decisions
UNION ALL
SELECT 'prospect_learning_logs', COUNT(*) FROM prospect_learning_logs
UNION ALL
SELECT 'prospect_exports', COUNT(*) FROM prospect_exports
UNION ALL
SELECT 'sam_learning_models', COUNT(*) FROM sam_learning_models;

-- Expected Output: All should show 0 rows


-- ================================================================
-- TEST 12: Critical Security Test - RLS Enforcement
-- ================================================================
-- This should FAIL if RLS is working correctly (expected behavior)
-- Run as authenticated user without workspace membership
SET ROLE authenticated;
SELECT COUNT(*) FROM prospect_approval_sessions;
-- Expected: 0 rows (RLS blocks access if not in workspace)
-- If you see any rows without being in a workspace, RLS IS BROKEN!

-- Reset role
RESET ROLE;


-- ================================================================
-- ✅ SUCCESS CRITERIA
-- ================================================================
-- If all tests pass:
-- ✅ All 6 tables created with correct columns
-- ✅ All columns have correct UUID types (not TEXT)
-- ✅ RLS enabled on all 6 tables
-- ✅ 13 RLS policies created
-- ✅ Foreign keys reference correct tables
-- ✅ 8 performance indexes created
-- ✅ 1 trigger for auto-timestamps
-- ✅ Unique constraints prevent duplicates
-- ✅ Check constraints validate data
-- ✅ authenticated role has permissions
-- ✅ Tables are empty (fresh deployment)
-- ✅ RLS blocks unauthorized access

-- ================================================================
-- 🚨 FAILURE INDICATORS
-- ================================================================
-- ❌ Missing tables in TEST 1
-- ❌ TEXT data types instead of UUID in TEST 2
-- ❌ rls_enabled = false in TEST 3
-- ❌ Missing policies in TEST 4
-- ❌ Missing foreign keys in TEST 5
-- ❌ Missing indexes in TEST 6
-- ❌ Can access data without workspace membership in TEST 12

-- ================================================================
-- NEXT STEPS AFTER VERIFICATION
-- ================================================================
-- If all tests pass:
-- 1. Test API routes (POST /api/prospect-approval/session to create test session)
-- 2. Test frontend integration
-- 3. Deploy to staging
-- 4. Run integration tests
-- 5. Deploy to production

-- If any tests fail:
-- 1. Note which test failed
-- 2. Check migration file for errors
-- 3. Drop tables and re-run migration
-- 4. Contact support if foreign key dependencies missing
