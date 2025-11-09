-- ============================================================================
-- COMPLETE DAILY EMAIL SYSTEM DEPLOYMENT
-- ============================================================================
-- Purpose: Enable http extension and deploy daily email cron job
-- ============================================================================

-- STEP 1: Enable http extension (required for Edge Function calls)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS http;

-- STEP 2: Create function to send daily health report email
-- ============================================================================
CREATE OR REPLACE FUNCTION send_daily_health_report_email()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_function_url TEXT;
  v_response TEXT;
BEGIN
  -- Edge Function URL
  v_function_url := 'https://latxadqrvrrrcvkktrog.supabase.co/functions/v1/send-daily-health-report';

  -- Call the Edge Function using http extension
  SELECT content::text INTO v_response
  FROM http_post(
    v_function_url,
    '{}',
    'application/json'
  );

  -- Log that email was sent
  INSERT INTO public.cron_job_logs (job_name, status, details)
  VALUES (
    'send_daily_email_report',
    'success',
    jsonb_build_object(
      'email_sent', true,
      'response', v_response
    )
  );

EXCEPTION WHEN OTHERS THEN
  -- Log error if email fails
  INSERT INTO public.cron_job_logs (job_name, status, details)
  VALUES (
    'send_daily_email_report',
    'error',
    jsonb_build_object(
      'error', SQLERRM
    )
  );
END;
$$;

-- STEP 3: Schedule daily email at 7:00 AM UTC
-- ============================================================================
SELECT cron.schedule(
  'daily-email-report',
  '0 7 * * *',
  'SELECT send_daily_health_report_email();'
);

-- STEP 4: Verify deployment
-- ============================================================================
SELECT
  '✅ Daily email report cron job scheduled' AS status,
  jobid,
  schedule,
  command
FROM cron.job
WHERE command LIKE '%send_daily_health_report_email%';
