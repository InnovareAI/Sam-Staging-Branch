// ============================================================================
// Supabase Edge Function: Daily Health Report Email
// ============================================================================
// Purpose: Send daily email with system health status
// Trigger: Called by pg_cron at 7:00 AM UTC daily
// Sends: Email via Postmark with health check results
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const POSTMARK_API_KEY = Deno.env.get('POSTMARK_SERVER_TOKEN')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ALERT_EMAILS = 'tl@innovareai.com,cl@innovareai.com'

interface CronJobResult {
  job_name: string
  last_run: string
  status: string
  details: any
}

serve(async (req) => {
  try {
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get latest status from all cron jobs
    const { data: cronResults, error } = await supabase.rpc('get_latest_cron_status')

    if (error) {
      console.error('Error fetching cron results:', error)
      throw error
    }

    const results = cronResults as CronJobResult[]

    // Determine overall status
    const hasErrors = results.some(r => r.status === 'error')
    const hasWarnings = results.some(r => r.status === 'warning')

    let overallStatus: 'healthy' | 'warning' | 'error'
    let statusEmoji: string
    let statusColor: string

    if (hasErrors) {
      overallStatus = 'error'
      statusEmoji = '🔴'
      statusColor = '#dc2626'
    } else if (hasWarnings) {
      overallStatus = 'warning'
      statusEmoji = '⚠️'
      statusColor = '#f59e0b'
    } else {
      overallStatus = 'healthy'
      statusEmoji = '✅'
      statusColor = '#10b981'
    }

    // Build HTML email
    const htmlBody = buildEmailHTML(results, overallStatus, statusEmoji, statusColor)
    const textBody = buildEmailText(results, overallStatus, statusEmoji)

    // Send email via Postmark
    const emailResponse = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': POSTMARK_API_KEY,
      },
      body: JSON.stringify({
        From: 'Sam <sam-health@innovareai.com>',
        To: ALERT_EMAILS,
        Subject: `${statusEmoji} SAM Daily Health Report - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        HtmlBody: htmlBody,
        TextBody: textBody,
        MessageStream: 'outbound',
      }),
    })

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text()
      console.error('Postmark error:', errorText)
      throw new Error(`Failed to send email: ${errorText}`)
    }

    const emailResult = await emailResponse.json()

    return new Response(
      JSON.stringify({
        success: true,
        overall_status: overallStatus,
        checks_run: results.length,
        email_sent: true,
        message_id: emailResult.MessageID,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in send-daily-health-report:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

// ============================================================================
// Email HTML Builder
// ============================================================================

function buildEmailHTML(
  results: CronJobResult[],
  overallStatus: string,
  statusEmoji: string,
  statusColor: string
): string {
  const timestamp = new Date().toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })

  const checksHTML = results
    .map((result) => {
      const checkStatus = result.status === 'success' ? '✅' : result.status === 'warning' ? '⚠️' : '❌'
      const checkColor = result.status === 'success' ? '#10b981' : result.status === 'warning' ? '#f59e0b' : '#dc2626'

      let detailsHTML = ''
      if (result.details) {
        const details = JSON.stringify(result.details, null, 2)
        detailsHTML = `<pre style="background: #1f2937; color: #e5e7eb; padding: 12px; border-radius: 6px; font-size: 12px; overflow-x: auto;">${details}</pre>`
      }

      return `
        <div style="margin-bottom: 24px; padding: 16px; background: #f9fafb; border-left: 4px solid ${checkColor}; border-radius: 8px;">
          <div style="display: flex; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 20px; margin-right: 8px;">${checkStatus}</span>
            <h3 style="margin: 0; color: #111827; font-size: 16px; font-weight: 600;">${formatJobName(result.job_name)}</h3>
          </div>
          <p style="margin: 4px 0; color: #6b7280; font-size: 14px;">
            Last run: ${new Date(result.last_run).toLocaleString()}
          </p>
          ${detailsHTML}
        </div>
      `
    })
    .join('')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SAM Daily Health Report</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700;">SAM Health Report</h1>
      <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">${timestamp}</p>
    </div>

    <!-- Overall Status -->
    <div style="background: white; padding: 24px; border-bottom: 1px solid #e5e7eb;">
      <div style="display: flex; align-items: center; justify-content: center; flex-direction: column;">
        <span style="font-size: 48px; margin-bottom: 8px;">${statusEmoji}</span>
        <h2 style="margin: 0; color: ${statusColor}; font-size: 24px; font-weight: 600; text-transform: uppercase;">${overallStatus}</h2>
        <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 14px;">${results.length} automated checks completed</p>
      </div>
    </div>

    <!-- Health Checks -->
    <div style="background: white; padding: 24px;">
      <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 20px; font-weight: 600;">Health Check Results</h2>
      ${checksHTML}
    </div>

    <!-- Footer -->
    <div style="background: #f9fafb; padding: 24px; border-radius: 0 0 12px 12px; text-align: center;">
      <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px;">
        Automated health checks run daily at 6:00 AM UTC
      </p>
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        📊 View detailed logs in Supabase Dashboard → SQL Editor → <code>SELECT * FROM get_recent_cron_results(7);</code>
      </p>
    </div>

  </div>
</body>
</html>
  `
}

// ============================================================================
// Email Text Builder (Plain Text Version)
// ============================================================================

function buildEmailText(
  results: CronJobResult[],
  overallStatus: string,
  statusEmoji: string
): string {
  const timestamp = new Date().toLocaleString()

  const checksText = results
    .map((result) => {
      const checkStatus = result.status === 'success' ? '✅' : result.status === 'warning' ? '⚠️' : '❌'
      const details = result.details ? `\n${JSON.stringify(result.details, null, 2)}` : ''

      return `
${checkStatus} ${formatJobName(result.job_name)}
Last run: ${new Date(result.last_run).toLocaleString()}
Status: ${result.status}${details}
      `
    })
    .join('\n' + '─'.repeat(60) + '\n')

  return `
SAM DAILY HEALTH REPORT
${timestamp}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OVERALL STATUS: ${statusEmoji} ${overallStatus.toUpperCase()}
Checks completed: ${results.length}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HEALTH CHECK RESULTS:

${checksText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This is an automated report sent daily at 6:00 AM UTC.
View detailed logs in Supabase Dashboard.
  `.trim()
}

// ============================================================================
// Helper: Format Job Names
// ============================================================================

function formatJobName(jobName: string): string {
  return jobName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
