import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Webhook handler for N8N campaign status updates
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    
    console.log('📡 N8N Campaign Status Webhook received:', {
      campaign_id: payload.campaign_id,
      status: payload.status,
      timestamp: payload.timestamp
    });

    // Validate required fields
    if (!payload.campaign_id || !payload.status) {
      return NextResponse.json(
        { error: 'Missing required fields: campaign_id or status' },
        { status: 400 }
      );
    }

    // Update campaign status in database
    const { data: updateResult, error: updateError } = await supabase
      .from('n8n_campaign_executions')
      .update({
        status: payload.status,
        progress: payload.progress || {},
        current_step: payload.current_step,
        estimated_time_remaining: payload.estimated_time_remaining,
        error_details: payload.error_details,
        updated_at: new Date().toISOString()
      })
      .eq('campaign_approval_session_id', payload.campaign_id)
      .select();

    if (updateError) {
      console.error('❌ Failed to update campaign status:', updateError);
      return NextResponse.json(
        { error: 'Failed to update campaign status' },
        { status: 500 }
      );
    }

    // Handle different status types
    switch (payload.status) {
      case 'intelligence_complete':
        await handleIntelligenceComplete(payload);
        break;
      case 'campaign_launched':
        await handleCampaignLaunched(payload);
        break;
      case 'completed':
        await handleCampaignCompleted(payload);
        break;
      case 'failed':
        await handleCampaignFailed(payload);
        break;
      default:
        console.log(`📊 Campaign status updated: ${payload.status}`);
    }

    // Send real-time update to frontend (if user is online)
    await sendRealtimeUpdate(payload);

    return NextResponse.json({
      success: true,
      message: 'Campaign status updated',
      campaign_id: payload.campaign_id,
      status: payload.status
    });

  } catch (error) {
    console.error('❌ N8N Campaign Status Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleIntelligenceComplete(payload: any) {
  console.log('🧠 Intelligence phase completed:', {
    campaign_id: payload.campaign_id,
    total_prospects: payload.total_prospects,
    verified_contacts: payload.verified_contacts,
    estimated_cost: payload.estimated_cost
  });

  // Store intelligence results
  const { error } = await supabase
    .from('campaign_intelligence_results')
    .upsert({
      campaign_id: payload.campaign_id,
      total_prospects_discovered: payload.total_prospects,
      verified_contacts: payload.verified_contacts,
      estimated_cost: payload.estimated_cost,
      data_sources_used: payload.data_sources || [],
      personalization_score_avg: payload.personalization_avg,
      ready_for_execution: payload.ready_for_execution,
      webhook_endpoints: payload.webhook_endpoints,
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error('❌ Failed to store intelligence results:', error);
  }
}

async function handleCampaignLaunched(payload: any) {
  console.log('🚀 Campaign execution launched:', {
    campaign_id: payload.campaign_id,
    email_count: payload.email_campaign?.ready_contacts,
    linkedin_count: payload.linkedin_campaign?.ready_contacts
  });

  // Update campaign execution tracking
  const { error } = await supabase
    .from('n8n_campaign_executions')
    .update({
      started_at: new Date().toISOString(),
      progress: {
        total_prospects: (payload.email_campaign?.ready_contacts || 0) + (payload.linkedin_campaign?.ready_contacts || 0),
        processed_prospects: 0,
        successful_outreach: 0,
        failed_outreach: 0,
        responses_received: 0
      }
    })
    .eq('campaign_approval_session_id', payload.campaign_id);

  if (error) {
    console.error('❌ Failed to update campaign launch:', error);
  }
}

async function handleCampaignCompleted(payload: any) {
  console.log('✅ Campaign completed:', {
    campaign_id: payload.campaign_id,
    delivered_count: payload.delivered_count,
    failed_count: payload.failed_count
  });

  // Store final campaign results
  const { error } = await supabase
    .from('n8n_campaign_executions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      campaign_results: {
        delivered_count: payload.delivered_count,
        failed_count: payload.failed_count,
        response_rate: payload.response_rate,
        total_responses: payload.total_responses,
        completion_timestamp: payload.timestamp
      }
    })
    .eq('campaign_approval_session_id', payload.campaign_id);

  if (error) {
    console.error('❌ Failed to store campaign completion:', error);
  }
}

async function handleCampaignFailed(payload: any) {
  console.error('❌ Campaign failed:', {
    campaign_id: payload.campaign_id,
    error: payload.error_details
  });

  // Log failure details
  const { error } = await supabase
    .from('n8n_campaign_executions')
    .update({
      status: 'failed',
      error_details: payload.error_details,
      completed_at: new Date().toISOString()
    })
    .eq('campaign_approval_session_id', payload.campaign_id);

  if (error) {
    console.error('❌ Failed to log campaign failure:', error);
  }
}

async function sendRealtimeUpdate(payload: any) {
  // Send real-time update via Supabase realtime
  const { error } = await supabase
    .from('campaign_status_updates')
    .insert({
      campaign_id: payload.campaign_id,
      status: payload.status,
      progress: payload.progress,
      message: payload.message || `Campaign ${payload.status}`,
      timestamp: new Date().toISOString()
    });

  if (error) {
    console.error('❌ Failed to send realtime update:', error);
  }
}