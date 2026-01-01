/**
 * Cron Job: Send Meeting Reminders
 *
 * POST /api/cron/send-meeting-reminders
 *
 * Runs every 5 minutes to:
 * 1. Find due reminders (24h, 1h, 15m before meeting)
 * 2. Generate reminder message
 * 3. Send via Postmark (email) or Unipile (LinkedIn)
 *
 * Created: December 16, 2025
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { generateReminderMessage, MeetingContext } from '@/lib/services/meeting-agent';

export const maxDuration = 60; // 1 minute

const POSTMARK_API_KEY = process.env.POSTMARK_SERVER_TOKEN;
const POSTMARK_FROM_EMAIL = process.env.POSTMARK_FROM_EMAIL || 'sam@meet-sam.com';

export async function POST(req: NextRequest) {
  try {
    // Security check
    const cronSecret = req.headers.get('x-cron-secret');
    if (cronSecret !== process.env.CRON_SECRET) {
      console.warn('⚠️ Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('⏰ Processing meeting reminders...');

    const now = new Date();
    const results = {
      reminders_sent: 0,
      reminders_failed: 0,
      errors: [] as string[],
    };

    // Find due reminders
    const { data: dueReminders, error: fetchError } = await supabase
      .from('meeting_reminders')
      .select(`
        *,
        meetings (
          *,
          campaign_prospects (
            id, first_name, last_name, email, company_name, title, linkedin_url
          )
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', now.toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(20);

    if (fetchError) {
      console.error('Error fetching reminders:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch reminders' }, { status: 500 });
    }

    if (!dueReminders || dueReminders.length === 0) {
      console.log('✅ No reminders due');
      return NextResponse.json({ success: true, reminders_sent: 0 });
    }

    console.log(`📬 Found ${dueReminders.length} reminders to send`);

    for (const reminder of dueReminders) {
      try {
        const meeting = reminder.meetings;
        const prospect = meeting?.campaign_prospects;

        if (!meeting || !prospect) {
          console.log(`   ⏭️ Skipping reminder ${reminder.id} - missing meeting/prospect data`);
          await supabase
            .from('meeting_reminders')
            .update({ status: 'failed', error_message: 'Missing meeting or prospect data' })
            .eq('id', reminder.id);
          continue;
        }

        // Check if meeting is still valid (not cancelled)
        if (['cancelled', 'no_show', 'completed'].includes(meeting.status)) {
          console.log(`   ⏭️ Skipping reminder ${reminder.id} - meeting ${meeting.status}`);
          await supabase
            .from('meeting_reminders')
            .update({ status: 'cancelled', error_message: `Meeting ${meeting.status}` })
            .eq('id', reminder.id);
          continue;
        }

        // Build context
        const context: MeetingContext = {
          meeting_id: meeting.id,
          prospect: {
            id: prospect.id,
            first_name: prospect.first_name || '',
            last_name: prospect.last_name || '',
            email: prospect.email,
            company_name: prospect.company_name,
            title: prospect.title,
            linkedin_url: prospect.linkedin_url,
          },
          workspace_id: meeting.workspace_id,
          meeting: {
            scheduled_at: new Date(meeting.scheduled_at),
            duration_minutes: meeting.duration_minutes,
            title: meeting.title,
            meeting_link: meeting.meeting_link,
            status: meeting.status,
          },
        };

        // Generate reminder message
        const { subject, message } = await generateReminderMessage(
          context,
          reminder.reminder_type as '24h' | '1h' | '15m'
        );

        // Send based on channel
        let sendSuccess = false;
        let sendError = '';

        if (reminder.channel === 'email' && prospect.email) {
          // Send via Postmark
          const emailResult = await sendEmailReminder({
            to: prospect.email,
            toName: `${prospect.first_name} ${prospect.last_name}`.trim(),
            subject,
            textBody: message,
            fromEmail: meeting.our_attendee_email || POSTMARK_FROM_EMAIL,
            fromName: meeting.our_attendee_name || 'SAM',
          });

          sendSuccess = emailResult.success;
          sendError = emailResult.error || '';

        } else if (reminder.channel === 'linkedin' && prospect.linkedin_url) {
          // Send via Unipile (would need to implement)
          // For now, fall back to email if available
          if (prospect.email) {
            const emailResult = await sendEmailReminder({
              to: prospect.email,
              toName: `${prospect.first_name} ${prospect.last_name}`.trim(),
              subject,
              textBody: message,
              fromEmail: meeting.our_attendee_email || POSTMARK_FROM_EMAIL,
              fromName: meeting.our_attendee_name || 'SAM',
            });
            sendSuccess = emailResult.success;
            sendError = emailResult.error || '';
          } else {
            sendError = 'LinkedIn reminders not yet implemented, no email fallback';
          }
        } else {
          sendError = 'No valid contact method (email or LinkedIn)';
        }

        // Update reminder status
        if (sendSuccess) {
          await supabase
            .from('meeting_reminders')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', reminder.id);

          // Update meeting with reminder sent timestamp
          const reminderField = `reminder_${reminder.reminder_type}_sent_at`;
          await supabase
            .from('meetings')
            .update({ [reminderField]: new Date().toISOString() })
            .eq('id', meeting.id);

          results.reminders_sent++;
          console.log(`   ✅ Sent ${reminder.reminder_type} reminder for meeting ${meeting.id}`);

        } else {
          await supabase
            .from('meeting_reminders')
            .update({
              status: 'failed',
              error_message: sendError,
              updated_at: new Date().toISOString(),
            })
            .eq('id', reminder.id);

          results.reminders_failed++;
          results.errors.push(`Reminder ${reminder.id}: ${sendError}`);
          console.log(`   ❌ Failed to send reminder: ${sendError}`);
        }

      } catch (error: any) {
        results.reminders_failed++;
        results.errors.push(`Reminder ${reminder.id}: ${error.message}`);
        console.error(`   ❌ Error processing reminder:`, error);

        await supabase
          .from('meeting_reminders')
          .update({
            status: 'failed',
            error_message: error.message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', reminder.id);
      }
    }

    console.log('\n📊 Reminder Summary:');
    console.log(`   - Sent: ${results.reminders_sent}`);
    console.log(`   - Failed: ${results.reminders_failed}`);

    return NextResponse.json({
      success: true,
      ...results,
    });

  } catch (error: any) {
    console.error('❌ Meeting reminders error:', error);
    return NextResponse.json({
      error: 'Failed to process meeting reminders',
      details: error.message,
    }, { status: 500 });
  }
}

// ============================================
// EMAIL SENDING VIA POSTMARK
// ============================================

async function sendEmailReminder(params: {
  to: string;
  toName: string;
  subject: string;
  textBody: string;
  fromEmail: string;
  fromName: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!POSTMARK_API_KEY) {
    return { success: false, error: 'Postmark not configured' };
  }

  try {
    const response = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': POSTMARK_API_KEY,
      },
      body: JSON.stringify({
        From: `${params.fromName} <${params.fromEmail}>`,
        To: `${params.toName} <${params.to}>`,
        Subject: params.subject,
        TextBody: params.textBody,
        MessageStream: 'outbound',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.Message || 'Postmark error' };
    }

    return { success: true };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
