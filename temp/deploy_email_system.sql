-- ============================================================================
-- Deploy Daily Email System
-- ============================================================================
-- Step 1: Enable http extension
-- Step 2: Deploy email cron job
-- ============================================================================

-- Enable http extension (required for Edge Function calls)
CREATE EXTENSION IF NOT EXISTS http;

-- Run the email cron job migration
\i supabase/migrations/20251109_add_daily_email_cron.sql
