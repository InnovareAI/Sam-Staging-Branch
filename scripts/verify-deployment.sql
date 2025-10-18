-- SuperAdmin Analytics Deployment Verification Script
-- Run this in Supabase SQL Editor AFTER running the migration

-- 1. Verify all tables exist
SELECT 
  'Tables Created' as check_name,
  COUNT(*) as found,
  6 as expected
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'conversation_analytics',
  'system_health_logs',
  'system_alerts',
  'qa_autofix_logs',
  'deployment_logs',
  'user_sessions'
);

-- 2. Verify user subscription columns
SELECT 
  'User Columns Added' as check_name,
  COUNT(*) as found,
  6 as expected
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN (
  'subscription_status',
  'subscription_plan',
  'billing_cycle',
  'trial_ends_at',
  'cancelled_at',
  'cancellation_reason'
);

-- 3. Verify RLS is enabled
SELECT 
  'RLS Enabled' as check_name,
  COUNT(*) as found,
  6 as expected
FROM pg_tables 
WHERE tablename IN (
  'conversation_analytics',
  'system_health_logs',
  'system_alerts',
  'qa_autofix_logs',
  'deployment_logs',
  'user_sessions'
)
AND schemaname = 'public'
AND rowsecurity = true;

-- 4. Verify helper functions exist
SELECT 
  'Helper Functions' as check_name,
  COUNT(*) as found,
  3 as expected
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN (
  'log_system_health',
  'create_system_alert',
  'track_conversation_analytics'
);

-- 5. Check user subscription backfill
SELECT 
  'User Backfill Stats' as check_name,
  subscription_status,
  COUNT(*) as user_count
FROM users
GROUP BY subscription_status
ORDER BY subscription_status;

-- 6. Verify RLS policies
SELECT 
  'RLS Policies' as check_name,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename IN (
  'conversation_analytics',
  'system_health_logs',
  'system_alerts',
  'qa_autofix_logs',
  'deployment_logs',
  'user_sessions'
)
GROUP BY tablename
ORDER BY tablename;

-- 7. Test helper function (this will create a test log)
SELECT 'Test Helper Functions' as check_name;
SELECT log_system_health('api', 'healthy', 100, NULL);
SELECT create_system_alert('info', 'deployment', 'Deployment Verification', 'SuperAdmin analytics deployed successfully', '{"version": "1.0"}'::jsonb);

-- 8. Verify test data was created
SELECT 
  'Test Data Created' as check_name,
  (SELECT COUNT(*) FROM system_health_logs) as health_logs,
  (SELECT COUNT(*) FROM system_alerts) as alerts;

-- Final Summary
SELECT 
  '✅ DEPLOYMENT VERIFICATION COMPLETE' as status,
  NOW() as verified_at;
