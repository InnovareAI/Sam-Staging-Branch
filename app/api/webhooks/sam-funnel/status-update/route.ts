import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      execution_id,
      message_id,
      prospect_id,
      event_type,
      status,
      response_data = null,
      error_details = null,
      timestamp = new Date().toISOString()
    } = body;

    if (!execution_id || !event_type) {
      return NextResponse.json({ 
        error: 'Missing required fields: execution_id, event_type' 
      }, { status: 400 });
    }

    console.log(`Sam Funnel webhook: ${event_type} for execution ${execution_id}`);

    // Handle different event types
    switch (event_type) {
      case 'execution_started':
        await handleExecutionStarted(execution_id, body);
        break;
        
      case 'message_sent':
        await handleMessageSent(message_id, prospect_id, body);
        break;
        
      case 'message_delivered':
        await handleMessageDelivered(message_id, body);
        break;
        
      case 'message_read':
        await handleMessageRead(message_id, body);
        break;
        
      case 'response_received':
        await handleResponseReceived(execution_id, message_id, prospect_id, response_data);
        break;
        
      case 'qualification_received':
        await handleQualificationResponse(execution_id, message_id, prospect_id, response_data);
        break;
        
      case 'step_completed':
        await handleStepCompleted(execution_id, body);
        break;
        
      case 'execution_completed':
        await handleExecutionCompleted(execution_id, body);
        break;
        
      case 'execution_failed':
        await handleExecutionFailed(execution_id, error_details);
        break;
        
      default:
        console.warn(`Unknown Sam Funnel event type: ${event_type}`);
        return NextResponse.json({ 
          warning: `Unknown event type: ${event_type}` 
        }, { status: 200 });
    }

    return NextResponse.json({ 
      success: true, 
      processed: event_type,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Sam Funnel webhook error:', error);
    return NextResponse.json({ 
      error: 'Webhook processing failed' 
    }, { status: 500 });
  }
}

// Handle execution started
async function handleExecutionStarted(execution_id: string, data: any) {
  const { error } = await supabase
    .from('sam_funnel_executions')
    .update({
      status: 'running',
      updated_at: new Date().toISOString()
    })
    .eq('id', execution_id);

  if (error) {
    console.error('Failed to update execution start status:', error);
    throw error;
  }

  console.log(`Sam Funnel execution ${execution_id} started`);
}

// Handle message sent
async function handleMessageSent(message_id: string, prospect_id: string, data: any) {
  const { sent_date, channel, platform_message_id } = data;

  // Update message status
  const { error: messageError } = await supabase
    .from('sam_funnel_messages')
    .update({
      status: 'sent',
      sent_date: sent_date || new Date().toISOString(),
      platform_message_id,
      updated_at: new Date().toISOString()
    })
    .eq('id', message_id);

  if (messageError) {
    console.error('Failed to update message sent status:', messageError);
    throw messageError;
  }

  // Update prospect status
  const { error: prospectError } = await supabase
    .from('campaign_prospects')
    .update({
      status: 'sam_funnel_active',
      last_contact_date: sent_date || new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', prospect_id);

  if (prospectError) {
    console.error('Failed to update prospect status:', prospectError);
  }

  console.log(`Message ${message_id} sent to prospect ${prospect_id}`);
}

// Handle message delivered
async function handleMessageDelivered(message_id: string, data: any) {
  const { delivery_date, platform_status } = data;

  const { error } = await supabase
    .from('sam_funnel_messages')
    .update({
      status: 'delivered',
      delivery_date,
      platform_status,
      updated_at: new Date().toISOString()
    })
    .eq('id', message_id);

  if (error) {
    console.error('Failed to update message delivery status:', error);
    throw error;
  }

  console.log(`Message ${message_id} delivered`);
}

// Handle message read
async function handleMessageRead(message_id: string, data: any) {
  const { read_date } = data;

  const { error } = await supabase
    .from('sam_funnel_messages')
    .update({
      status: 'read',
      read_date,
      updated_at: new Date().toISOString()
    })
    .eq('id', message_id);

  if (error) {
    console.error('Failed to update message read status:', error);
    throw error;
  }

  console.log(`Message ${message_id} read`);
}

// Handle response received
async function handleResponseReceived(execution_id: string, message_id: string, prospect_id: string, response_data: any) {
  const { 
    response_content, 
    response_type, 
    sentiment_score,
    intent_analysis,
    sam_suggested_reply,
    sam_confidence_score 
  } = response_data;

  // Update message status
  const { error: messageError } = await supabase
    .from('sam_funnel_messages')
    .update({
      response_received: true,
      response_type,
      response_content,
      updated_at: new Date().toISOString()
    })
    .eq('id', message_id);

  if (messageError) {
    console.error('Failed to update message response status:', messageError);
  }

  // Create response record
  const { error: responseError } = await supabase
    .from('sam_funnel_responses')
    .insert({
      execution_id,
      message_id,
      prospect_id,
      response_type,
      response_content,
      sam_analysis: {
        sentiment_score,
        intent_analysis,
        processed_at: new Date().toISOString()
      },
      sam_suggested_reply,
      sam_confidence_score,
      requires_approval: response_type !== 'opt_out' // Opt-outs are handled automatically
    });

  if (responseError) {
    console.error('Failed to create response record:', responseError);
    throw responseError;
  }

  // Update prospect status
  const newStatus = getProspectStatusFromResponse(response_type);
  const { error: prospectError } = await supabase
    .from('campaign_prospects')
    .update({
      status: newStatus,
      last_response_date: new Date().toISOString(),
      last_response_type: response_type,
      updated_at: new Date().toISOString()
    })
    .eq('id', prospect_id);

  if (prospectError) {
    console.error('Failed to update prospect response status:', prospectError);
  }

  console.log(`Response received from prospect ${prospect_id}: ${response_type}`);

  // If it's an opt-out, handle automatically
  if (response_type === 'opt_out') {
    await handleAutomaticOptOut(prospect_id);
  }
}

// Handle qualification response (from goodbye message)
async function handleQualificationResponse(execution_id: string, message_id: string, prospect_id: string, response_data: any) {
  const { qualification_option, response_content } = response_data;

  try {
    // Use the database function to process qualification
    const { data, error } = await supabase.rpc('process_qualification_response', {
      p_execution_id: execution_id,
      p_message_id: message_id,
      p_prospect_id: prospect_id,
      p_qualification_option: qualification_option,
      p_response_content: response_content
    });

    if (error) {
      console.error('Failed to process qualification response:', error);
      throw error;
    }

    console.log(`Qualification response processed: ${qualification_option} - ${data.action}`);

    // If it's a meeting request, trigger calendar booking workflow
    if (qualification_option === 'c') {
      await triggerMeetingBookingWorkflow(prospect_id, execution_id);
    }

  } catch (error) {
    console.error('Failed to handle qualification response:', error);
    throw error;
  }
}

// Handle step completed
async function handleStepCompleted(execution_id: string, data: any) {
  const { step_number, step_type, completed_prospects, total_prospects } = data;

  // Update analytics
  await updateStepAnalytics(execution_id, step_number, step_type, data);

  console.log(`Step ${step_number} (${step_type}) completed for execution ${execution_id}: ${completed_prospects}/${total_prospects} prospects`);
}

// Handle execution completed
async function handleExecutionCompleted(execution_id: string, data: any) {
  const { 
    total_prospects,
    prospects_responded,
    prospects_converted,
    final_response_rate,
    final_conversion_rate,
    completion_date 
  } = data;

  const { error } = await supabase
    .from('sam_funnel_executions')
    .update({
      status: 'completed',
      prospects_responded,
      response_rate: final_response_rate,
      conversion_rate: final_conversion_rate,
      actual_completion_date: completion_date || new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', execution_id);

  if (error) {
    console.error('Failed to update execution completion:', error);
    throw error;
  }

  // Update template performance metrics
  await updateTemplatePerformance(execution_id);

  console.log(`Sam Funnel execution ${execution_id} completed: ${final_response_rate}% response rate`);
}

// Handle execution failed
async function handleExecutionFailed(execution_id: string, error_details: any) {
  const { error } = await supabase
    .from('sam_funnel_executions')
    .update({
      status: 'failed',
      error_details,
      updated_at: new Date().toISOString()
    })
    .eq('id', execution_id);

  if (error) {
    console.error('Failed to update execution failure status:', error);
    throw error;
  }

  console.error(`Sam Funnel execution ${execution_id} failed:`, error_details);
}

// Helper functions
function getProspectStatusFromResponse(response_type: string): string {
  switch (response_type) {
    case 'positive':
      return 'sam_funnel_interested';
    case 'negative':
      return 'sam_funnel_not_interested';
    case 'question':
      return 'sam_funnel_has_questions';
    case 'objection':
      return 'sam_funnel_has_objections';
    case 'opt_out':
      return 'opted_out';
    case 'meeting_request':
      return 'meeting_requested';
    default:
      return 'sam_funnel_responded';
  }
}

async function handleAutomaticOptOut(prospect_id: string) {
  // Mark as DNC and stop all future messages
  const { error } = await supabase
    .from('campaign_prospects')
    .update({
      status: 'opted_out',
      dnc: true,
      dnc_date: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', prospect_id);

  if (error) {
    console.error('Failed to process automatic opt-out:', error);
  }

  // Cancel any future scheduled messages
  await supabase
    .from('sam_funnel_messages')
    .update({
      status: 'cancelled',
      skip_reason: 'prospect_opted_out',
      updated_at: new Date().toISOString()
    })
    .eq('prospect_id', prospect_id)
    .eq('status', 'scheduled');

  console.log(`Prospect ${prospect_id} automatically opted out`);
}

async function triggerMeetingBookingWorkflow(prospect_id: string, execution_id: string) {
  // This would trigger a meeting booking workflow
  // For now, just log - implement based on calendar system
  console.log(`Meeting booking requested for prospect ${prospect_id} from execution ${execution_id}`);
  
  // TODO: Implement actual meeting booking logic
  // - Send calendar link
  // - Create meeting booking record
  // - Notify team
}

async function updateStepAnalytics(execution_id: string, step_number: number, step_type: string, data: any) {
  // Update or create step analytics record
  const analyticsData = {
    execution_id,
    step_number,
    step_type,
    messages_sent: data.messages_sent || 0,
    messages_delivered: data.messages_delivered || 0,
    messages_read: data.messages_read || 0,
    responses_received: data.responses_received || 0,
    positive_responses: data.positive_responses || 0,
    negative_responses: data.negative_responses || 0,
    opt_outs: data.opt_outs || 0,
    calculated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from('sam_funnel_analytics')
    .upsert(analyticsData, {
      onConflict: 'execution_id,step_number'
    });

  if (error) {
    console.error('Failed to update step analytics:', error);
  }
}

async function updateTemplatePerformance(execution_id: string) {
  // This would update the aggregate template performance metrics
  // Complex calculation - implement based on requirements
  console.log(`Updating template performance metrics for execution ${execution_id}`);
  
  // TODO: Implement template performance aggregation
  // - Calculate overall template performance
  // - Update win/loss rates
  // - Identify best performing variations
  // - Update optimization recommendations
}