import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';

// Unipile webhook event types
interface UnipileWebhook {
  event: 'new_relation' | 'new_message' | 'message_reaction' | 'message_read' | 'message_edited' | 'message_deleted';
  account_id: string;
  account_type: 'LINKEDIN' | 'WHATSAPP' | 'INSTAGRAM' | 'MESSENGER' | 'TELEGRAM' | 'TWITTER';
  account_info: {
    type: string;
    feature: 'classic' | 'sales_navigator' | 'recruiter' | 'organization';
    user_id: string;
  };
  timestamp: string;
  webhook_name: string;
}

interface NewRelationWebhook extends UnipileWebhook {
  event: 'new_relation';
  user_full_name: string;
  user_provider_id: string;
  user_public_identifier: string;
  user_profile_url: string;
  user_picture_url?: string;
}

interface NewMessageWebhook extends UnipileWebhook {
  event: 'new_message';
  chat_id: string;
  message_id: string;
  message: string;
  sender: {
    attendee_id: string;
    attendee_name: string;
    attendee_provider_id: string;
    attendee_profile_url: string;
  };
  attendees: Array<{
    attendee_id: string;
    attendee_name: string;
    attendee_provider_id: string;
    attendee_profile_url: string;
  }>;
  attachments?: any;
}

export async function POST(req: NextRequest) {
  try {
    const webhook: UnipileWebhook = await req.json();
    
    console.log('Received Unipile webhook:', {
      event: webhook.event,
      account_id: webhook.account_id,
      account_type: webhook.account_type,
      timestamp: webhook.timestamp
    });

    // Verify webhook is from LinkedIn
    if (webhook.account_type !== 'LINKEDIN') {
      return NextResponse.json({ message: 'Non-LinkedIn webhook ignored' });
    }

    // Handle different webhook events
    switch (webhook.event) {
      case 'new_relation':
        await handleNewRelation(webhook as NewRelationWebhook, supabase);
        break;
        
      case 'new_message':
        await handleNewMessage(webhook as NewMessageWebhook, supabase);
        break;
        
      default:
        console.log(`Unhandled webhook event: ${webhook.event}`);
    }

    return NextResponse.json({ message: 'Webhook processed successfully' });

  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error.message },
      { status: 500 }
    );
  }
}

// Handle new LinkedIn connection acceptance
async function handleNewRelation(webhook: NewRelationWebhook, supabase: any) {
  try {
    console.log('Processing new LinkedIn connection:', {
      user_name: webhook.user_full_name,
      user_id: webhook.user_provider_id,
      account_id: webhook.account_id
    });

    // Find the campaign prospect that matches this LinkedIn user
    const { data: prospect, error: prospectError } = await supabase
      .from('campaign_prospects')
      .select(`
        *,
        campaigns (
          id,
          name,
          workspace_id,
          follow_up_templates,
          linkedin_account_id
        )
      `)
      .eq('linkedin_user_id', webhook.user_provider_id)
      .eq('status', 'invitation_sent')
      .single();

    if (prospectError || !prospect) {
      console.log('No matching campaign prospect found for user:', webhook.user_provider_id);
      return;
    }

    // Update prospect status to connected
    await supabase
      .from('campaign_prospects')
      .update({
        status: 'connected',
        connected_at: webhook.timestamp,
        linkedin_profile_url: webhook.user_profile_url,
        updated_at: new Date().toISOString()
      })
      .eq('id', prospect.id);

    // Log the connection event
    await supabase.from('campaign_actions').insert({
      campaign_id: prospect.campaigns.id,
      prospect_id: prospect.id,
      action_type: 'invitation_accepted',
      unipile_user_id: webhook.user_provider_id,
      metadata: {
        user_full_name: webhook.user_full_name,
        user_profile_url: webhook.user_profile_url,
        user_public_identifier: webhook.user_public_identifier
      },
      created_at: webhook.timestamp
    });

    // Update campaign statistics
    await supabase.rpc('increment_campaign_connections', {
      campaign_id: prospect.campaigns.id
    });

    // Schedule follow-up messages if configured
    if (prospect.campaigns.follow_up_templates && prospect.campaigns.follow_up_templates.length > 0) {
      await scheduleFollowUpSequence(
        prospect,
        webhook.user_provider_id,
        webhook.account_id,
        supabase
      );
    }

    console.log('Successfully processed new LinkedIn connection for prospect:', prospect.id);

  } catch (error: any) {
    console.error('Error handling new relation webhook:', error);
    throw error;
  }
}

// Handle new LinkedIn message
async function handleNewMessage(webhook: NewMessageWebhook, supabase: any) {
  try {
    // Skip messages sent by us
    if (webhook.sender.attendee_provider_id === webhook.account_info.user_id) {
      return;
    }

    console.log('Processing new LinkedIn message:', {
      sender_name: webhook.sender.attendee_name,
      sender_id: webhook.sender.attendee_provider_id,
      message_preview: webhook.message.substring(0, 100),
      chat_id: webhook.chat_id
    });

    // Find campaign prospect
    const { data: prospect } = await supabase
      .from('campaign_prospects')
      .select(`
        *,
        campaigns (
          id,
          name,
          workspace_id,
          linkedin_account_id
        )
      `)
      .eq('linkedin_user_id', webhook.sender.attendee_provider_id)
      .single();

    // Log the message event
    await supabase.from('campaign_actions').insert({
      campaign_id: prospect?.campaigns?.id,
      prospect_id: prospect?.id,
      action_type: 'message_received',
      message: webhook.message,
      unipile_chat_id: webhook.chat_id,
      unipile_message_id: webhook.message_id,
      metadata: {
        sender: webhook.sender,
        attendees: webhook.attendees,
        attachments: webhook.attachments
      },
      created_at: webhook.timestamp
    });

    // Update prospect status if this is their first message
    if (prospect && prospect.status === 'connected') {
      await supabase
        .from('campaign_prospects')
        .update({
          status: 'responded',
          first_response_at: webhook.timestamp,
          updated_at: new Date().toISOString()
        })
        .eq('id', prospect.id);
    }

    // TODO: Integrate with SAM AI for response generation
    // This would trigger the HITL approval system for response quality control
    await generateSAMResponse(webhook, prospect, supabase);

    console.log('Successfully processed new LinkedIn message');

  } catch (error: any) {
    console.error('Error handling new message webhook:', error);
    throw error;
  }
}

// Schedule follow-up message sequence
async function scheduleFollowUpSequence(
  prospect: any,
  linkedinUserId: string,
  accountId: string,
  supabase: any
) {
  try {
    const followUpTemplates = prospect.campaigns.follow_up_templates;
    
    for (let i = 0; i < followUpTemplates.length; i++) {
      const template = followUpTemplates[i];
      const delayHours = template.delay_hours || (24 * (i + 1)); // Default 24h between messages
      
      // Schedule follow-up message
      await supabase.from('scheduled_messages').insert({
        campaign_id: prospect.campaigns.id,
        prospect_id: prospect.id,
        template_index: i,
        linkedin_user_id: linkedinUserId,
        linkedin_account_id: accountId,
        message_template: template.message,
        scheduled_for: new Date(Date.now() + delayHours * 60 * 60 * 1000).toISOString(),
        status: 'scheduled',
        created_at: new Date().toISOString()
      });
    }

    console.log(`Scheduled ${followUpTemplates.length} follow-up messages for prospect:`, prospect.id);

  } catch (error: any) {
    console.error('Error scheduling follow-up sequence:', error);
    throw error;
  }
}

// Generate SAM AI response using MCP for message context
async function generateSAMResponse(
  webhook: NewMessageWebhook,
  prospect: any,
  supabase: any
) {
  try {
    if (!prospect) return;

    // Use MCP to get conversation context for better SAM responses
    const recentMessages = await mcp__unipile__unipile_get_recent_messages({
      account_id: webhook.account_id,
      batch_size: 10
    });

    // Filter messages from this specific conversation
    const conversationHistory = recentMessages.filter(msg => 
      msg.chat_info?.id === webhook.chat_id
    ).slice(0, 5); // Last 5 messages for context

    // Enhanced context for SAM AI
    const conversationContext = {
      prospect_info: {
        name: prospect.first_name + ' ' + prospect.last_name,
        company: prospect.company_name,
        job_title: prospect.job_title,
        industry: prospect.industry
      },
      conversation_history: conversationHistory.map(msg => ({
        timestamp: msg.timestamp,
        sender_id: msg.sender_id,
        text: msg.text,
        is_from_prospect: msg.sender_id === webhook.sender.attendee_provider_id
      })),
      campaign_context: {
        campaign_name: prospect.campaigns.name,
        campaign_type: 'linkedin_connector',
        follow_up_stage: conversationHistory.length
      }
    };

    // Queue with enhanced context for SAM AI
    await supabase.from('sam_response_queue').insert({
      campaign_id: prospect.campaigns.id,
      prospect_id: prospect.id,
      original_message: webhook.message,
      chat_id: webhook.chat_id,
      sender_info: webhook.sender,
      conversation_context: conversationContext,
      account_type: webhook.account_type,
      account_features: webhook.account_info.feature,
      status: 'pending_sam_analysis',
      created_at: webhook.timestamp
    });

    console.log('Queued message with enhanced context for SAM AI response generation');

  } catch (error: any) {
    console.error('Error generating SAM response:', error);
    
    // Fallback to basic queuing if MCP fails
    await supabase.from('sam_response_queue').insert({
      campaign_id: prospect?.campaigns?.id,
      prospect_id: prospect?.id,
      original_message: webhook.message,
      chat_id: webhook.chat_id,
      sender_info: webhook.sender,
      status: 'pending_review',
      error_context: error.message,
      created_at: webhook.timestamp
    });
  }
}

// Verify webhook signature (optional security measure)
function verifyWebhookSignature(payload: string, signature: string): boolean {
  // TODO: Implement webhook signature verification if Unipile provides this
  // This would verify the webhook is actually from Unipile
  return true;
}