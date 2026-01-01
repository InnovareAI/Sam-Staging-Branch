import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

/**
 * ⚠️ DISABLED - DO NOT USE
 *
 * This endpoint is DISABLED to prevent direct sends bypassing the queue.
 * Use /api/campaigns/direct/send-connection-requests-queued instead.
 *
 * POST /api/campaigns/direct/send-connection-requests
 * Body: { campaignId: string }
 *
 * ❌ DISABLED - All requests rejected
 */

export const maxDuration = 60;

// Unipile REST API configuration
const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;

async function unipileRequest(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${UNIPILE_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.title || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function POST(req: NextRequest) {
  return NextResponse.json({
    error: 'DISABLED',
    message: 'This endpoint is disabled to prevent direct sends. Use /api/campaigns/direct/send-connection-requests-queued instead.'
  }, { status: 503 });

  // DISABLED CODE BELOW - DO NOT USE
  try {
    const { campaignId } = await req.json();

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId required' }, { status: 400 });
    }

    console.log(`🚀 DISABLED - direct campaign execution: ${campaignId}`);

    // 1. Fetch campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        id,
        campaign_name,
        message_templates,
        schedule_settings,
        linkedin_account_id,
        workspace_accounts!linkedin_account_id (
          id,
          unipile_account_id,
          account_name
        )
      `)
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error('Campaign not found:', campaignError);
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const linkedinAccount = campaign.workspace_accounts as any;

    if (!linkedinAccount || !linkedinAccount.unipile_account_id) {
      console.error('❌ No LinkedIn account configuration found for campaign:', campaignId);
      return NextResponse.json({
        success: false,
        error: 'No LinkedIn account configured for this campaign. Please connect a LinkedIn account in workspace settings.'
      }, { status: 400 });
    }

    const unipileAccountId = linkedinAccount.unipile_account_id;

    console.log(`📋 Campaign: ${campaign.campaign_name}`);
    console.log(`👤 LinkedIn Account: ${linkedinAccount.account_name} (${unipileAccountId})`);
    console.log(`📅 Schedule Settings:`, campaign.schedule_settings || 'Default');

    // 2. Fetch pending prospects (including failed prospects after 24h cooldown)
    const cooldownDate = new Date();
    cooldownDate.setHours(cooldownDate.getHours() - 24);

    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select('*')
      .eq('campaign_id', campaignId)
      .or(`status.in.(pending,approved),and(status.eq.failed,updated_at.lt.${cooldownDate.toISOString()})`)
      .not('linkedin_url', 'is', null)
      .order('created_at', { ascending: true })
      .limit(50); // Process 50 at a time

    if (prospectsError) {
      console.error('Error fetching prospects:', prospectsError);
      return NextResponse.json({ error: 'Failed to fetch prospects' }, { status: 500 });
    }

    if (!prospects || prospects.length === 0) {
      console.log('✅ No pending prospects to process');
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No pending prospects'
      });
    }

    console.log(`📊 Found ${prospects.length} prospects to queue`);

    // 3. Queue each prospect
    const results = [];
    let queuedCount = 0;

    for (let i = 0; i < prospects.length; i++) {
      const prospect = prospects[i];
      try {
        // Calculate randomized delay
        // Pass the campaign's schedule_settings to the randomizer
        const delayMinutes = await calculateHumanSendDelay(
          supabase,
          unipileAccountId,
          prospects.length,
          i,
          campaign.schedule_settings // Pass settings here
        );

        const scheduledFor = new Date();
        scheduledFor.setMinutes(scheduledFor.getMinutes() + delayMinutes);

        // FIRST: Check if this LinkedIn URL exists in ANY other campaign (one prospect = one campaign rule)
        const { data: existingInOtherCampaign } = await supabase
          .from('campaign_prospects')
          .eq('linkedin_url', prospect.linkedin_url)
          .neq('campaign_id', campaignId)  // Must be in a DIFFERENT campaign
          .limit(1)
          .single();

        if (existingInOtherCampaign) {
          const otherCampaignName = (existingInOtherCampaign as any).campaigns?.campaign_name || 'another campaign';
          console.log(`⚠️  ${prospect.first_name} already exists in ${otherCampaignName} - cannot be in multiple campaigns`);

          // Update current prospect to failed (data integrity violation)
          await supabase
            .from('campaign_prospects')
            .update({
              status: 'failed',
              notes: `Duplicate: Already in ${otherCampaignName} (${existingInOtherCampaign.campaign_id})`,
              updated_at: new Date().toISOString()
            })
            .eq('id', prospect.id);

          results.push({
            prospectId: prospect.id,
            name: `${prospect.first_name} ${prospect.last_name}`,
            status: 'skipped',
            reason: 'duplicate_in_other_campaign'
          });
          continue;
        }

        // SECOND: Check if already contacted in THIS campaign
        const { data: existingInThisCampaign } = await supabase
          .from('campaign_prospects')
          .select('status, contacted_at')
          .eq('linkedin_url', prospect.linkedin_url)
          .eq('campaign_id', campaignId)
          .in('status', ['connection_request_sent', 'connected', 'messaging', 'replied'])
          .limit(1)
          .single();

        if (existingInThisCampaign) {
          console.log(`⚠️  Already contacted ${prospect.first_name} in this campaign (status: ${existingInThisCampaign.status})`);

          // Update current prospect to match existing status
          await supabase
            .from('campaign_prospects')
            .update({
              status: existingInThisCampaign.status,
              notes: `Already contacted in this campaign`,
              updated_at: new Date().toISOString()
            })
            .eq('id', prospect.id);

          results.push({
            prospectId: prospect.id,
            name: `${prospect.first_name} ${prospect.last_name}`,
            status: 'skipped',
            reason: `already_${existingInThisCampaign.status}`
          });
          continue;
        }

        // Get LinkedIn profile to verify relationship status before sending CR
        let providerId = prospect.linkedin_user_id;
        let profile: any = null;

        // CRITICAL FIX (Dec 8): ALWAYS use vanity endpoint - provider_id endpoint returns WRONG profiles!
        // Unipile bug: profile?provider_id= returns Jamshaid Ali when looking up Paul Dhaliwal
        // The legacy /users/{vanity} endpoint is the ONLY reliable method
        console.log(`📝 Extracting vanity identifier from ${prospect.linkedin_url}`);
        const vanityMatch = prospect.linkedin_url?.match(/linkedin\.com\/in\/([^\/\?#]+)/);
        if (vanityMatch) {
          const vanityId = vanityMatch[1];

          // ALWAYS use legacy /users/{vanity} endpoint (correct profile resolution)
          try {
            console.log(`  Using legacy endpoint (reliable): /users/${vanityId}`);
            profile = await unipileRequest(`/api/v1/users/${vanityId}?account_id=${unipileAccountId}`);
            providerId = profile.provider_id;
            console.log(`  ✅ Found correct profile: ${profile.first_name} ${profile.last_name} (ID: ${providerId})`);
          } catch (legacyError: any) {
            // If legacy fails, the profile likely doesn't exist or is private
            throw new Error(`Could not access LinkedIn profile for ${prospect.first_name} ${prospect.last_name} - profile may be private or deleted. Legacy endpoint error: ${legacyError.message || legacyError}`);
          }
        } else {
          throw new Error(`Could not extract LinkedIn vanity identifier from ${prospect.linkedin_url}`);
        }

        // Check if already connected
        if (profile.network_distance === 'FIRST_DEGREE') {
          console.log(`⚠️  Already connected to ${prospect.first_name} - skipping`);
          await supabase
            .from('campaign_prospects')
            .update({
              status: 'connected',
              notes: 'Already a 1st degree connection',
              linkedin_user_id: providerId,
              updated_at: new Date().toISOString()
            })
            .eq('id', prospect.id);

          results.push({
            prospectId: prospect.id,
            name: `${prospect.first_name} ${prospect.last_name}`,
            status: 'skipped',
            reason: 'already_connected'
          });
          continue;
        }

        // Check for WITHDRAWN invitations (LinkedIn enforces 3-4 week cooldown)
        if (profile.invitation?.status === 'WITHDRAWN') {
          console.log(`⚠️  Previously withdrawn invitation to ${prospect.first_name} - LinkedIn cooldown active`);

          // Calculate when the cooldown might end (3 weeks from now as estimate)
          const cooldownEndDate = new Date();
          cooldownEndDate.setDate(cooldownEndDate.getDate() + 21); // 3 weeks

          await supabase
            .from('campaign_prospects')
            .update({
              status: 'failed',
              notes: `Invitation previously withdrawn - LinkedIn cooldown until ~${cooldownEndDate.toISOString().split('T')[0]}. Use InMail or wait.`,
              linkedin_user_id: providerId,
              updated_at: new Date().toISOString()
            })
            .eq('id', prospect.id);

          results.push({
            prospectId: prospect.id,
            name: `${prospect.first_name} ${prospect.last_name}`,
            status: 'skipped',
            reason: 'withdrawn_cooldown'
          });
          continue;
        }

        // Check for existing PENDING invitation
        if (profile.invitation?.status === 'PENDING') {
          console.log(`⚠️  Invitation already pending to ${prospect.first_name}`);
          await supabase
            .from('campaign_prospects')
            .update({
              status: 'connection_request_sent',
              notes: 'Invitation already pending on LinkedIn',
              linkedin_user_id: providerId,
              updated_at: new Date().toISOString()
            })
            .eq('id', prospect.id);

          results.push({
            prospectId: prospect.id,
            name: `${prospect.first_name} ${prospect.last_name}`,
            status: 'skipped',
            reason: 'already_pending'
          });
          continue;
        }

        // Personalize message - ALL formats (Dec 4 fix)
        const firstName = prospect.first_name || '';
        const lastName = prospect.last_name || '';
        const companyName = prospect.company_name || '';
        const title = prospect.title || '';
        const personalizedMessage = connectionRequestMessage
          .replace(/\{first_name\}/gi, firstName)
          .replace(/\{last_name\}/gi, lastName)
          .replace(/\{company_name\}/gi, companyName)
          .replace(/\{company\}/gi, companyName)
          .replace(/\{title\}/gi, title)
          .replace(/\{\{first_name\}\}/gi, firstName)
          .replace(/\{\{last_name\}\}/gi, lastName)
          .replace(/\{\{company_name\}\}/gi, companyName)
          .replace(/\{\{company\}\}/gi, companyName)
          .replace(/\{firstName\}/g, firstName)
          .replace(/\{lastName\}/g, lastName)
          .replace(/\{companyName\}/g, companyName)
          .replace(/\{\{firstName\}\}/g, firstName)
          .replace(/\{\{lastName\}\}/g, lastName)
          .replace(/\{\{companyName\}\}/g, companyName);

        // Send connection request via REST API
        const payload = {
          account_id: unipileAccountId,
          provider_id: providerId,
          message: personalizedMessage
        };
        console.log(`📤 Sending connection request with payload:`, JSON.stringify(payload));
        await unipileRequest('/api/v1/users/invite', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        // Calculate next action time (3 days from now - gives time for acceptance)
        // Best practice: Allow 2-3 days for connection acceptance before first follow-up check
        const nextActionAt = new Date();
        nextActionAt.setDate(nextActionAt.getDate() + 3);

        // Update database
        await supabase
          .from('campaign_prospects')
          .update({
            status: 'connection_request_sent',
            contacted_at: new Date().toISOString(),
            linkedin_user_id: providerId,
            follow_up_due_at: nextActionAt.toISOString(),
            follow_up_sequence_index: 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', prospect.id);

        console.log(`✅ Connection request sent to ${prospect.first_name}`);
        console.log(`⏰ Next action scheduled for: ${nextActionAt.toISOString()}`);

        results.push({
          prospectId: prospect.id,
          name: `${prospect.first_name} ${prospect.last_name}`,
          status: 'success',
          nextActionAt: nextActionAt.toISOString()
        });

        // Small delay between requests (human-like behavior)
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

      } catch (error: any) {
        // Capture SDK and HTTP error details
        const errorDetails = {
          message: error.message || 'Unknown error',
          name: error.name,
          status: error.status || error.statusCode || error.response?.status,
          type: error.type,
          title: error.title,
          response: error.response?.data || error.response,
          stack: error.stack,
          cause: error.cause,
          // SDK-specific error fields
          body: error.body,
          statusCode: error.statusCode
        };

        console.error(`❌ Failed to process ${prospect.first_name}:`);
        console.error('Full error object:', error);
        console.error('Extracted details:', JSON.stringify(errorDetails, null, 2));

        // Create readable error message with specific handling for common errors
        let errorMessage = error.title || error.message || 'Unknown error';
        let errorNote = `CR failed: ${errorMessage}`;

        // Handle specific error types
        if (error.type === 'errors/already_invited_recently' ||
          errorMessage.includes('Should delay new invitation')) {
          errorNote = 'LinkedIn cooldown: This person was recently invited/withdrawn. Wait 3-4 weeks or use InMail.';

          // Try to set a more specific status for cooldown errors
          await supabase
            .from('campaign_prospects')
            .update({
              status: 'failed',
              notes: errorNote,
              updated_at: new Date().toISOString()
            })
            .eq('id', prospect.id);
        } else if (error.status === 429) {
          errorNote = 'Rate limited: Too many requests. Wait before retrying.';
          await supabase
            .from('campaign_prospects')
            .update({
              status: 'failed',
              notes: errorNote,
              updated_at: new Date().toISOString()
            })
            .eq('id', prospect.id);
        } else {
          // Generic error handling
          errorNote = `CR failed: ${errorMessage}${error.status ? ` (${error.status})` : ''}${error.type ? ` [${error.type}]` : ''}`;
          await supabase
            .from('campaign_prospects')
            .update({
              status: 'failed',
              notes: errorNote,
              updated_at: new Date().toISOString()
            })
            .eq('id', prospect.id);
        }

        results.push({
          prospectId: prospect.id,
          name: `${prospect.first_name} ${prospect.last_name}`,
          status: 'failed',
          error: errorMessage,
          errorDetails: errorDetails
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    console.log(`\n📊 Summary: ${successCount} sent, ${failedCount} failed`);

    return NextResponse.json({
      success: true,
      processed: prospects.length,
      sent: successCount,
      failed: failedCount,
      results
    });

  } catch (error: any) {
    const errorDetails = {
      message: error.message || 'Unknown error',
      status: error.status || error.statusCode,
      type: error.type,
      title: error.title,
      response: error.response?.data,
      stack: error.stack
    };

    console.error('❌ Campaign execution error:', JSON.stringify(errorDetails, null, 2));

    return NextResponse.json({
      error: error.title || error.message || 'Internal server error',
      details: errorDetails
    }, { status: 500 });
  }
}
