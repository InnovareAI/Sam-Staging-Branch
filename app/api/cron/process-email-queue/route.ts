import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import moment from 'moment-timezone';

/**
 * Cron Job: Process Email Send Queue
 *
 * Runs every 13-14 minutes to send queued emails
 * One email per execution (safe, compliant approach)
 *
 * POST /api/cron/process-email-queue
 * Header: x-cron-secret (for security)
 *
 * COMPLIANCE:
 * - Max 40 emails per day
 * - Business hours: 8 AM - 5 PM
 * - No weekends
 * - No holidays
 * - ~13.5 minute intervals
 *
 * Cronjob.org setup:
 * - URL: https://app.meet-sam.com/api/cron/process-email-queue
 * - Schedule: Every 13 minutes
 * - Headers: x-cron-secret: CRON_SECRET
 */

export const maxDuration = 60; // 60 seconds

const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;

// Public holidays (US holidays 2025-2026)
const PUBLIC_HOLIDAYS = [
  '2025-01-01', '2025-01-20', '2025-02-17', '2025-05-26',
  '2025-06-19', '2025-07-04', '2025-09-01', '2025-11-11',
  '2025-11-27', '2025-12-25', '2026-01-01', '2026-01-19'
];

// Check if we can send now (business hours, not weekend/holiday)
function canSendEmailNow(timezone = 'America/New_York'): boolean {
  const now = moment().tz(timezone);

  // Check weekend
  const day = now.day(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) {
    console.log(`⏸️  Weekend - no emails sent (${now.format('llll')})`);
    return false;
  }

  // Check business hours (8 AM - 5 PM)
  const hour = now.hour();
  if (hour < 8 || hour >= 17) {
    console.log(`⏸️  Outside business hours (${hour}:00) - no emails sent`);
    return false;
  }

  // Check holidays
  const dateStr = now.format('YYYY-MM-DD');
  if (PUBLIC_HOLIDAYS.includes(dateStr)) {
    console.log(`🎉 Holiday (${dateStr}) - no emails sent`);
    return false;
  }

  return true;
}

// Send email via Unipile
async function sendEmailViaUnipile(params: {
  account_id: string;
  to: string;
  subject: string;
  body: string;
  from_name?: string;
}): Promise<{ success: boolean; message_id?: string; error?: string }> {
  try {
    // Unipile email API requires 'to' as array of objects with display_name and identifier
    const requestBody = {
      account_id: params.account_id,
      to: [
        {
          display_name: params.to.split('@')[0], // Use email prefix as display name
          identifier: params.to
        }
      ],
      subject: params.subject,
      body: params.body
    };

    console.log(`📤 Sending email via Unipile to: ${params.to}`);

    // CORRECT ENDPOINT: /api/v1/emails (not /api/v1/messages/send)
    const response = await fetch(`${UNIPILE_BASE_URL}/api/v1/emails`, {
      method: 'POST',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.message || `HTTP ${response.status}`
      };
    }

    const data = await response.json();
    return {
      success: true,
      message_id: data.message_id || data.id
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    };
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Security: Verify cron secret
    const cronSecret = request.headers.get('x-cron-secret');
    if (cronSecret !== process.env.CRON_SECRET) {
      console.error('❌ Invalid cron secret');
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    console.log('📧 Email queue processor starting...');

    // Check if we can send emails now
    if (!canSendEmailNow()) {
      return NextResponse.json({
        success: true,
        message: 'Outside business hours or weekend/holiday - no emails sent',
        processed: 0
      });
    }

    // Create Supabase client with service role key (bypasses RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // COMPLIANCE: Check daily quota (40 emails max per day)
    const today = moment().tz('America/New_York').startOf('day').toISOString();
    const { count: sentToday } = await supabase
      .from('email_send_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('sent_at', today);

    const DAILY_LIMIT = 40;
    if ((sentToday || 0) >= DAILY_LIMIT) {
      console.log(`⏸️  Daily email limit reached (${sentToday}/${DAILY_LIMIT}) - no more emails today`);
      return NextResponse.json({
        success: true,
        message: `Daily email limit reached (${sentToday}/${DAILY_LIMIT})`,
        processed: 0,
        daily_sent: sentToday
      });
    }

    // Find next email to send (scheduled_for <= NOW, status = pending)
    // Include campaign data for workspace_id
    const { data: nextEmail, error: fetchError } = await supabase
      .from('email_send_queue')
      .select(`
        *,
        campaigns!campaign_id (
          workspace_id
        ),
        campaign_prospects!prospect_id (
          first_name,
          last_name
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(1)
      .single();

    if (fetchError || !nextEmail) {
      console.log('ℹ️  No emails ready to send');
      return NextResponse.json({
        success: true,
        message: 'No emails ready to send',
        processed: 0
      });
    }

    console.log(`📤 Sending email to: ${nextEmail.recipient_email}`);
    console.log(`📧 Subject: ${nextEmail.subject}`);

    // CRITICAL: Check if prospect has replied - stop messaging immediately
    const { data: prospect } = await supabase
      .from('campaign_prospects')
      .select('status, responded_at')
      .eq('id', nextEmail.prospect_id)
      .single();

    if (prospect?.responded_at || prospect?.status === 'replied') {
      console.log(`⏹️  Prospect ${nextEmail.recipient_email} has replied - cancelling email`);

      // Cancel this email and all future emails for this prospect
      await supabase
        .from('email_send_queue')
        .update({
          status: 'cancelled',
          error_message: 'Prospect replied - sequence stopped',
          updated_at: new Date().toISOString()
        })
        .eq('prospect_id', nextEmail.prospect_id)
        .eq('status', 'pending');

      return NextResponse.json({
        success: true,
        message: 'Email cancelled - prospect has replied',
        processed: 0,
        cancelled_for: nextEmail.recipient_email
      });
    }

    // Send email via Unipile
    const sendResult = await sendEmailViaUnipile({
      account_id: nextEmail.email_account_id,
      to: nextEmail.recipient_email,
      subject: nextEmail.subject,
      body: nextEmail.body,
      from_name: nextEmail.from_name
    });

    if (!sendResult.success) {
      console.error(`❌ Failed to send email: ${sendResult.error}`);

      // Update queue record with error
      await supabase
        .from('email_send_queue')
        .update({
          status: 'failed',
          error_message: sendResult.error,
          updated_at: new Date().toISOString()
        })
        .eq('id', nextEmail.id);

      // Update prospect status
      await supabase
        .from('campaign_prospects')
        .update({
          status: 'error',
          updated_at: new Date().toISOString()
        })
        .eq('id', nextEmail.prospect_id);

      return NextResponse.json({
        success: false,
        error: sendResult.error,
        email_id: nextEmail.id
      }, { status: 500 });
    }

    console.log(`✅ Email sent successfully (message_id: ${sendResult.message_id})`);

    // Update queue record as sent
    await supabase
      .from('email_send_queue')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        message_id: sendResult.message_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', nextEmail.id);

    // Store in linkedin_messages for unified message history
    const campaign = nextEmail.campaigns as any;
    const prospectData = nextEmail.campaign_prospects as any;
    const recipientName = prospectData
      ? `${prospectData.first_name || ''} ${prospectData.last_name || ''}`.trim()
      : nextEmail.recipient_email.split('@')[0];

    await supabase
      .from('linkedin_messages')
      .insert({
        workspace_id: campaign?.workspace_id,
        campaign_id: nextEmail.campaign_id,
        prospect_id: nextEmail.prospect_id,
        direction: 'outgoing',
        message_type: 'email',
        subject: nextEmail.subject,
        content: nextEmail.body,
        unipile_message_id: sendResult.message_id,
        recipient_name: recipientName,
        status: 'sent',
        sent_at: new Date().toISOString(),
        metadata: {
          source: 'email_queue',
          queue_id: nextEmail.id,
          email_account_id: nextEmail.email_account_id,
          recipient_email: nextEmail.recipient_email
        }
      });

    console.log(`💾 Stored email in linkedin_messages`);

    // Update prospect status
    await supabase
      .from('campaign_prospects')
      .update({
        status: 'email_sent',
        contacted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', nextEmail.prospect_id);

    const duration = Date.now() - startTime;
    console.log(`⏱️  Execution time: ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
      processed: 1,
      email: {
        id: nextEmail.id,
        recipient: nextEmail.recipient_email,
        subject: nextEmail.subject,
        message_id: sendResult.message_id
      },
      execution_time_ms: duration
    });

  } catch (error) {
    console.error('❌ Email queue processor error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
