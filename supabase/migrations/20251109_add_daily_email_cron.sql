-- ============================================================================
-- Add Daily Email Report Cron Job
-- ============================================================================
-- Purpose: Trigger Edge Function to send daily health report email
-- Schedule: 7:00 AM UTC daily (after all health checks complete)
-- ============================================================================

-- Create function to call Edge Function
CREATE OR REPLACE FUNCTION send_daily_health_report_email()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_function_url TEXT;
  v_response TEXT;
BEGIN
  -- Get Supabase project URL from environment
  -- Replace YOUR_PROJECT_REF with your actual Supabase project reference
  v_function_url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-daily-health-report';

  -- Call the Edge Function using http extension
  -- Note: Requires http extension to be enabled
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

-- Schedule: Run daily at 7:00 AM UTC (after all health checks)
SELECT cron.schedule(
  'daily-email-report',
  '0 7 * * *',
  'SELECT send_daily_health_report_email();'
);

-- Verify the cron job was created
SELECT
  '✅ Daily email report cron job scheduled' AS status,
  jobid,
  schedule,
  command
FROM cron.job
WHERE command LIKE '%send_daily_health_report_email%';
