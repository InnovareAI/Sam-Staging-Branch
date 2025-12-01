import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyN8NWebhook, getRequestBody } from '@/lib/security/webhook-auth';
import { airtableService } from '@/lib/airtable';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Webhook handler for email response notifications from N8N/ActiveCampaign
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
    
    console.log('📧 Email Response Webhook received:', {
      campaign_id: payload.campaign_id,
      prospect_id: payload.prospect_id,
      response_type: payload.response_type,
      from_email: payload.from_email
    });

    // Validate required fields
    if (!payload.campaign_id || !payload.from_email) {
      return NextResponse.json(
        { error: 'Missing required fields: campaign_id or from_email' },
        { status: 400 }
      );
    }

    // Find prospect by email if prospect_id not provided
    let prospectId = payload.prospect_id;
    if (!prospectId) {
      const { data: prospects } = await supabase
        .from('campaign_prospects')
        .select('id')
        .eq('email', payload.from_email)
        .eq('campaign_approval_session_id', payload.campaign_id)
        .limit(1);
      
      prospectId = prospects?.[0]?.id;
    }

    if (!prospectId) {
      console.warn('⚠️ No prospect found for email:', payload.from_email);
      return NextResponse.json(
        { warning: 'No prospect found for email address' },
        { status: 200 }
      );
    }

    // Store email response data
    const { data: responseData, error: insertError } = await supabase
      .from('email_responses')
      .insert({
        campaign_id: payload.campaign_id,
        prospect_id: prospectId,
        from_email: payload.from_email,
        subject: payload.subject,
        response_content: payload.response_content,
        response_type: payload.response_type || 'reply',
        response_classification: payload.response_classification, // positive/negative/neutral/out_of_office
        sentiment_score: payload.sentiment_score,
        contains_meeting_request: payload.contains_meeting_request || false,
        contains_calendar_link: payload.contains_calendar_link || false,
        contains_phone_number: payload.contains_phone_number || false,
        contains_unsubscribe: payload.contains_unsubscribe || false,
        email_thread_id: payload.email_thread_id,
        activecampaign_message_id: payload.activecampaign_message_id,
        raw_webhook_data: payload,
        received_at: new Date().toISOString()
      })
      .select();

    if (insertError) {
      console.error('❌ Failed to store email response:', insertError);
      return NextResponse.json(
        { error: 'Failed to store email response' },
        { status: 500 }
      );
    }

    // Update prospect status based on response
    await updateProspectEmailStatus(prospectId, payload);

    // Classify and route response
    await classifyAndRouteEmailResponse(prospectId, payload);

    // Update campaign metrics
    await updateEmailCampaignMetrics(payload);

    // Handle specific response types
    if (payload.contains_meeting_request) {
      await handleMeetingRequest(prospectId, payload);
    }

    if (payload.contains_unsubscribe) {
      await handleUnsubscribe(prospectId, payload);
    }

    // Send real-time notification
    await sendEmailResponseNotification(prospectId, payload);

    return NextResponse.json({
      success: true,
      message: 'Email response processed',
      response_id: responseData?.[0]?.id,
      prospect_id: prospectId
    });

  } catch (error) {
    console.error('❌ Email Response Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function updateProspectEmailStatus(prospectId: string, payload: any) {
  const newStatus = determineEmailProspectStatus(payload.response_classification);
  
  const { error } = await supabase
    .from('campaign_prospects')
    .update({
      status: newStatus,
      last_email_response_at: new Date().toISOString(),
      email_response_count: supabase.sql`COALESCE(email_response_count, 0) + 1`,
      latest_email_response_type: payload.response_type,
      latest_email_response_classification: payload.response_classification
    })
    .eq('id', prospectId);

  if (error) {
    console.error('❌ Failed to update prospect email status:', error);
  } else {
    console.log(`✅ Updated prospect ${prospectId} email status to: ${newStatus}`);
  }
}

function determineEmailProspectStatus(classification: string): string {
  switch (classification) {
    case 'positive':
    case 'interested':
      return 'email_engaged';
    case 'meeting_request':
      return 'meeting_requested';
    case 'qualified':
      return 'email_qualified';
    case 'negative':
    case 'not_interested':
      return 'not_interested';
    case 'out_of_office':
      return 'follow_up_later';
    case 'unsubscribe':
      return 'unsubscribed';
    case 'bounced':
      return 'invalid_email';
    default:
      return 'email_responded';
  }
}

async function classifyAndRouteEmailResponse(prospectId: string, payload: any) {
  const classification = payload.response_classification;
  
  switch (classification) {
    case 'positive':
    case 'interested':
    case 'meeting_request':
      await routeEmailToSales(prospectId, payload);
      break;
    case 'qualified':
      await addToEmailNurture(prospectId, payload);
      break;
    case 'negative':
    case 'not_interested':
      await addToEmailSuppression(prospectId, payload);
      break;
    case 'out_of_office':
      await scheduleEmailFollowUp(prospectId, payload);
      break;
    case 'unsubscribe':
      await processUnsubscribe(prospectId, payload);
      break;
    default:
      console.log(`📝 Email classified as: ${classification}, no automatic routing`);
  }
}

async function routeEmailToSales(prospectId: string, payload: any) {
  console.log('🎯 Routing email lead to sales team:', prospectId);

  const { error } = await supabase
    .from('sales_notifications')
    .insert({
      campaign_id: payload.campaign_id,
      prospect_id: prospectId,
      notification_type: 'hot_email_lead',
      priority: payload.contains_meeting_request ? 'urgent' : 'high',
      message: `Email response from ${payload.from_email}: ${payload.subject}`,
      response_data: payload,
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error('❌ Failed to create email sales notification:', error);
  }

  // Sync to Airtable Cold Email table
  try {
    // Get prospect details for Airtable
    const { data: prospect } = await supabase
      .from('campaign_prospects')
      .select('first_name, last_name, company, campaigns(campaign_name)')
      .eq('id', prospectId)
      .single();

    const prospectName = prospect
      ? `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim()
      : payload.from_email.split('@')[0];

    console.log(`📊 Syncing positive email lead to Airtable: ${prospectName}`);

    const airtableResult = await airtableService.syncEmailLead({
      email: payload.from_email,
      name: prospectName || 'Unknown',
      campaignName: (prospect?.campaigns as any)?.campaign_name,
      replyText: payload.response_content,
      intent: payload.response_classification === 'meeting_request' ? 'booking_request' : 'interested',
    });

    if (airtableResult.success) {
      console.log(`✅ Airtable email sync successful - Record ID: ${airtableResult.recordId}`);
    } else {
      console.log(`⚠️ Airtable email sync failed: ${airtableResult.error}`);
    }
  } catch (airtableError) {
    console.error('❌ Airtable email sync error:', airtableError);
  }
}

async function addToEmailNurture(prospectId: string, payload: any) {
  console.log('📧 Adding to email nurture sequence:', prospectId);
  
  const { error } = await supabase
    .from('nurture_sequences')
    .insert({
      prospect_id: prospectId,
      sequence_type: 'email_interested',
      trigger_response: payload.response_content,
      started_at: new Date().toISOString(),
      status: 'active'
    });

  if (error) {
    console.error('❌ Failed to add to email nurture:', error);
  }
}

async function addToEmailSuppression(prospectId: string, payload: any) {
  console.log('🚫 Adding to email suppression list:', prospectId);
  
  const { error } = await supabase
    .from('suppression_list')
    .insert({
      prospect_id: prospectId,
      campaign_id: payload.campaign_id,
      suppression_reason: payload.response_classification,
      suppression_source: 'email_response',
      response_content: payload.response_content,
      added_at: new Date().toISOString()
    });

  if (error) {
    console.error('❌ Failed to add to email suppression:', error);
  }
}

async function scheduleEmailFollowUp(prospectId: string, payload: any) {
  console.log('📅 Scheduling email follow-up:', prospectId);
  
  const followUpDate = new Date();
  followUpDate.setDate(followUpDate.getDate() + 14);
  
  const { error } = await supabase
    .from('scheduled_follow_ups')
    .insert({
      prospect_id: prospectId,
      campaign_id: payload.campaign_id,
      follow_up_type: 'email_out_of_office_return',
      scheduled_date: followUpDate.toISOString(),
      original_response: payload.response_content,
      status: 'scheduled'
    });

  if (error) {
    console.error('❌ Failed to schedule email follow-up:', error);
  }
}

async function handleMeetingRequest(prospectId: string, payload: any) {
  console.log('📅 Processing meeting request:', prospectId);
  
  const { error } = await supabase
    .from('meeting_requests')
    .insert({
      prospect_id: prospectId,
      campaign_id: payload.campaign_id,
      request_source: 'email',
      request_content: payload.response_content,
      contains_calendar_link: payload.contains_calendar_link,
      contains_phone_number: payload.contains_phone_number,
      priority: 'high',
      status: 'new',
      received_at: new Date().toISOString()
    });

  if (error) {
    console.error('❌ Failed to store meeting request:', error);
  }
}

async function handleUnsubscribe(prospectId: string, payload: any) {
  console.log('🚫 Processing unsubscribe request:', prospectId);
  
  // Add to global suppression list
  const { error } = await supabase
    .from('global_suppression_list')
    .insert({
      email: payload.from_email,
      suppression_reason: 'unsubscribe_request',
      suppression_source: 'email_response',
      added_at: new Date().toISOString()
    });

  if (error) {
    console.error('❌ Failed to add to global suppression:', error);
  }
}

async function processUnsubscribe(prospectId: string, payload: any) {
  await handleUnsubscribe(prospectId, payload);
  await addToEmailSuppression(prospectId, payload);
}

async function updateEmailCampaignMetrics(payload: any) {
  const { error } = await supabase.rpc('update_campaign_response_metrics', {
    p_campaign_id: payload.campaign_id,
    p_response_type: payload.response_classification,
    p_platform: 'email'
  });

  if (error) {
    console.error('❌ Failed to update email campaign metrics:', error);
  }
}

async function sendEmailResponseNotification(prospectId: string, payload: any) {
  const { error } = await supabase
    .from('real_time_notifications')
    .insert({
      campaign_id: payload.campaign_id,
      notification_type: 'email_response',
      title: `New Email Response`,
      message: `Email from ${payload.from_email}: ${payload.response_classification}`,
      data: { ...payload, prospect_id: prospectId },
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error('❌ Failed to send email response notification:', error);
  }
}