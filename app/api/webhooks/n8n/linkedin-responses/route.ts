import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { verifyN8NWebhook, getRequestBody } from '@/lib/security/webhook-auth';

// Webhook handler for LinkedIn response notifications from N8N
export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature
    const body = await getRequestBody(request);
    const { valid, error } = await verifyN8NWebhook(request, body);

    if (!valid && error) {
      console.error('❌ Invalid N8N webhook signature');
      return error;
    }

    const payload = JSON.parse(body);
    
    console.log('💼 LinkedIn Response Webhook received:', {
      campaign_id: payload.campaign_id,
      prospect_id: payload.prospect_id,
      response_type: payload.response_type,
      timestamp: payload.timestamp
    });

    // Validate required fields
    if (!payload.campaign_id || !payload.prospect_id) {
      return NextResponse.json(
        { error: 'Missing required fields: campaign_id or prospect_id' },
        { status: 400 }
      );
    }

    // Store LinkedIn response data
    const { data: responseData, error: insertError } = await supabase
      .from('linkedin_responses')
      .insert({
        campaign_id: payload.campaign_id,
        prospect_id: payload.prospect_id,
        response_type: payload.response_type || 'message',
        response_content: payload.response_content,
        sender_info: payload.sender_info,
        response_classification: payload.response_classification, // positive/negative/neutral/out_of_office
        sentiment_score: payload.sentiment_score,
        contains_meeting_request: payload.contains_meeting_request || false,
        contains_contact_info: payload.contains_contact_info || false,
        unipile_message_id: payload.unipile_message_id,
        linkedin_thread_id: payload.linkedin_thread_id,
        raw_webhook_data: payload,
        received_at: new Date().toISOString()
      })
      .select();

    if (insertError) {
      console.error('❌ Failed to store LinkedIn response:', insertError);
      return NextResponse.json(
        { error: 'Failed to store LinkedIn response' },
        { status: 500 }
      );
    }

    // Update prospect status based on response
    await updateProspectStatus(payload);

    // Classify and route response
    await classifyAndRouteResponse(payload);

    // Update campaign metrics
    await updateCampaignMetrics(payload);

    // Send real-time notification to user
    await sendRealtimeNotification(payload);

    return NextResponse.json({
      success: true,
      message: 'LinkedIn response processed',
      response_id: responseData?.[0]?.id
    });

  } catch (error) {
    console.error('❌ LinkedIn Response Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function updateProspectStatus(payload: any) {
  const newStatus = determineProspectStatus(payload.response_classification);
  
  const { error } = await supabase
    .from('campaign_prospects')
    .update({
      status: newStatus,
      last_response_at: new Date().toISOString(),
      response_count: supabase.sql`response_count + 1`,
      latest_response_type: payload.response_type,
      latest_response_classification: payload.response_classification
    })
    .eq('id', payload.prospect_id);

  if (error) {
    console.error('❌ Failed to update prospect status:', error);
  } else {
    console.log(`✅ Updated prospect ${payload.prospect_id} status to: ${newStatus}`);
  }
}

function determineProspectStatus(classification: string): string {
  switch (classification) {
    case 'positive':
      return 'engaged';
    case 'meeting_request':
      return 'meeting_requested';
    case 'interested':
      return 'qualified';
    case 'negative':
      return 'not_interested';
    case 'out_of_office':
      return 'follow_up_later';
    case 'unsubscribe':
      return 'unsubscribed';
    default:
      return 'responded';
  }
}

async function classifyAndRouteResponse(payload: any) {
  const classification = payload.response_classification;
  
  switch (classification) {
    case 'positive':
    case 'meeting_request':
      await routeToSalesTeam(payload);
      break;
    case 'interested':
      await addToNurtureSequence(payload);
      break;
    case 'negative':
    case 'unsubscribe':
      await addToSuppressionList(payload);
      break;
    case 'out_of_office':
      await scheduleFollowUp(payload);
      break;
    default:
      console.log(`📝 Response classified as: ${classification}, no automatic routing`);
  }
}

async function routeToSalesTeam(payload: any) {
  console.log('🎯 Routing hot lead to sales team:', payload.prospect_id);
  
  // Create sales notification
  const { error } = await supabase
    .from('sales_notifications')
    .insert({
      campaign_id: payload.campaign_id,
      prospect_id: payload.prospect_id,
      notification_type: 'hot_lead',
      priority: 'high',
      message: `LinkedIn response from ${payload.sender_info?.name}: ${payload.response_content?.substring(0, 100)}...`,
      response_data: payload,
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error('❌ Failed to create sales notification:', error);
  }
}

async function addToNurtureSequence(payload: any) {
  console.log('📧 Adding to nurture sequence:', payload.prospect_id);
  
  const { error } = await supabase
    .from('nurture_sequences')
    .insert({
      prospect_id: payload.prospect_id,
      sequence_type: 'linkedin_interested',
      trigger_response: payload.response_content,
      started_at: new Date().toISOString(),
      status: 'active'
    });

  if (error) {
    console.error('❌ Failed to add to nurture sequence:', error);
  }
}

async function addToSuppressionList(payload: any) {
  console.log('🚫 Adding to suppression list:', payload.prospect_id);
  
  const { error } = await supabase
    .from('suppression_list')
    .insert({
      prospect_id: payload.prospect_id,
      campaign_id: payload.campaign_id,
      suppression_reason: payload.response_classification,
      suppression_source: 'linkedin_response',
      response_content: payload.response_content,
      added_at: new Date().toISOString()
    });

  if (error) {
    console.error('❌ Failed to add to suppression list:', error);
  }
}

async function scheduleFollowUp(payload: any) {
  console.log('📅 Scheduling follow-up:', payload.prospect_id);
  
  // Schedule follow-up for 2 weeks later
  const followUpDate = new Date();
  followUpDate.setDate(followUpDate.getDate() + 14);
  
  const { error } = await supabase
    .from('scheduled_follow_ups')
    .insert({
      prospect_id: payload.prospect_id,
      campaign_id: payload.campaign_id,
      follow_up_type: 'out_of_office_return',
      scheduled_date: followUpDate.toISOString(),
      original_response: payload.response_content,
      status: 'scheduled'
    });

  if (error) {
    console.error('❌ Failed to schedule follow-up:', error);
  }
}

async function updateCampaignMetrics(payload: any) {
  // Update real-time campaign metrics
  const { error } = await supabase.rpc('update_campaign_response_metrics', {
    p_campaign_id: payload.campaign_id,
    p_response_type: payload.response_classification,
    p_platform: 'linkedin'
  });

  if (error) {
    console.error('❌ Failed to update campaign metrics:', error);
  }
}

async function sendRealtimeNotification(payload: any) {
  // Send real-time notification to dashboard
  const { error } = await supabase
    .from('real_time_notifications')
    .insert({
      campaign_id: payload.campaign_id,
      notification_type: 'linkedin_response',
      title: `New LinkedIn Response`,
      message: `Response from ${payload.sender_info?.name || 'prospect'}: ${payload.response_classification}`,
      data: payload,
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error('❌ Failed to send realtime notification:', error);
  }
}