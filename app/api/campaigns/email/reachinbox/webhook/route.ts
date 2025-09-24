import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';

// ReachInbox webhook event types
interface ReachInboxWebhook {
  event_type: 'email_sent' | 'email_opened' | 'email_clicked' | 'email_replied' | 'email_bounced' | 'unsubscribed';
  campaign_id: string;
  workspace_id: string;
  message_id: string;
  prospect_id?: string;
  account_id: string;
  account_email: string;
  timestamp: string;
  data: {
    // For email_sent
    recipient_email?: string;
    subject?: string;
    sent_at?: string;
    
    // For email_opened  
    opened_at?: string;
    user_agent?: string;
    location?: string;
    
    // For email_clicked
    clicked_at?: string;
    clicked_url?: string;
    
    // For email_replied
    reply_subject?: string;
    reply_body?: string;
    reply_from_email?: string;
    reply_from_name?: string;
    reply_at?: string;
    
    // For email_bounced
    bounce_type?: 'hard' | 'soft';
    bounce_reason?: string;
    bounced_at?: string;
    
    // For unsubscribed
    unsubscribed_at?: string;
    unsubscribe_method?: 'link' | 'reply';
  };
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    
    // Verify webhook signature if configured
    const signature = req.headers.get('x-reachinbox-signature');
    if (process.env.REACHINBOX_WEBHOOK_SECRET && signature) {
      // TODO: Implement signature verification
      console.log('Webhook signature verification not implemented');
    }
    
    const webhook: ReachInboxWebhook = await req.json();
    
    console.log('ReachInbox webhook received:', {
      event_type: webhook.event_type,
      campaign_id: webhook.campaign_id,
      account_email: webhook.account_email,
      timestamp: webhook.timestamp
    });

    // Handle different webhook events
    switch (webhook.event_type) {
      case 'email_sent':
        await handleEmailSent(webhook, supabase);
        break;
      case 'email_opened':
        await handleEmailOpened(webhook, supabase);
        break;
      case 'email_clicked':
        await handleEmailClicked(webhook, supabase);
        break;
      case 'email_replied':
        await handleEmailReplied(webhook, supabase);
        break;
      case 'email_bounced':
        await handleEmailBounced(webhook, supabase);
        break;
      case 'unsubscribed':
        await handleUnsubscribed(webhook, supabase);
        break;
      default:
        console.log(`Unhandled ReachInbox webhook event: ${webhook.event_type}`);
    }

    return NextResponse.json({ 
      message: 'Webhook processed successfully',
      event_type: webhook.event_type,
      campaign_id: webhook.campaign_id
    });

  } catch (error: any) {
    console.error('ReachInbox webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error.message },
      { status: 500 }
    );
  }
}

// Handle email sent confirmation
async function handleEmailSent(webhook: ReachInboxWebhook, supabase: any) {
  try {
    const { data } = webhook;
    
    // Find the campaign prospect by email
    const { data: campaignProspect } = await supabase
      .from('campaign_prospects')
      .select(`
        id,
        prospect_id,
        workspace_prospects (
          id,
          email_address
        )
      `)
      .eq('campaign_id', webhook.campaign_id.replace('SAM AI Campaign ', ''))
      .eq('workspace_prospects.email_address', data.recipient_email)
      .single();

    if (campaignProspect) {
      // Update prospect status
      await supabase.rpc('update_campaign_prospect_status', {
        p_campaign_id: webhook.campaign_id.replace('SAM AI Campaign ', ''),
        p_prospect_id: campaignProspect.prospect_id,
        p_status: 'email_sent',
        p_email_message_id: webhook.message_id
      });

      // Track campaign message
      await supabase
        .from('campaign_messages')
        .insert({
          campaign_id: webhook.campaign_id.replace('SAM AI Campaign ', ''),
          prospect_id: campaignProspect.prospect_id,
          platform: 'email',
          platform_message_id: webhook.message_id,
          message_content: `Subject: ${data.subject || 'N/A'}`,
          recipient_email: data.recipient_email,
          sender_account: webhook.account_email,
          sent_at: data.sent_at || webhook.timestamp,
          created_at: new Date().toISOString()
        });

      // Update campaign stats
      await supabase.rpc('increment_campaign_stat', {
        p_campaign_id: webhook.campaign_id.replace('SAM AI Campaign ', ''),
        p_stat_name: 'emails_sent'
      });

      console.log(`Email sent tracked: ${data.recipient_email} via ${webhook.account_email}`);
    }

  } catch (error) {
    console.error('Error handling email sent:', error);
  }
}

// Handle email opened
async function handleEmailOpened(webhook: ReachInboxWebhook, supabase: any) {
  try {
    // Find campaign message
    const { data: message } = await supabase
      .from('campaign_messages')
      .select('id, campaign_id, prospect_id')
      .eq('platform_message_id', webhook.message_id)
      .eq('platform', 'email')
      .single();

    if (message) {
      // Update prospect status if still at email_sent
      const { data: prospect } = await supabase
        .from('campaign_prospects')
        .select('status')
        .eq('campaign_id', message.campaign_id)
        .eq('prospect_id', message.prospect_id)
        .single();

      if (prospect?.status === 'email_sent') {
        await supabase.rpc('update_campaign_prospect_status', {
          p_campaign_id: message.campaign_id,
          p_prospect_id: message.prospect_id,
          p_status: 'email_opened'
        });
      }

      // Create interaction record
      await supabase
        .from('campaign_interactions')
        .insert({
          campaign_id: message.campaign_id,
          prospect_id: message.prospect_id,
          interaction_type: 'email_opened',
          platform: 'email',
          interaction_data: {
            opened_at: webhook.data.opened_at || webhook.timestamp,
            user_agent: webhook.data.user_agent,
            location: webhook.data.location,
            message_id: webhook.message_id
          },
          created_at: new Date().toISOString()
        });

      // Update campaign stats
      await supabase.rpc('increment_campaign_stat', {
        p_campaign_id: message.campaign_id,
        p_stat_name: 'emails_opened'
      });

      console.log(`Email opened tracked for campaign ${message.campaign_id}`);
    }

  } catch (error) {
    console.error('Error handling email opened:', error);
  }
}

// Handle email clicked
async function handleEmailClicked(webhook: ReachInboxWebhook, supabase: any) {
  try {
    const { data: message } = await supabase
      .from('campaign_messages')
      .select('id, campaign_id, prospect_id')
      .eq('platform_message_id', webhook.message_id)
      .eq('platform', 'email')
      .single();

    if (message) {
      // Update prospect status
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
            clicked_at: webhook.data.clicked_at || webhook.timestamp,
            clicked_url: webhook.data.clicked_url,
            message_id: webhook.message_id
          },
          created_at: new Date().toISOString()
        });

      // Update campaign stats
      await supabase.rpc('increment_campaign_stat', {
        p_campaign_id: message.campaign_id,
        p_stat_name: 'emails_clicked'
      });

      console.log(`Email click tracked for campaign ${message.campaign_id}`);
    }

  } catch (error) {
    console.error('Error handling email clicked:', error);
  }
}

// Handle email replied - MOST IMPORTANT for campaign success
async function handleEmailReplied(webhook: ReachInboxWebhook, supabase: any) {
  try {
    const { data } = webhook;
    
    // Find campaign message
    const { data: message } = await supabase
      .from('campaign_messages')
      .select(`
        id,
        campaign_id,
        prospect_id,
        recipient_email,
        campaigns (
          id,
          workspace_id,
          name
        )
      `)
      .eq('platform_message_id', webhook.message_id)
      .eq('platform', 'email')
      .single();

    if (message) {
      // Update prospect status to replied
      await supabase.rpc('update_campaign_prospect_status', {
        p_campaign_id: message.campaign_id,
        p_prospect_id: message.prospect_id,
        p_status: 'replied',
        p_reply_content: data.reply_body || 'Email reply received'
      });

      // Create interaction record
      await supabase
        .from('campaign_interactions')
        .insert({
          campaign_id: message.campaign_id,
          prospect_id: message.prospect_id,
          interaction_type: 'email_reply',
          platform: 'email',
          interaction_data: {
            reply_subject: data.reply_subject,
            reply_body: data.reply_body,
            reply_from_email: data.reply_from_email,
            reply_from_name: data.reply_from_name,
            reply_at: data.reply_at || webhook.timestamp,
            original_message_id: webhook.message_id
          },
          created_at: new Date().toISOString()
        });

      // Update campaign stats
      await supabase.rpc('increment_campaign_stat', {
        p_campaign_id: message.campaign_id,
        p_stat_name: 'emails_replied'
      });

      // Create HITL approval session for SAM response
      await createHITLApprovalSession({
        workspaceId: message.campaigns.workspace_id,
        campaignId: message.campaign_id,
        prospectId: message.prospect_id,
        originalMessageId: webhook.message_id,
        originalMessageContent: data.reply_body || 'Email reply received',
        originalMessageChannel: 'email',
        prospectName: data.reply_from_name || data.reply_from_email,
        prospectEmail: data.reply_from_email,
        context: {
          reply_to_campaign: message.campaigns.name,
          original_subject: data.reply_subject,
          via_reachinbox: true,
          account_used: webhook.account_email
        }
      }, supabase);

      console.log(`Email reply tracked and HITL session created for campaign ${message.campaign_id}`);
    }

  } catch (error) {
    console.error('Error handling email replied:', error);
  }
}

// Handle email bounced
async function handleEmailBounced(webhook: ReachInboxWebhook, supabase: any) {
  try {
    const { data } = webhook;
    
    const { data: message } = await supabase
      .from('campaign_messages')
      .select('id, campaign_id, prospect_id')
      .eq('platform_message_id', webhook.message_id)
      .eq('platform', 'email')
      .single();

    if (message) {
      // Update prospect status
      await supabase.rpc('update_campaign_prospect_status', {
        p_campaign_id: message.campaign_id,
        p_prospect_id: message.prospect_id,
        p_status: 'email_bounced',
        p_error_message: `${data.bounce_type} bounce: ${data.bounce_reason}`
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
            bounce_type: data.bounce_type,
            bounce_reason: data.bounce_reason,
            bounced_at: data.bounced_at || webhook.timestamp,
            message_id: webhook.message_id
          },
          created_at: new Date().toISOString()
        });

      // Update campaign stats
      await supabase.rpc('increment_campaign_stat', {
        p_campaign_id: message.campaign_id,
        p_stat_name: 'emails_bounced'
      });

      console.log(`Email bounce tracked: ${data.bounce_type} - ${data.bounce_reason}`);
    }

  } catch (error) {
    console.error('Error handling email bounced:', error);
  }
}

// Handle unsubscribed
async function handleUnsubscribed(webhook: ReachInboxWebhook, supabase: any) {
  try {
    const { data } = webhook;
    
    // Find campaign message (may not exist for global unsubscribes)
    const { data: message } = await supabase
      .from('campaign_messages')
      .select('id, campaign_id, prospect_id, recipient_email')
      .eq('platform_message_id', webhook.message_id)
      .eq('platform', 'email')
      .single();

    if (message) {
      // Update prospect status
      await supabase.rpc('update_campaign_prospect_status', {
        p_campaign_id: message.campaign_id,
        p_prospect_id: message.prospect_id,
        p_status: 'unsubscribed'
      });

      // Create interaction record
      await supabase
        .from('campaign_interactions')
        .insert({
          campaign_id: message.campaign_id,
          prospect_id: message.prospect_id,
          interaction_type: 'unsubscribed',
          platform: 'email',
          interaction_data: {
            unsubscribed_at: data.unsubscribed_at || webhook.timestamp,
            unsubscribe_method: data.unsubscribe_method,
            message_id: webhook.message_id
          },
          created_at: new Date().toISOString()
        });

      // Add to global suppression list
      await supabase
        .from('email_suppressions')
        .upsert({
          email: message.recipient_email,
          reason: 'unsubscribed',
          source: 'reachinbox',
          created_at: new Date().toISOString()
        }, { onConflict: 'email' });

      console.log(`Unsubscribe tracked and added to suppression list: ${message.recipient_email}`);
    }

  } catch (error) {
    console.error('Error handling unsubscribed:', error);
  }
}

// Create HITL approval session for SAM to respond to replies
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
    // Generate SAM's suggested reply
    const samSuggestedReply = await generateSAMReply({
      originalMessage: params.originalMessageContent,
      prospectName: params.prospectName,
      channel: params.originalMessageChannel,
      context: params.context
    });

    // Get workspace admin for approval assignment
    const { data: adminUser } = await supabase
      .from('workspace_members')
      .select(`
        user_id,
        users (email, full_name)
      `)
      .eq('workspace_id', params.workspaceId)
      .in('role', ['owner', 'admin'])
      .single();

    const assignedToEmail = adminUser?.users?.email || 'admin@innovareai.com';

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
        sam_confidence_score: 0.85,
        sam_reasoning: `Generated response to ReachInbox ${params.originalMessageChannel} reply from ${params.prospectName}`,
        assigned_to_email: assignedToEmail,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        created_at: new Date().toISOString()
      });

    if (hitlError) {
      console.error('Failed to create HITL approval session:', hitlError);
    } else {
      console.log(`🔔 HITL approval session created for ${params.prospectName} reply via ReachInbox`);
      console.log(`📧 Assigned to: ${assignedToEmail}`);
      console.log(`💬 Suggested reply: ${samSuggestedReply.substring(0, 100)}...`);
    }

  } catch (error) {
    console.error('Error creating HITL approval session:', error);
  }
}

// Generate SAM's suggested reply (enhanced for ReachInbox context)
async function generateSAMReply(params: {
  originalMessage: string;
  prospectName: string;
  channel: 'email' | 'linkedin';
  context?: any;
}): Promise<string> {
  const message = params.originalMessage.toLowerCase();
  const isViaReachInbox = params.context?.via_reachinbox;
  const accountUsed = params.context?.account_used;
  
  // Enhanced contextual responses for ReachInbox campaigns
  if (message.includes('not interested') || message.includes('no thank') || message.includes('remove')) {
    return `Hi ${params.prospectName},\n\nI completely understand and respect your decision. Thank you for taking the time to let me know.\n\nYou've been removed from our outreach list, and you won't receive any further emails from us.\n\nIf circumstances change in the future, please feel free to reach out.\n\nBest regards`;
  }
  
  if (message.includes('tell me more') || message.includes('interested') || message.includes('learn more')) {
    return `Hi ${params.prospectName},\n\nThank you for your interest! I'm excited to share more details about how we can help.\n\nWould you be available for a brief 15-minute call this week to discuss your specific needs and see if there's a good fit?\n\nI have availability on [DAY] at [TIME] or [DAY] at [TIME] - does either work for you?\n\nBest regards`;
  }
  
  if (message.includes('pricing') || message.includes('cost') || message.includes('price') || message.includes('budget')) {
    return `Hi ${params.prospectName},\n\nGreat question! Our pricing is customized based on your specific needs and usage requirements.\n\nI'd love to understand your current challenges and goals better so I can provide you with accurate pricing information that makes sense for your situation.\n\nWould you be open to a quick 15-minute call to discuss your requirements?\n\nBest regards`;
  }
  
  if (message.includes('busy') || message.includes('swamped') || message.includes('later')) {
    return `Hi ${params.prospectName},\n\nI completely understand - we're all juggling a lot these days!\n\nNo pressure at all. I'll follow up in a few weeks when things might be less hectic.\n\nIn the meantime, if anything changes or if you'd like to chat sooner, just let me know.\n\nBest regards`;
  }
  
  if (message.includes('wrong person') || message.includes('not the right') || message.includes('different department')) {
    return `Hi ${params.prospectName},\n\nThanks for letting me know! I appreciate you taking the time to respond.\n\nWould you mind pointing me in the right direction? Who would be the best person to speak with about [TOPIC]?\n\nAny introduction or contact information would be incredibly helpful.\n\nThanks again!\n\nBest regards`;
  }
  
  // Default professional response for ReachInbox
  return `Hi ${params.prospectName},\n\nThank you for your response! I appreciate you taking the time to get back to me.\n\nI'd love to continue our conversation and learn more about your current challenges and goals.\n\nWould you be available for a brief 15-minute call this week? I'm happy to work around your schedule.\n\nBest regards`;
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
      'email_sent',
      'email_opened', 
      'email_clicked',
      'email_replied',
      'email_bounced',
      'unsubscribed'
    ],
    integration: 'SAM AI ReachInbox Integration',
    tier_requirement: 'SME or Enterprise plan'
  });
}