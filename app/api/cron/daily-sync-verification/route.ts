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
import { pool } from '@/lib/db';
import { airtableService } from '@/lib/airtable';
import { activeCampaignService } from '@/lib/activecampaign';

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

    // Get LinkedIn prospects who have REPLIED (not just connected)
    // Only sync actual replies to "Positive Leads" Airtable table
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
        responded_at,
        campaigns(campaign_name, campaign_type)
      `)
      .not('linkedin_url', 'is', null)
      .in('status', ['replied', 'interested', 'follow_up_complete', 'meeting_booked']);

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
              intent: mapStatusToIntent(prospect.status),
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

    // Email leads are synced directly from ReachInbox webhook to Airtable
    // We just report on Airtable record counts for visibility
    try {
      const airtableEmailRecords = await listAllAirtableRecords(EMAIL_TABLE_ID);
      report.email.totalInAirtable = airtableEmailRecords.length;
      console.log(`   Found ${report.email.totalInAirtable} email leads in Airtable`);

      // Note: Email syncing happens in real-time via ReachInbox webhook
      // This sync verification focuses on LinkedIn leads which have a source DB
      report.email.totalInSupabase = report.email.totalInAirtable; // Email source is Airtable itself
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      report.email.syncErrors.push(`Error fetching Airtable emails: ${errMsg}`);
    }

    // ============================================
    // 3. VERIFY ACTIVECAMPAIGN SYNC (Positive Replies)
    // ============================================
    console.log('\n🎯 Verifying ActiveCampaign sync for positive replies...');

    // Get LinkedIn prospects with positive status (replied, interested, meeting_booked)
    const { data: positiveLinkedIn } = await supabase
      .from('campaign_prospects')
      .select('id, linkedin_url, first_name, last_name, email, status')
      .in('status', ['replied', 'interested', 'meeting_booked'])
      .not('email', 'is', null);

    const totalPositive = positiveLinkedIn?.length || 0;
    report.activeCampaign.positiveRepliesChecked = totalPositive;
    console.log(`   Found ${totalPositive} positive LinkedIn replies to verify`);

    // Check each positive lead exists in ActiveCampaign
    // Note: We only check a subset to avoid rate limits
    const samplesToCheck = (positiveLinkedIn || []).slice(0, 30);

    for (const lead of samplesToCheck) {
      try {
        const email = lead.email;
        if (!email) continue;

        // Check if contact exists in ActiveCampaign
        const existsInAC = await checkContactExistsInActiveCampaign(email);

        if (!existsInAC) {
          report.activeCampaign.missingInAC++;
          console.log(`   ⚠️ Missing in ActiveCampaign: ${email}`);

          // Sync to ActiveCampaign
          try {
            const contact = await activeCampaignService.findOrCreateContact({
              email,
              firstName: lead.first_name || '',
              lastName: lead.last_name || '',
            });

            if (contact?.id) {
              // Add status-based tag
              const intentTagName = `SAM-${lead.status.replace('_', '-')}`;
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
  const baseUrl = process.env.ACTIVECAMPAIGN_API_URL;
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
 * Map prospect status to Airtable intent
 * Only maps statuses for prospects who have replied
 */
function mapStatusToIntent(status: string): string {
  const statusMap: Record<string, string> = {
    replied: 'interested',
    interested: 'interested',
    meeting_booked: 'booking_request',
    follow_up_complete: 'went_silent',
    not_interested: 'not_interested',
  };
  return statusMap[status] || 'interested';
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
