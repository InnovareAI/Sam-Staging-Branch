/**
 * Daily Data Sync Verification Cron Job
 *
 * Runs once daily to verify data consistency across:
 * - LinkedIn leads: Supabase → Airtable
 * - Email leads: ReachInbox/Supabase → Airtable
 * - Positive replies → ActiveCampaign
 *
 * Sends a summary report to Google Chat
 *
 * Schedule: 6:00 AM CET daily
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { airtableService } from '@/lib/airtable';
import { activeCampaignService } from '@/lib/activecampaign';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Airtable constants
const AIRTABLE_BASE_ID = 'appbBGI8aqW6Lxm5O';
const LINKEDIN_TABLE_ID = 'tblMqDWVazMY1TD1l';
const EMAIL_TABLE_ID = 'tblQhqprE7YrrBOiV';

interface SyncReport {
  timestamp: string;
  linkedIn: {
    totalInSupabase: number;
    totalInAirtable: number;
    missingInAirtable: number;
    synced: number;
    syncErrors: string[];
  };
  email: {
    totalInSupabase: number;
    totalInAirtable: number;
    missingInAirtable: number;
    synced: number;
    syncErrors: string[];
  };
  activeCampaign: {
    positiveRepliesChecked: number;
    missingInAC: number;
    synced: number;
    syncErrors: string[];
  };
  duration: number;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  console.log('🔄 Starting daily data sync verification...');

  const report: SyncReport = {
    timestamp: new Date().toISOString(),
    linkedIn: {
      totalInSupabase: 0,
      totalInAirtable: 0,
      missingInAirtable: 0,
      synced: 0,
      syncErrors: [],
    },
    email: {
      totalInSupabase: 0,
      totalInAirtable: 0,
      missingInAirtable: 0,
      synced: 0,
      syncErrors: [],
    },
    activeCampaign: {
      positiveRepliesChecked: 0,
      missingInAC: 0,
      synced: 0,
      syncErrors: [],
    },
    duration: 0,
  };

  try {
    // ============================================
    // 1. VERIFY LINKEDIN LEADS SYNC
    // ============================================
    console.log('\n📊 Verifying LinkedIn leads sync...');

    // Get all LinkedIn prospects from Supabase with replies or positive status
    const { data: linkedInProspects, error: linkedInError } = await supabase
      .from('campaign_prospects')
      .select(`
        id,
        linkedin_url,
        first_name,
        last_name,
        title,
        company_name,
        status,
        last_reply_intent,
        last_reply_text,
        campaigns(campaign_name, campaign_type)
      `)
      .not('linkedin_url', 'is', null)
      .or('status.in.(connected,replied,interested,follow_up_complete),last_reply_intent.not.is.null');

    if (linkedInError) {
      console.error('❌ Failed to fetch LinkedIn prospects:', linkedInError);
      report.linkedIn.syncErrors.push(`Supabase query error: ${linkedInError.message}`);
    } else {
      report.linkedIn.totalInSupabase = linkedInProspects?.length || 0;
      console.log(`   Found ${report.linkedIn.totalInSupabase} LinkedIn prospects to verify`);

      // Get all Airtable LinkedIn records
      const airtableLinkedInRecords = await listAllAirtableRecords(LINKEDIN_TABLE_ID);
      report.linkedIn.totalInAirtable = airtableLinkedInRecords.length;

      // Create a set of profile URLs in Airtable for quick lookup
      const airtableProfileUrls = new Set(
        airtableLinkedInRecords
          .map((r: any) => r.fields['Profile URL'])
          .filter(Boolean)
      );

      // Find and sync missing records
      for (const prospect of linkedInProspects || []) {
        if (!prospect.linkedin_url) continue;

        if (!airtableProfileUrls.has(prospect.linkedin_url)) {
          report.linkedIn.missingInAirtable++;
          console.log(`   ⚠️ Missing in Airtable: ${prospect.first_name} ${prospect.last_name}`);

          // Sync to Airtable
          try {
            const campaign = prospect.campaigns as any;
            const result = await airtableService.syncLinkedInLead({
              profileUrl: prospect.linkedin_url,
              name: `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim() || 'Unknown',
              jobTitle: prospect.title,
              companyName: prospect.company_name,
              linkedInAccount: campaign?.campaign_name,
              intent: prospect.last_reply_intent || mapStatusToIntent(prospect.status),
              replyText: prospect.last_reply_text,
            });

            if (result.success) {
              report.linkedIn.synced++;
              console.log(`   ✅ Synced: ${prospect.first_name} ${prospect.last_name}`);
            } else {
              report.linkedIn.syncErrors.push(`Failed to sync ${prospect.linkedin_url}: ${result.error}`);
            }
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Unknown error';
            report.linkedIn.syncErrors.push(`Error syncing ${prospect.linkedin_url}: ${errMsg}`);
          }
        }
      }
    }

    // ============================================
    // 2. VERIFY EMAIL LEADS SYNC
    // ============================================
    console.log('\n📧 Verifying email leads sync...');

    // Get email webhook logs with replies from past 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: emailLeads, error: emailError } = await supabase
      .from('email_webhook_logs')
      .select('*')
      .eq('event_type', 'REPLY_RECEIVED')
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (emailError) {
      console.error('❌ Failed to fetch email leads:', emailError);
      report.email.syncErrors.push(`Supabase query error: ${emailError.message}`);
    } else {
      report.email.totalInSupabase = emailLeads?.length || 0;
      console.log(`   Found ${report.email.totalInSupabase} email replies to verify`);

      // Get all Airtable email records
      const airtableEmailRecords = await listAllAirtableRecords(EMAIL_TABLE_ID);
      report.email.totalInAirtable = airtableEmailRecords.length;

      // Create a set of emails in Airtable for quick lookup
      const airtableEmails = new Set(
        airtableEmailRecords
          .map((r: any) => r.fields['Email']?.toLowerCase())
          .filter(Boolean)
      );

      // Find and sync missing records
      for (const emailLead of emailLeads || []) {
        const payload = emailLead.payload as any;
        const email = payload?.lead_email?.toLowerCase();

        if (!email) continue;

        if (!airtableEmails.has(email)) {
          report.email.missingInAirtable++;
          console.log(`   ⚠️ Missing in Airtable: ${email}`);

          // Sync to Airtable
          try {
            const leadName = `${payload.lead_first_name || ''} ${payload.lead_last_name || ''}`.trim() || 'Unknown';
            const result = await airtableService.syncEmailLead({
              email: payload.lead_email,
              name: leadName,
              campaignName: payload.campaign_name,
              replyText: extractReplyBody(payload),
              intent: classifyEmailIntent(extractReplyBody(payload)),
            });

            if (result.success) {
              report.email.synced++;
              console.log(`   ✅ Synced: ${email}`);
            } else {
              report.email.syncErrors.push(`Failed to sync ${email}: ${result.error}`);
            }
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Unknown error';
            report.email.syncErrors.push(`Error syncing ${email}: ${errMsg}`);
          }
        }
      }
    }

    // ============================================
    // 3. VERIFY ACTIVECAMPAIGN SYNC (Positive Replies)
    // ============================================
    console.log('\n🎯 Verifying ActiveCampaign sync for positive replies...');

    // Get positive LinkedIn replies
    const { data: positiveLinkedIn } = await supabase
      .from('campaign_prospects')
      .select('id, linkedin_url, first_name, last_name, email, last_reply_intent')
      .in('last_reply_intent', ['interested', 'curious', 'question', 'booking_request', 'vague_positive']);

    // Get positive email replies
    const { data: positiveEmails } = await supabase
      .from('email_webhook_logs')
      .select('payload')
      .eq('event_type', 'REPLY_RECEIVED')
      .gte('created_at', thirtyDaysAgo.toISOString());

    const positiveEmailLeads = (positiveEmails || []).filter((e: any) => {
      const reply = extractReplyBody(e.payload);
      const intent = classifyEmailIntent(reply);
      return ['interested', 'booking_request', 'question'].includes(intent);
    });

    const totalPositive = (positiveLinkedIn?.length || 0) + positiveEmailLeads.length;
    report.activeCampaign.positiveRepliesChecked = totalPositive;
    console.log(`   Found ${totalPositive} positive replies to verify`);

    // Check each positive lead exists in ActiveCampaign
    // Note: We only check a subset to avoid rate limits
    const samplesToCheck = [...(positiveLinkedIn || []).slice(0, 20), ...positiveEmailLeads.slice(0, 20)];

    for (const lead of samplesToCheck) {
      try {
        let email: string | undefined;
        let firstName = '';
        let lastName = '';
        let intent = '';

        if ('linkedin_url' in lead) {
          // LinkedIn lead
          email = lead.email;
          firstName = lead.first_name || '';
          lastName = lead.last_name || '';
          intent = lead.last_reply_intent || '';
        } else {
          // Email lead
          const payload = lead.payload as any;
          email = payload?.lead_email;
          firstName = payload?.lead_first_name || '';
          lastName = payload?.lead_last_name || '';
          intent = classifyEmailIntent(extractReplyBody(payload));
        }

        if (!email) continue;

        // Check if contact exists in ActiveCampaign
        const searchUrl = `contacts?email=${encodeURIComponent(email)}`;
        // Note: Using internal API call pattern from activeCampaignService
        const existsInAC = await checkContactExistsInActiveCampaign(email);

        if (!existsInAC) {
          report.activeCampaign.missingInAC++;
          console.log(`   ⚠️ Missing in ActiveCampaign: ${email}`);

          // Sync to ActiveCampaign
          try {
            const contact = await activeCampaignService.findOrCreateContact({
              email,
              firstName,
              lastName,
            });

            if (contact?.id) {
              // Add intent tag
              const intentTagName = `SAM-${intent.replace('_', '-')}`;
              const intentTag = await activeCampaignService.findOrCreateTag(intentTagName);
              if (intentTag?.id) {
                await activeCampaignService.addTagToContact(contact.id, intentTag.id);
              }
              report.activeCampaign.synced++;
              console.log(`   ✅ Synced to AC: ${email}`);
            }
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Unknown error';
            report.activeCampaign.syncErrors.push(`Error syncing ${email}: ${errMsg}`);
          }
        }
      } catch (err) {
        console.error('   Error checking AC:', err);
      }
    }

    report.duration = Date.now() - startTime;

    // ============================================
    // 4. SEND GOOGLE CHAT SUMMARY
    // ============================================
    await sendSyncReport(report);

    console.log(`\n✅ Daily sync verification complete in ${report.duration}ms`);

    return NextResponse.json({
      success: true,
      report,
      message: 'Daily sync verification completed',
    });
  } catch (error) {
    console.error('❌ Daily sync verification failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * List all records from an Airtable table (handles pagination)
 */
async function listAllAirtableRecords(tableId: string): Promise<any[]> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) {
    console.error('AIRTABLE_API_KEY not configured');
    return [];
  }

  const allRecords: any[] = [];
  let offset: string | undefined;

  do {
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}${offset ? `?offset=${offset}` : ''}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      console.error(`Airtable fetch error: ${response.status}`);
      break;
    }

    const data = await response.json();
    allRecords.push(...(data.records || []));
    offset = data.offset;
  } while (offset);

  return allRecords;
}

/**
 * Check if a contact exists in ActiveCampaign
 */
async function checkContactExistsInActiveCampaign(email: string): Promise<boolean> {
  const baseUrl = process.env.ACTIVECAMPAIGN_BASE_URL;
  const apiKey = process.env.ACTIVECAMPAIGN_API_KEY;

  if (!baseUrl || !apiKey) return false;

  try {
    const response = await fetch(`${baseUrl}/api/3/contacts?email=${encodeURIComponent(email)}`, {
      headers: {
        'Api-Token': apiKey,
      },
    });

    if (!response.ok) return false;

    const data = await response.json();
    return data.contacts && data.contacts.length > 0;
  } catch {
    return false;
  }
}

/**
 * Map prospect status to intent
 */
function mapStatusToIntent(status: string): string {
  const statusMap: Record<string, string> = {
    connected: 'no_response',
    replied: 'interested',
    interested: 'interested',
    follow_up_complete: 'went_silent',
    not_interested: 'not_interested',
  };
  return statusMap[status] || 'no_response';
}

/**
 * Extract reply body from email payload
 */
function extractReplyBody(payload: any): string {
  return payload?.reply_body || payload?.message_body || payload?.body || '';
}

/**
 * Classify email intent based on content
 */
function classifyEmailIntent(replyText: string): string {
  const replyLower = replyText.toLowerCase();

  if (
    replyLower.includes('not interested') ||
    replyLower.includes('unsubscribe') ||
    replyLower.includes('remove me') ||
    replyLower.includes('stop emailing')
  ) {
    return 'not_interested';
  }

  if (
    replyLower.includes('schedule') ||
    replyLower.includes('calendar') ||
    replyLower.includes('meet') ||
    replyLower.includes('call') ||
    replyLower.includes('demo')
  ) {
    return 'booking_request';
  }

  if (
    replyLower.includes('interested') ||
    replyLower.includes('tell me more') ||
    replyLower.includes('sounds good') ||
    replyLower.includes('yes')
  ) {
    return 'interested';
  }

  if (
    replyLower.includes('pricing') ||
    replyLower.includes('cost') ||
    replyLower.includes('how much') ||
    replyLower.includes('price')
  ) {
    return 'question';
  }

  return 'other';
}

/**
 * Send sync report to Google Chat
 */
async function sendSyncReport(report: SyncReport): Promise<void> {
  const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('⚠️ GOOGLE_CHAT_WEBHOOK_URL not configured');
    return;
  }

  const timestamp = new Date().toLocaleString('en-US', {
    timeZone: 'Europe/Berlin',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const hasIssues =
    report.linkedIn.missingInAirtable > 0 ||
    report.email.missingInAirtable > 0 ||
    report.activeCampaign.missingInAC > 0 ||
    report.linkedIn.syncErrors.length > 0 ||
    report.email.syncErrors.length > 0 ||
    report.activeCampaign.syncErrors.length > 0;

  const statusEmoji = hasIssues ? '⚠️' : '✅';
  const statusText = hasIssues ? 'Issues Found & Fixed' : 'All Systems Synced';

  const message = {
    cardsV2: [
      {
        cardId: `sync-report-${Date.now()}`,
        card: {
          header: {
            title: `${statusEmoji} Daily Sync Report`,
            subtitle: `${statusText} - ${timestamp} CET`,
            imageUrl: 'https://app.meet-sam.com/sam-icon.png',
            imageType: 'CIRCLE',
          },
          sections: [
            {
              header: '📊 LinkedIn → Airtable',
              widgets: [
                {
                  decoratedText: {
                    topLabel: 'Supabase Records',
                    text: String(report.linkedIn.totalInSupabase),
                  },
                },
                {
                  decoratedText: {
                    topLabel: 'Airtable Records',
                    text: String(report.linkedIn.totalInAirtable),
                  },
                },
                {
                  decoratedText: {
                    topLabel: 'Missing → Synced',
                    text: `${report.linkedIn.missingInAirtable} → ${report.linkedIn.synced}`,
                    startIcon: {
                      knownIcon: report.linkedIn.synced > 0 ? 'STAR' : 'NONE',
                    },
                  },
                },
              ],
            },
            {
              header: '📧 Email → Airtable',
              widgets: [
                {
                  decoratedText: {
                    topLabel: 'Email Replies',
                    text: String(report.email.totalInSupabase),
                  },
                },
                {
                  decoratedText: {
                    topLabel: 'Airtable Records',
                    text: String(report.email.totalInAirtable),
                  },
                },
                {
                  decoratedText: {
                    topLabel: 'Missing → Synced',
                    text: `${report.email.missingInAirtable} → ${report.email.synced}`,
                    startIcon: {
                      knownIcon: report.email.synced > 0 ? 'STAR' : 'NONE',
                    },
                  },
                },
              ],
            },
            {
              header: '🎯 Positive Replies → ActiveCampaign',
              widgets: [
                {
                  decoratedText: {
                    topLabel: 'Positive Replies Checked',
                    text: String(report.activeCampaign.positiveRepliesChecked),
                  },
                },
                {
                  decoratedText: {
                    topLabel: 'Missing → Synced',
                    text: `${report.activeCampaign.missingInAC} → ${report.activeCampaign.synced}`,
                    startIcon: {
                      knownIcon: report.activeCampaign.synced > 0 ? 'STAR' : 'NONE',
                    },
                  },
                },
              ],
            },
            {
              widgets: [
                {
                  decoratedText: {
                    topLabel: 'Duration',
                    text: `${(report.duration / 1000).toFixed(1)}s`,
                  },
                },
              ],
            },
            ...(report.linkedIn.syncErrors.length > 0 ||
            report.email.syncErrors.length > 0 ||
            report.activeCampaign.syncErrors.length > 0
              ? [
                  {
                    header: '❌ Errors',
                    widgets: [
                      {
                        textParagraph: {
                          text: [
                            ...report.linkedIn.syncErrors.slice(0, 3),
                            ...report.email.syncErrors.slice(0, 3),
                            ...report.activeCampaign.syncErrors.slice(0, 3),
                          ].join('\n'),
                        },
                      },
                    ],
                  },
                ]
              : []),
          ],
        },
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (response.ok) {
      console.log('✅ Sent sync report to Google Chat');
    } else {
      console.error('❌ Failed to send Google Chat report:', await response.text());
    }
  } catch (error) {
    console.error('❌ Error sending Google Chat report:', error);
  }
}

// Provide info for manual trigger
export async function POST(request: NextRequest) {
  return GET(request);
}
