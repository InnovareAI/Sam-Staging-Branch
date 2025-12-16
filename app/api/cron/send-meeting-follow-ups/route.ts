/**
 * Cron Job: Send Meeting Follow-ups
 *
 * POST /api/cron/send-meeting-follow-ups
 *
 * Runs every 15 minutes to:
 * 1. Find approved meeting follow-up drafts
 * 2. Send via Postmark (email) or Unipile (LinkedIn)
 * 3. Update meeting and prospect status
 *
 * Created: December 16, 2025
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 120; // 2 minutes

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const POSTMARK_API_KEY = process.env.POSTMARK_SERVER_TOKEN;
const POSTMARK_FROM_EMAIL = process.env.POSTMARK_FROM_EMAIL || 'sam@meet-sam.com';

const UNIPILE_DSN = process.env.UNIPILE_DSN || 'api6.unipile.com:13670';
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

export async function POST(req: NextRequest) {
  try {
    // Security check
    const cronSecret = req.headers.get('x-cron-secret');
    if (cronSecret !== process.env.CRON_SECRET) {
      console.warn('⚠️ Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('📬 Processing approved meeting follow-ups...');

    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Find approved drafts ready to send
    const { data: approvedDrafts, error: fetchError } = await supabase
      .from('meeting_follow_up_drafts')
      .select(`
        *,
        meetings (
          *,
          campaign_prospects (
            id, first_name, last_name, email, linkedin_url, linkedin_user_id
          )
        )
      `)
      .eq('status', 'approved')
      .order('approved_at', { ascending: true })
      .limit(10);

    if (fetchError) {
      console.error('Error fetching drafts:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch drafts' }, { status: 500 });
    }

    if (!approvedDrafts || approvedDrafts.length === 0) {
      console.log('✅ No approved follow-ups to send');
      return NextResponse.json({ success: true, sent: 0 });
    }

    console.log(`📋 Found ${approvedDrafts.length} approved follow-ups`);

    for (const draft of approvedDrafts) {
      try {
        const meeting = draft.meetings;
        const prospect = meeting?.campaign_prospects;

        if (!meeting || !prospect) {
          console.log(`   ⏭️ Skipping draft ${draft.id} - missing meeting/prospect`);
          await supabase
            .from('meeting_follow_up_drafts')
            .update({ status: 'failed', send_error: 'Missing meeting or prospect data' })
            .eq('id', draft.id);
          continue;
        }

        let sendSuccess = false;
        let sendError = '';

        // ============================================
        // SEND VIA APPROPRIATE CHANNEL
        // ============================================

        if (draft.channel === 'email' && prospect.email) {
          // Send via Postmark
          const result = await sendEmailFollowUp({
            to: prospect.email,
            toName: `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim(),
            subject: draft.subject || 'Following up',
            textBody: draft.message,
            fromEmail: meeting.our_attendee_email || POSTMARK_FROM_EMAIL,
            fromName: meeting.our_attendee_name || 'SAM',
          });

          sendSuccess = result.success;
          sendError = result.error || '';

        } else if (draft.channel === 'linkedin') {
          // Send via Unipile LinkedIn
          const result = await sendLinkedInFollowUp({
            prospect,
            message: draft.message,
            workspace_id: draft.workspace_id,
          });

          sendSuccess = result.success;
          sendError = result.error || '';

        } else {
          sendError = 'No valid channel or contact method';
        }

        // ============================================
        // UPDATE STATUS
        // ============================================

        if (sendSuccess) {
          // Update draft status
          await supabase
            .from('meeting_follow_up_drafts')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', draft.id);

          // Update meeting based on follow-up type
          const meetingUpdate: Record<string, any> = {
            updated_at: new Date().toISOString(),
          };

          if (draft.follow_up_type === 'no_show') {
            meetingUpdate.no_show_follow_up_sent_at = new Date().toISOString();
          } else if (draft.follow_up_type === 'post_meeting') {
            meetingUpdate.post_meeting_follow_up_sent_at = new Date().toISOString();
          }

          await supabase
            .from('meetings')
            .update(meetingUpdate)
            .eq('id', draft.meeting_id);

          results.sent++;
          console.log(`   ✅ Sent ${draft.follow_up_type} follow-up for meeting ${meeting.id}`);

        } else {
          await supabase
            .from('meeting_follow_up_drafts')
            .update({
              status: 'failed',
              send_error: sendError,
              updated_at: new Date().toISOString(),
            })
            .eq('id', draft.id);

          results.failed++;
          results.errors.push(`Draft ${draft.id}: ${sendError}`);
          console.log(`   ❌ Failed to send: ${sendError}`);
        }

        // Small delay between sends
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error: any) {
        results.failed++;
        results.errors.push(`Draft ${draft.id}: ${error.message}`);
        console.error(`   ❌ Error processing draft:`, error);

        await supabase
          .from('meeting_follow_up_drafts')
          .update({
            status: 'failed',
            send_error: error.message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', draft.id);
      }
    }

    console.log('\n📊 Meeting Follow-up Summary:');
    console.log(`   - Sent: ${results.sent}`);
    console.log(`   - Failed: ${results.failed}`);

    return NextResponse.json({
      success: true,
      ...results,
    });

  } catch (error: any) {
    console.error('❌ Meeting follow-ups error:', error);
    return NextResponse.json({
      error: 'Failed to process meeting follow-ups',
      details: error.message,
    }, { status: 500 });
  }
}

// ============================================
// EMAIL SENDING VIA POSTMARK
// ============================================

async function sendEmailFollowUp(params: {
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

// ============================================
// LINKEDIN SENDING VIA UNIPILE
// ============================================

async function sendLinkedInFollowUp(params: {
  prospect: {
    id: string;
    linkedin_url?: string;
    linkedin_user_id?: string;
  };
  message: string;
  workspace_id: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!UNIPILE_API_KEY) {
    return { success: false, error: 'Unipile not configured' };
  }

  try {
    // Get LinkedIn account for workspace
    const { data: account } = await supabase
      .from('workspace_accounts')
      .select('unipile_account_id')
      .eq('workspace_id', params.workspace_id)
      .eq('account_type', 'linkedin')
      .eq('connection_status', 'connected')
      .single();

    if (!account?.unipile_account_id) {
      return { success: false, error: 'No LinkedIn account connected for workspace' };
    }

    // Get prospect's LinkedIn ID
    let linkedInId = params.prospect.linkedin_user_id;

    if (!linkedInId && params.prospect.linkedin_url) {
      // Extract from URL using Unipile
      const vanityMatch = params.prospect.linkedin_url.match(/linkedin\.com\/in\/([^\/\?#]+)/);
      if (vanityMatch) {
        const profileResponse = await fetch(
          `https://${UNIPILE_DSN}/api/v1/users/${vanityMatch[1]}?account_id=${account.unipile_account_id}`,
          {
            headers: {
              'X-API-KEY': UNIPILE_API_KEY,
              'Accept': 'application/json',
            },
          }
        );

        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          linkedInId = profileData.provider_id || profileData.id;
        }
      }
    }

    if (!linkedInId) {
      return { success: false, error: 'Could not resolve LinkedIn user ID' };
    }

    // Send message via Unipile
    const response = await fetch(`https://${UNIPILE_DSN}/api/v1/chats`, {
      method: 'POST',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        account_id: account.unipile_account_id,
        attendees_ids: [linkedInId],
        text: params.message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Unipile error: ${errorText}` };
    }

    return { success: true };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
