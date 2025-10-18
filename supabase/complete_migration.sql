-- Complete SuperAdmin Analytics Migration
-- Only adds missing columns (safe to run multiple times)

-- Add missing user subscription columns (only if they don't exist)
DO $$ 
BEGIN
  -- Add subscription_plan column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'subscription_plan'
  ) THEN
    ALTER TABLE users ADD COLUMN subscription_plan TEXT;
    COMMENT ON COLUMN users.subscription_plan IS 'Subscription tier (free, starter, pro, enterprise)';
  END IF;

  -- Add billing_cycle column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'billing_cycle'
  ) THEN
    ALTER TABLE users ADD COLUMN billing_cycle TEXT;
    COMMENT ON COLUMN users.billing_cycle IS 'Billing frequency (monthly, yearly)';
  END IF;
END $$;

-- Verify all 6 columns now exist
SELECT 
  'User Subscription Columns' as status,
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

-- Verify all analytics tables exist
SELECT 
  'Analytics Tables' as status,
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

-- Verify helper functions exist
SELECT 
  'Helper Functions' as status,
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

-- Show success message
SELECT '✅ SuperAdmin Analytics Migration Complete!' as result;
