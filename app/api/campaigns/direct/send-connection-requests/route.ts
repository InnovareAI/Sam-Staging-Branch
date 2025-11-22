import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Direct Campaign Execution - Send Connection Requests
 *
 * Simple, no workflow engines:
 * 1. Fetch pending prospects
 * 2. Send CR via Unipile REST API
 * 3. Update DB with next_action_at
 *
 * POST /api/campaigns/direct/send-connection-requests
 * Body: { campaignId: string }
 */

export const maxDuration = 300; // 5 minutes

// Unipile REST API configuration
const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;

async function unipileRequest(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${UNIPILE_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'X-Api-Key': UNIPILE_API_KEY,
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { campaignId } = await req.json();

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId required' }, { status: 400 });
    }

    console.log(`🚀 Starting direct campaign execution: ${campaignId}`);

    // 1. Fetch campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        id,
        campaign_name,
        message_templates,
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
    const unipileAccountId = linkedinAccount.unipile_account_id;

    if (!unipileAccountId) {
      return NextResponse.json({ error: 'No LinkedIn account configured' }, { status: 400 });
    }

    console.log(`📋 Campaign: ${campaign.campaign_name}`);
    console.log(`👤 LinkedIn Account: ${linkedinAccount.account_name} (${unipileAccountId})`);

    // 2. Fetch pending prospects
    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select('*')
      .eq('campaign_id', campaignId)
      .in('status', ['pending', 'approved'])
      .not('linkedin_url', 'is', null)
      .order('created_at', { ascending: true })
      .limit(20); // Process 20 at a time

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

    console.log(`📊 Found ${prospects.length} prospects to contact`);

    // 3. Process each prospect
    const results = [];
    const connectionRequestMessage = campaign.message_templates?.connection_request ||
      'Hi {first_name}, I\'d like to connect!';

    for (const prospect of prospects) {
      try {
        console.log(`\n👤 Processing: ${prospect.first_name} ${prospect.last_name}`);

        // FIRST: Check if this LinkedIn URL was already contacted (any campaign, any workspace)
        const { data: existingContact } = await supabase
          .from('campaign_prospects')
          .select('status, contacted_at, campaign_id')
          .eq('linkedin_url', prospect.linkedin_url)
          .in('status', ['connection_request_sent', 'connected', 'messaging', 'replied'])
          .order('contacted_at', { ascending: false })
          .limit(1)
          .single();

        if (existingContact) {
          console.log(`⚠️  Already contacted ${prospect.first_name} (status: ${existingContact.status}, date: ${existingContact.contacted_at})`);

          // Update current prospect to match existing status
          await supabase
            .from('campaign_prospects')
            .update({
              status: existingContact.status,
              notes: `Previously contacted in campaign ${existingContact.campaign_id}`,
              updated_at: new Date().toISOString()
            })
            .eq('id', prospect.id);

          results.push({
            prospectId: prospect.id,
            name: `${prospect.first_name} ${prospect.last_name}`,
            status: 'skipped',
            reason: `already_${existingContact.status}`
          });
          continue;
        }

        // Get LinkedIn profile to get provider_id
        // Always fetch from Unipile - don't trust linkedin_user_id (may contain CSV import IDs)
        console.log(`📝 Fetching LinkedIn profile for ${prospect.linkedin_url}...`);
        const profile = await unipileRequest(
          `/api/v1/users/profile?account_id=${unipileAccountId}&identifier=${encodeURIComponent(prospect.linkedin_url)}`
        );
        const providerId = profile.provider_id;

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

        // Personalize message
        const personalizedMessage = connectionRequestMessage
          .replace(/{first_name}/g, prospect.first_name)
          .replace(/{last_name}/g, prospect.last_name)
          .replace(/{company_name}/g, prospect.company_name || '')
          .replace(/{title}/g, prospect.title || '');

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

        // Calculate next action time (2 days from now)
        const nextActionAt = new Date();
        nextActionAt.setDate(nextActionAt.getDate() + 2);

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

        // Create readable error message
        const errorMessage = error.title || error.message || 'Unknown error';
        const errorNote = `CR failed: ${errorMessage}${error.status ? ` (${error.status})` : ''}${error.type ? ` [${error.type}]` : ''}`;

        // Mark as failed - do NOT infer success from error messages
        await supabase
          .from('campaign_prospects')
          .update({
            status: 'failed',
            notes: errorNote,
            updated_at: new Date().toISOString()
          })
          .eq('id', prospect.id);

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
