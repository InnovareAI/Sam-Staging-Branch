import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { airtableService } from '@/lib/airtable';

// Service role client for webhook processing (no user auth needed)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * ReachInbox Email Account → Country Mapping
 * Since ReachInbox doesn't send workspace_id in webhooks,
 * we filter by email_account to determine country/region.
 *
 * Format: email_account → country/region for Airtable sync
 */
const EMAIL_ACCOUNT_TO_COUNTRY: Record<string, string> = {
  // === DACH (Germany/Austria/Switzerland) ===
  'jfleming@tryinnovaredigital.com': 'DACH',
  'jfleming@tryinnovareai.com': 'DACH',
  'j.fleming@tryinnovareai.com': 'DACH',
  'jennifer.fleming@tryinnovareai.com': 'DACH',
  'jfleming@tryinnovaredigi.us': 'DACH',

  // === Asia & Middle East ===
  'j.fleming@tryinnovaredigi.us': 'Asia & Middle East',
  'jennifer.fleming@tryinnovaredigi.us': 'Asia & Middle East',
  'jfleming@meetinnovaredigi.us': 'Asia & Middle East',
  'j.fleming@meetinnovaredigi.us': 'Asia & Middle East',
  'jennifer.fleming@meetinnovaredigi.us': 'Asia & Middle East',
  'j.fleming@meetinnovaredigital.us': 'Asia & Middle East',
  'jfleming@meetinnovaredigital.us': 'Asia & Middle East',
  'jennifer.fleming@meetinnovaredigital.us': 'Asia & Middle East',
  'jfleminng@meetinnovareai.us': 'Asia & Middle East',
  'j.fleming@meetinnovareai.us': 'Asia & Middle East',
  'jennifer.fleming@meetinnovareai.us': 'Asia & Middle East',
  'jennifer.fleming@tryinnovaredigital.us': 'Asia & Middle East',
  'j.fleming@tryinnovaredigital.us': 'Asia & Middle East',
  'jfleminng@tryinnovaredigital.us': 'Asia & Middle East',
  'jennifer.fleming@innovareai.us': 'Asia & Middle East',
  'j.fleming@innovareai.us': 'Asia & Middle East',
  'jfleminng@innovareai.us': 'Asia & Middle East',
  'jfleminng@tryinnovareai.us': 'Asia & Middle East',
  'j.fleming@tryinnovareai.us': 'Asia & Middle East',
  'jennifer.fleming@tryinnovareai.us': 'Asia & Middle East',

  // === Canada ===
  'jfleming@meetinnovareai.com': 'Canada',
  'j.fleming@meetinnovareai.com': 'Canada',
  'jennifer.fleming@meetinnovareai.com': 'Canada',
  'jennifer.fleming@tryinnovaredigital.com': 'Canada',
  'j.fleming@tryinnovaredigital.com': 'Canada',
  'j.fleming@meetinnovaredigi.com': 'Canada',
  'jfleming@meetinnovaredigi.com': 'Canada',
  'jennifer.fleming@meetinnovaredigi.com': 'Canada',
  'jfleminng@meetinnovareai.app': 'Canada',
  'j.fleming@meetinnovareai.app': 'Canada',
  'jennifer.fleming@meetinnovareai.app': 'Canada',
  'jennifer.fleming@tryinnovareai.app': 'Canada',
  'j.fleming@tryinnovareai.app': 'Canada',
  'jfleminng@tryinnovareai.app': 'Canada',
  'jfleminng@tryinnovaredigi.com': 'Canada',
  'j.fleming@tryinnovaredigi.com': 'Canada',
  'jennifer.fleming@tryinnovaredigi.com': 'Canada',
  'jennifer.fleming@meetinnovaredigital.com': 'Canada',
  'j.fleming@meetinnovaredigital.com': 'Canada',
  'jfleminng@meetinnovaredigital.com': 'Canada',
  'jfleminng@innovareai.app': 'Canada',
  'j.fleming@innovareai.app': 'Canada',
  'jennifer.fleming@innovareai.app': 'Canada',
  'jennifer.fleming@innovaredigi.com': 'Canada',
  'j.fleming@innovaredigi.com': 'Canada',
  'jfleminng@innovaredigi.com': 'Canada',

  // === USA ===
  'j.fleming@getgptagents.com': 'USA',
  'jfleming@getgptagents.com': 'USA',
  'jennifer.fleming@getgptagents.com': 'USA',
  'j.fleming@gptagents.us': 'USA',
  'jfleming@gptagents.us': 'USA',
  'jennifer.fleming@gptagents.us': 'USA',
  'j.fleming@trygptagents.com': 'USA',
  'jfleming@trygptagents.com': 'USA',
  'jennifer.fleming@trygptagents.com': 'USA',
  'j.fleming@gpt-agents.us': 'USA',
  'jfleming@gpt-agents.us': 'USA',
  'jennifer.fleming@gpt-agents.us': 'USA',
  'j.fleming@gpt-agents.io': 'USA',
  'jfleming@gpt-agents.io': 'USA',
  'jennifer.fleming@gpt-agents.io': 'USA',
};

// Set to false to only sync configured accounts, true to sync all
const SYNC_ALL_ACCOUNTS = false;

/**
 * Campaign Name Whitelist Patterns
 * Only campaigns matching these patterns will be synced to Airtable.
 * This filters out client campaigns that use the same email accounts.
 *
 * Patterns are case-insensitive and match the START of campaign names.
 */
const CAMPAIGN_WHITELIST_PATTERNS = [
  'AI Sales Automation/',     // Main InnovareAI campaigns
  '1/24',                     // Date-based campaigns (Jan 2024)
  '2/24',                     // Feb 2024
  '3/24',                     // etc.
  '4/24',
  '5/24',
  '6/24',
  '7/24',
  '8/24',
  '9/24',
  '10/24',
  '11/24',
  '12/24',
  '1/25',                     // 2025 campaigns
  '2/25',
  '3/25',
  'CompuSafe',                // CompuSafe campaigns
  'InnovareAI',               // InnovareAI campaigns
];

/**
 * Check if campaign name matches whitelist patterns
 * Returns true if campaign should be synced to Airtable
 */
function isCampaignWhitelisted(campaignName: string): boolean {
  if (!campaignName) return false;
  const nameLower = campaignName.toLowerCase();
  return CAMPAIGN_WHITELIST_PATTERNS.some(pattern =>
    nameLower.startsWith(pattern.toLowerCase())
  );
}

/**
 * Get country for Airtable sync based on email account
 * Returns country if configured, or 'Unknown' if SYNC_ALL_ACCOUNTS is true
 */
function getCountryForAccount(emailAccount: string): string | null {
  if (SYNC_ALL_ACCOUNTS) {
    return 'Unknown';
  }
  return EMAIL_ACCOUNT_TO_COUNTRY[emailAccount] || null;
}

/**
 * ReachInbox Webhook Payload
 * Based on official ReachInbox documentation
 */
interface ReachInboxWebhook {
  email_id: number;
  lead_id: number;
  lead_email: string;
  email_account: string;
  step_number: number;
  message_id: string;
  timestamp: string;
  campaign_id: number;
  campaign_name: string;
  event: 'EMAIL_SENT' | 'EMAIL_OPENED' | 'EMAIL_CLICKED' | 'REPLY_RECEIVED' | 'EMAIL_BOUNCED' | 'LEAD_INTERESTED' | 'LEAD_NOT_INTERESTED' | 'CAMPAIGN_COMPLETED';
  user_webhook_id: string;
  lead_first_name?: string;
  lead_last_name?: string;
  email_sent_body?: string;
  email_replied_body?: string;
}

export async function POST(req: NextRequest) {
  try {
    const webhook: ReachInboxWebhook = await req.json();

    console.log('📧 ReachInbox webhook received:', {
      event: webhook.event,
      campaign_id: webhook.campaign_id,
      campaign_name: webhook.campaign_name,
      email_account: webhook.email_account,
      lead_email: webhook.lead_email,
      lead_name: `${webhook.lead_first_name || ''} ${webhook.lead_last_name || ''}`.trim(),
      timestamp: webhook.timestamp
    });

    // Check if campaign is whitelisted for Airtable sync
    const isWhitelisted = isCampaignWhitelisted(webhook.campaign_name);
    if (!isWhitelisted) {
      console.log(`⏭️ Skipping non-whitelisted campaign: ${webhook.campaign_name}`);
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'Campaign not in whitelist',
        campaign_name: webhook.campaign_name
      });
    }

    // Handle different webhook events
    switch (webhook.event) {
      case 'EMAIL_SENT':
        await handleEmailSent(webhook);
        break;
      case 'EMAIL_OPENED':
        await handleEmailOpened(webhook);
        break;
      case 'EMAIL_CLICKED':
        await handleEmailClicked(webhook);
        break;
      case 'REPLY_RECEIVED':
        await handleReplyReceived(webhook);
        break;
      case 'EMAIL_BOUNCED':
        await handleEmailBounced(webhook);
        break;
      case 'LEAD_INTERESTED':
        await handleLeadInterested(webhook);
        break;
      case 'LEAD_NOT_INTERESTED':
        await handleLeadNotInterested(webhook);
        break;
      case 'CAMPAIGN_COMPLETED':
        await handleCampaignCompleted(webhook);
        break;
      default:
        console.log(`⚠️ Unhandled ReachInbox event: ${webhook.event}`);
    }

    return NextResponse.json({
      success: true,
      event: webhook.event,
      campaign_id: webhook.campaign_id
    });

  } catch (error: any) {
    console.error('❌ ReachInbox webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error.message },
      { status: 500 }
    );
  }
}

// Handle EMAIL_SENT
async function handleEmailSent(webhook: ReachInboxWebhook) {
  try {
    const leadName = `${webhook.lead_first_name || ''} ${webhook.lead_last_name || ''}`.trim() || 'Unknown';

    console.log(`📤 Email sent: ${webhook.lead_email} (${leadName}) via ${webhook.email_account}`);

    // Track in campaign_messages
    await supabaseAdmin
      .from('campaign_messages')
      .insert({
        campaign_id: String(webhook.campaign_id),
        platform: 'email',
        platform_message_id: webhook.message_id,
        message_content: webhook.email_sent_body || `Step ${webhook.step_number}`,
        recipient_email: webhook.lead_email,
        sender_account: webhook.email_account,
        sent_at: webhook.timestamp,
        created_at: new Date().toISOString(),
        metadata: {
          reachinbox_lead_id: webhook.lead_id,
          campaign_name: webhook.campaign_name,
          step_number: webhook.step_number
        }
      });

    // Sync to Airtable with "No Response" status
    const country = getCountryForAccount(webhook.email_account);
    if (country) {
      try {
        await airtableService.syncEmailLead({
          email: webhook.lead_email,
          name: leadName,
          campaignName: webhook.campaign_name,
          intent: 'no_response',
          country: country,
        });
        console.log(`📊 Airtable: ${webhook.lead_email} → No Response [${country}]`);
      } catch (err) {
        console.error('Airtable sync error:', err);
      }
    }
  } catch (error) {
    console.error('Error handling EMAIL_SENT:', error);
  }
}

// Handle EMAIL_OPENED
async function handleEmailOpened(webhook: ReachInboxWebhook) {
  try {
    console.log(`👁️ Email opened: ${webhook.lead_email} - Campaign: ${webhook.campaign_name}`);

    // Track interaction
    await supabaseAdmin
      .from('campaign_interactions')
      .insert({
        campaign_id: String(webhook.campaign_id),
        interaction_type: 'email_opened',
        platform: 'email',
        interaction_data: {
          lead_email: webhook.lead_email,
          message_id: webhook.message_id,
          opened_at: webhook.timestamp,
          campaign_name: webhook.campaign_name
        },
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Error handling EMAIL_OPENED:', error);
  }
}

// Handle EMAIL_CLICKED
async function handleEmailClicked(webhook: ReachInboxWebhook) {
  try {
    console.log(`🔗 Email clicked: ${webhook.lead_email} - Campaign: ${webhook.campaign_name}`);

    // Track interaction
    await supabaseAdmin
      .from('campaign_interactions')
      .insert({
        campaign_id: String(webhook.campaign_id),
        interaction_type: 'email_clicked',
        platform: 'email',
        interaction_data: {
          lead_email: webhook.lead_email,
          message_id: webhook.message_id,
          clicked_at: webhook.timestamp,
          campaign_name: webhook.campaign_name
        },
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Error handling EMAIL_CLICKED:', error);
  }
}

// Handle REPLY_RECEIVED - Most important for sales
async function handleReplyReceived(webhook: ReachInboxWebhook) {
  try {
    const leadName = `${webhook.lead_first_name || ''} ${webhook.lead_last_name || ''}`.trim() || 'Unknown';
    const replyBody = webhook.email_replied_body || '';

    console.log(`💬 Reply received from ${leadName} (${webhook.lead_email})`);
    console.log(`   Campaign: ${webhook.campaign_name}`);
    console.log(`   Reply preview: ${replyBody.substring(0, 100)}...`);

    // Track interaction
    await supabaseAdmin
      .from('campaign_interactions')
      .insert({
        campaign_id: String(webhook.campaign_id),
        interaction_type: 'email_reply',
        platform: 'email',
        interaction_data: {
          lead_email: webhook.lead_email,
          lead_name: leadName,
          message_id: webhook.message_id,
          reply_body: replyBody,
          replied_at: webhook.timestamp,
          campaign_name: webhook.campaign_name
        },
        created_at: new Date().toISOString()
      });

    // Classify reply intent
    const replyLower = replyBody.toLowerCase();
    let intent = 'interested'; // Default for replies

    if (replyLower.includes('not interested') || replyLower.includes('no thank') ||
        replyLower.includes('remove') || replyLower.includes('unsubscribe') ||
        replyLower.includes('stop')) {
      intent = 'not_interested';
    } else if (replyLower.includes('wrong person') || replyLower.includes('not the right')) {
      intent = 'wrong_person';
    } else if (replyLower.includes('busy') || replyLower.includes('later') ||
               replyLower.includes('not now') || replyLower.includes('next quarter') ||
               replyLower.includes('next year')) {
      intent = 'timing';
    } else if (replyLower.includes('meeting') || replyLower.includes('call') ||
               replyLower.includes('schedule') || replyLower.includes('demo') ||
               replyLower.includes('book') || replyLower.includes('calendar')) {
      intent = 'booking_request';
    } else if (replyLower.includes('tell me more') || replyLower.includes('interested') ||
               replyLower.includes('learn more') || replyLower.includes('sounds good') ||
               replyLower.includes('yes')) {
      intent = 'interested';
    } else if (replyLower.includes('pricing') || replyLower.includes('cost') ||
               replyLower.includes('how much') || replyLower.includes('price')) {
      intent = 'question';
    }

    console.log(`   Intent classified: ${intent}`);

    // Sync to Airtable
    const country = getCountryForAccount(webhook.email_account);
    if (country) {
      try {
        await airtableService.syncEmailLead({
          email: webhook.lead_email,
          name: leadName,
          campaignName: webhook.campaign_name,
          replyText: replyBody,
          intent: intent,
          country: country,
        });
        console.log(`📊 Airtable updated: ${webhook.lead_email} → ${intent} [${country}]`);
      } catch (err) {
        console.error('Airtable sync error:', err);
      }
    }
  } catch (error) {
    console.error('Error handling REPLY_RECEIVED:', error);
  }
}

// Handle EMAIL_BOUNCED
async function handleEmailBounced(webhook: ReachInboxWebhook) {
  try {
    console.log(`⚠️ Email bounced: ${webhook.lead_email} - Campaign: ${webhook.campaign_name}`);

    // Track interaction
    await supabaseAdmin
      .from('campaign_interactions')
      .insert({
        campaign_id: String(webhook.campaign_id),
        interaction_type: 'email_bounced',
        platform: 'email',
        interaction_data: {
          lead_email: webhook.lead_email,
          message_id: webhook.message_id,
          bounced_at: webhook.timestamp,
          campaign_name: webhook.campaign_name
        },
        created_at: new Date().toISOString()
      });

    // Add to suppression list
    await supabaseAdmin
      .from('email_suppressions')
      .upsert({
        email: webhook.lead_email,
        reason: 'bounced',
        source: 'reachinbox',
        created_at: new Date().toISOString()
      }, { onConflict: 'email' });

    // Sync to Airtable as Not Interested (invalid email)
    const country = getCountryForAccount(webhook.email_account);
    if (country) {
      try {
        const leadName = `${webhook.lead_first_name || ''} ${webhook.lead_last_name || ''}`.trim() || 'Unknown';
        await airtableService.syncEmailLead({
          email: webhook.lead_email,
          name: leadName,
          campaignName: webhook.campaign_name,
          intent: 'not_interested',
          replyText: 'Email bounced - invalid address',
          country: country,
        });
        console.log(`📊 Airtable: ${webhook.lead_email} → Not Interested (bounced)`);
      } catch (err) {
        console.error('Airtable sync error:', err);
      }
    }
  } catch (error) {
    console.error('Error handling EMAIL_BOUNCED:', error);
  }
}

// Handle LEAD_INTERESTED (manually marked in ReachInbox)
async function handleLeadInterested(webhook: ReachInboxWebhook) {
  try {
    const leadName = `${webhook.lead_first_name || ''} ${webhook.lead_last_name || ''}`.trim() || 'Unknown';
    console.log(`🎯 Lead marked INTERESTED: ${leadName} (${webhook.lead_email})`);

    // Sync to Airtable
    const country = getCountryForAccount(webhook.email_account);
    if (country) {
      try {
        await airtableService.syncEmailLead({
          email: webhook.lead_email,
          name: leadName,
          campaignName: webhook.campaign_name,
          intent: 'interested',
          country: country,
        });
        console.log(`📊 Airtable: ${webhook.lead_email} → Interested [${country}]`);
      } catch (err) {
        console.error('Airtable sync error:', err);
      }
    }
  } catch (error) {
    console.error('Error handling LEAD_INTERESTED:', error);
  }
}

// Handle LEAD_NOT_INTERESTED (manually marked in ReachInbox)
async function handleLeadNotInterested(webhook: ReachInboxWebhook) {
  try {
    const leadName = `${webhook.lead_first_name || ''} ${webhook.lead_last_name || ''}`.trim() || 'Unknown';
    console.log(`❌ Lead marked NOT INTERESTED: ${leadName} (${webhook.lead_email})`);

    // Sync to Airtable
    const country = getCountryForAccount(webhook.email_account);
    if (country) {
      try {
        await airtableService.syncEmailLead({
          email: webhook.lead_email,
          name: leadName,
          campaignName: webhook.campaign_name,
          intent: 'not_interested',
          country: country,
        });
        console.log(`📊 Airtable: ${webhook.lead_email} → Not Interested [${country}]`);
      } catch (err) {
        console.error('Airtable sync error:', err);
      }
    }
  } catch (error) {
    console.error('Error handling LEAD_NOT_INTERESTED:', error);
  }
}

// Handle CAMPAIGN_COMPLETED
async function handleCampaignCompleted(webhook: ReachInboxWebhook) {
  try {
    console.log(`✅ Campaign completed: ${webhook.campaign_name} (ID: ${webhook.campaign_id})`);

    // Log completion for analytics
    await supabaseAdmin
      .from('campaign_interactions')
      .insert({
        campaign_id: String(webhook.campaign_id),
        interaction_type: 'campaign_completed',
        platform: 'email',
        interaction_data: {
          campaign_name: webhook.campaign_name,
          completed_at: webhook.timestamp,
          email_account: webhook.email_account
        },
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Error handling CAMPAIGN_COMPLETED:', error);
  }
}

// GET endpoint for webhook verification
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const challenge = searchParams.get('challenge');

  if (challenge) {
    return NextResponse.json({ challenge });
  }

  return NextResponse.json({
    message: 'ReachInbox webhook endpoint is active',
    supported_events: [
      'EMAIL_SENT',
      'EMAIL_OPENED',
      'EMAIL_CLICKED',
      'REPLY_RECEIVED',
      'EMAIL_BOUNCED',
      'LEAD_INTERESTED',
      'LEAD_NOT_INTERESTED',
      'CAMPAIGN_COMPLETED'
    ],
    integration: 'SAM AI ReachInbox Integration'
  });
}
