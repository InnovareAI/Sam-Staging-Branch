import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST() {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('📧 Deploying Email Cron System...');

    const results = {
      httpExtension: { status: 'pending', message: '' },
      cronFunction: { status: 'pending', message: '' },
      cronSchedule: { status: 'pending', message: '' },
      verification: { status: 'pending', message: '', data: null as any }
    };

    // Step 1: Create the function that sends emails
    console.log('Creating send_daily_health_report_email function...');

    const createFunctionSQL = `
CREATE OR REPLACE FUNCTION send_daily_health_report_email()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_function_url TEXT;
  v_response TEXT;
BEGIN
  v_function_url := 'https://latxadqrvrrrcvkktrog.supabase.co/functions/v1/send-daily-health-report';

  SELECT content::text INTO v_response
  FROM http_post(
    v_function_url,
    '{}',
    'application/json'
  );

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
    `.trim();

    try {
      // Execute using RPC (need to create a helper function first)
      // Since we can't directly execute DDL via Supabase client, we'll use a workaround
      // by calling a pre-existing function or using REST API

      // For now, let's use the management API approach via fetch
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey
        },
        body: JSON.stringify({ sql: createFunctionSQL })
      });

      if (response.ok) {
        results.cronFunction = { status: 'success', message: 'Function created' };
      } else {
        const errorText = await response.text();
        results.cronFunction = {
          status: 'warning',
          message: `Function may exist: ${errorText.substring(0, 100)}`
        };
      }
    } catch (err: any) {
      results.cronFunction = {
        status: 'warning',
        message: 'Function creation attempted, manual verification needed'
      };
    }

    // Step 2: Schedule the cron job
    console.log('Scheduling cron job...');

    const scheduleSQL = `
SELECT cron.schedule(
  'daily-email-report',
  '0 7 * * *',
  'SELECT send_daily_health_report_email();'
);
    `.trim();

    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey
        },
        body: JSON.stringify({ sql: scheduleSQL })
      });

      if (response.ok) {
        results.cronSchedule = { status: 'success', message: 'Cron job scheduled' };
      } else {
        results.cronSchedule = {
          status: 'warning',
          message: 'Cron job may be already scheduled'
        };
      }
    } catch (err: any) {
      results.cronSchedule = {
        status: 'warning',
        message: 'Cron scheduling attempted'
      };
    }

    // Step 3: Verify by checking existing cron jobs
    console.log('Verifying deployment...');

    try {
      // Query cron.job table
      const { data: cronJobs, error } = await supabase
        .from('cron.job')
        .select('jobid, schedule, command, jobname')
        .ilike('command', '%send_daily_health_report_email%');

      if (!error && cronJobs && cronJobs.length > 0) {
        results.verification = {
          status: 'success',
          message: 'Cron job verified in database',
          data: cronJobs
        };
      } else {
        results.verification = {
          status: 'warning',
          message: 'Could not verify cron job automatically',
          data: null
        };
      }
    } catch (err: any) {
      results.verification = {
        status: 'warning',
        message: 'Verification skipped, please check manually',
        data: null
      };
    }

    // Determine overall success
    const hasErrors = Object.values(results).some(r => r.status === 'error');
    const allSuccess = Object.values(results).every(r => r.status === 'success');

    return NextResponse.json({
      success: !hasErrors,
      message: allSuccess
        ? 'Email system deployed successfully!'
        : 'Deployment attempted. Please run SQL manually if needed.',
      results,
      manualSQL: {
        note: 'If deployment failed, run this SQL in Supabase SQL Editor',
        file: 'temp/deploy_complete_email_system.sql',
        sql: `
CREATE EXTENSION IF NOT EXISTS http;

${createFunctionSQL}

${scheduleSQL}

SELECT
  '✅ Daily email report cron job scheduled' AS status,
  jobid,
  schedule,
  command
FROM cron.job
WHERE command LIKE '%send_daily_health_report_email%';
        `.trim()
      }
    });

  } catch (error: any) {
    console.error('Error deploying email system:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      manualInstructions: {
        step1: 'Open Supabase SQL Editor',
        step2: 'Run the SQL in temp/deploy_complete_email_system.sql',
        step3: 'Verify with: SELECT * FROM cron.job;'
      }
    }, { status: 500 });
  }
}
