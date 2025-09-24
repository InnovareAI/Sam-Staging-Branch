import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';

// Import MCP tools for Unipile integration
declare global {
  function mcp__unipile__unipile_get_recent_messages(account_id: string, batch_size?: number): Promise<any>;
}

interface UnipileWebhookPayload {
  object: string;
  type: 'email_received' | 'email_opened' | 'email_clicked' | 'email_replied' | 'email_bounced';
  account_id: string;
  message_id?: string;
  thread_id?: string;
  from: {
    email: string;
    name?: string;
  };
  to: {
    email: string;
    name?: string;
  };
  subject?: string;
  body?: string;
  timestamp: string;
  original_message_id?: string; // For tracking replies to our campaigns
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    
    // Parse webhook payload
    const webhook: UnipileWebhookPayload = await req.json();
    
    console.log('Email webhook received:', {
      type: webhook.type,
      from: webhook.from?.email,
      to: webhook.to?.email,
      subject: webhook.subject,
      message_id: webhook.message_id
    });

    // Handle different webhook types
    switch (webhook.type) {
      case 'email_replied':
        await handleEmailReply(webhook, supabase);
        break;
      case 'email_opened':
        await handleEmailOpened(webhook, supabase);
        break;
      case 'email_clicked':
        await handleEmailClicked(webhook, supabase);
        break;
      case 'email_bounced':
        await handleEmailBounced(webhook, supabase);
        break;
      default:
        console.log(`Unhandled webhook type: ${webhook.type}`);
    }

    return NextResponse.json({ 
      message: 'Webhook processed successfully',
      type: webhook.type 
    });

  } catch (error: any) {
    console.error('Email webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error.message },
      { status: 500 }
    );
  }
}

// Handle email replies - most important for campaign tracking
async function handleEmailReply(webhook: UnipileWebhookPayload, supabase: any) {
  try {
    // Find the original campaign message that this is replying to
    const { data: originalMessage, error: messageError } = await supabase
      .from('campaign_messages')
      .select(`
        id,
        campaign_id,
        prospect_id,
        platform_message_id,
        recipient_email,
        campaigns (
          id,
          workspace_id,
          name
        )
      `)
      .eq('platform', 'email')
      .eq('recipient_email', webhook.from.email)
      .order('sent_at', { ascending: false })
      .limit(1)
      .single();

    if (messageError || !originalMessage) {
      console.log('No matching campaign message found for reply from:', webhook.from.email);
      return;
    }

    // Update campaign prospect status to "replied"
    const { error: updateError } = await supabase.rpc('update_campaign_prospect_status', {
      p_campaign_id: originalMessage.campaign_id,
      p_prospect_id: originalMessage.prospect_id,
      p_status: 'replied',
      p_reply_content: webhook.body || 'Reply received'
    });

    if (updateError) {
      console.error('Failed to update prospect status:', updateError);
    }

    // Create a campaign interaction record
    await supabase
      .from('campaign_interactions')
      .insert({
        campaign_id: originalMessage.campaign_id,
        prospect_id: originalMessage.prospect_id,
        interaction_type: 'email_reply',
        platform: 'email',
        interaction_data: {
          reply_subject: webhook.subject,
          reply_body: webhook.body,
          reply_message_id: webhook.message_id,
          original_message_id: originalMessage.platform_message_id,
          from_email: webhook.from.email,
          from_name: webhook.from.name,
          timestamp: webhook.timestamp
        },
        created_at: new Date().toISOString()
      });

    // For Startup plan users, create HITL approval session for SAM response
    await createHITLApprovalSession({
      workspaceId: originalMessage.campaigns.workspace_id,
      campaignId: originalMessage.campaign_id,
      prospectId: originalMessage.prospect_id,
      originalMessageId: webhook.message_id || 'unknown',
      originalMessageContent: webhook.body || 'Email reply received',
      originalMessageChannel: 'email',
      prospectName: webhook.from.name || webhook.from.email,
      prospectEmail: webhook.from.email,
      context: {
        reply_to_campaign: originalMessage.campaigns.name,
        original_subject: webhook.subject
      }
    }, supabase);

    console.log(`Email reply tracked for campaign ${originalMessage.campaign_id} from ${webhook.from.email}`);

  } catch (error) {
    console.error('Error handling email reply:', error);
  }
}

// Handle email opens
async function handleEmailOpened(webhook: UnipileWebhookPayload, supabase: any) {
  try {
    // Find the campaign message
    const { data: message } = await supabase
      .from('campaign_messages')
      .select('id, campaign_id, prospect_id')
      .eq('platform_message_id', webhook.original_message_id || webhook.message_id)
      .eq('platform', 'email')
      .single();

    if (message) {
      // Update campaign prospect status if still pending
      await supabase.rpc('update_campaign_prospect_status', {
        p_campaign_id: message.campaign_id,
        p_prospect_id: message.prospect_id,
        p_status: 'email_opened'
      });

      // Create interaction record
      await supabase
        .from('campaign_interactions')
        .insert({
          campaign_id: message.campaign_id,
          prospect_id: message.prospect_id,
          interaction_type: 'email_opened',
          platform: 'email',
          interaction_data: {
            opened_at: webhook.timestamp,
            message_id: webhook.message_id
          },
          created_at: new Date().toISOString()
        });

      console.log(`Email opened tracked for campaign ${message.campaign_id}`);
    }
  } catch (error) {
    console.error('Error handling email opened:', error);
  }
}

// Handle email clicks
async function handleEmailClicked(webhook: UnipileWebhookPayload, supabase: any) {
  try {
    // Find the campaign message
    const { data: message } = await supabase
      .from('campaign_messages')
      .select('id, campaign_id, prospect_id')
      .eq('platform_message_id', webhook.original_message_id || webhook.message_id)
      .eq('platform', 'email')
      .single();

    if (message) {
      // Update campaign prospect status
      await supabase.rpc('update_campaign_prospect_status', {
        p_campaign_id: message.campaign_id,
        p_prospect_id: message.prospect_id,
        p_status: 'email_clicked'
      });

      // Create interaction record
      await supabase
        .from('campaign_interactions')
        .insert({
          campaign_id: message.campaign_id,
          prospect_id: message.prospect_id,
          interaction_type: 'email_clicked',
          platform: 'email',
          interaction_data: {
            clicked_at: webhook.timestamp,
            message_id: webhook.message_id
          },
          created_at: new Date().toISOString()
        });

      console.log(`Email click tracked for campaign ${message.campaign_id}`);
    }
  } catch (error) {
    console.error('Error handling email clicked:', error);
  }
}

// Handle email bounces
async function handleEmailBounced(webhook: UnipileWebhookPayload, supabase: any) {
  try {
    // Find the campaign message
    const { data: message } = await supabase
      .from('campaign_messages')
      .select('id, campaign_id, prospect_id')
      .eq('platform_message_id', webhook.original_message_id || webhook.message_id)
      .eq('platform', 'email')
      .single();

    if (message) {
      // Update campaign prospect status to bounced
      await supabase.rpc('update_campaign_prospect_status', {
        p_campaign_id: message.campaign_id,
        p_prospect_id: message.prospect_id,
        p_status: 'email_bounced',
        p_error_message: 'Email bounced - invalid address'
      });

      // Create interaction record
      await supabase
        .from('campaign_interactions')
        .insert({
          campaign_id: message.campaign_id,
          prospect_id: message.prospect_id,
          interaction_type: 'email_bounced',
          platform: 'email',
          interaction_data: {
            bounced_at: webhook.timestamp,
            message_id: webhook.message_id,
            bounce_reason: 'Invalid email address'
          },
          created_at: new Date().toISOString()
        });

      console.log(`Email bounce tracked for campaign ${message.campaign_id}`);
    }
  } catch (error) {
    console.error('Error handling email bounced:', error);
  }
}

// Create HITL approval session for SAM to generate a response
async function createHITLApprovalSession(params: {
  workspaceId: string;
  campaignId: string;
  prospectId: string;
  originalMessageId: string;
  originalMessageContent: string;
  originalMessageChannel: 'email' | 'linkedin';
  prospectName: string;
  prospectEmail?: string;
  context?: any;
}, supabase: any) {
  try {
    // Generate SAM's suggested reply using AI
    const samSuggestedReply = await generateSAMReply({
      originalMessage: params.originalMessageContent,
      prospectName: params.prospectName,
      channel: params.originalMessageChannel,
      context: params.context
    });

    // Get workspace admin email for approval assignment
    const { data: adminUser } = await supabase
      .from('workspace_members')
      .select(`
        user_id,
        users (email, full_name)
      `)
      .eq('workspace_id', params.workspaceId)
      .eq('role', 'admin')
      .single();

    const assignedToEmail = adminUser?.users?.email || 'admin@example.com';

    // Create HITL approval session
    const { error: hitlError } = await supabase
      .from('hitl_reply_approval_sessions')
      .insert({
        workspace_id: params.workspaceId,
        campaign_execution_id: params.campaignId,
        original_message_id: params.originalMessageId,
        original_message_content: params.originalMessageContent,
        original_message_channel: params.originalMessageChannel,
        prospect_name: params.prospectName,
        prospect_email: params.prospectEmail,
        sam_suggested_reply: samSuggestedReply,
        sam_confidence_score: 0.85, // Default confidence for email replies
        sam_reasoning: `Generated response to ${params.originalMessageChannel} reply from ${params.prospectName}`,
        assigned_to_email: assignedToEmail,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        created_at: new Date().toISOString()
      });

    if (hitlError) {
      console.error('Failed to create HITL approval session:', hitlError);
    } else {
      console.log(`HITL approval session created for ${params.prospectName} reply`);
      
      // TODO: Send approval email to assignedToEmail
      // For now, just log the approval needed
      console.log(`🔔 APPROVAL NEEDED: SAM suggested reply to ${params.prospectName}`);
      console.log(`📧 Assigned to: ${assignedToEmail}`);
      console.log(`💬 Suggested reply: ${samSuggestedReply.substring(0, 100)}...`);
    }

  } catch (error) {
    console.error('Error creating HITL approval session:', error);
  }
}

// Generate SAM's suggested reply to prospect responses
async function generateSAMReply(params: {
  originalMessage: string;
  prospectName: string;
  channel: 'email' | 'linkedin';
  context?: any;
}): Promise<string> {
  // This is a simplified version - in production, this would use the actual SAM AI engine
  const channelPrefix = params.channel === 'email' ? 'Email' : 'LinkedIn message';
  
  // Basic contextual responses
  if (params.originalMessage.toLowerCase().includes('not interested')) {
    return `Hi ${params.prospectName},\n\nI completely understand and respect your decision. Thank you for letting me know.\n\nIf circumstances change in the future, please don't hesitate to reach out.\n\nBest regards`;
  }
  
  if (params.originalMessage.toLowerCase().includes('tell me more') || 
      params.originalMessage.toLowerCase().includes('interested')) {
    return `Hi ${params.prospectName},\n\nThank you for your interest! I'd be happy to share more details about how we can help.\n\nWould you be available for a brief 15-minute call this week to discuss your specific needs?\n\nBest regards`;
  }
  
  if (params.originalMessage.toLowerCase().includes('pricing') || 
      params.originalMessage.toLowerCase().includes('cost')) {
    return `Hi ${params.prospectName},\n\nGreat question! Our pricing is based on your specific needs and usage.\n\nI'd love to understand your requirements better and provide a customized proposal. Would you be open to a quick call?\n\nBest regards`;
  }
  
  // Default response
  return `Hi ${params.prospectName},\n\nThank you for your response! I appreciate you taking the time to reply.\n\nI'd love to continue our conversation and learn more about your current challenges. Would you be available for a brief call this week?\n\nBest regards`;
}

// GET endpoint for webhook verification (if needed by Unipile)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const challenge = searchParams.get('challenge');
  
  if (challenge) {
    return NextResponse.json({ challenge });
  }
  
  return NextResponse.json({ 
    message: 'Email webhook endpoint is active',
    supported_events: [
      'email_replied',
      'email_opened', 
      'email_clicked',
      'email_bounced'
    ]
  });
}