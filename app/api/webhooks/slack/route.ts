import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';
import { slackService } from '@/lib/slack';
import crypto from 'crypto';

/**
 * Slack Webhook Endpoint
 * Handles:
 * - URL verification challenges
 * - Slash commands (/sam-status, /sam-campaigns, /sam-ask)
 * - Interactive components (button clicks for approve/reject)
 * - Event callbacks (messages, app_mentions)
 */

// ============================================================================
// SIGNATURE VERIFICATION
// ============================================================================

function verifySlackSignature(
  signature: string | null,
  timestamp: string | null,
  body: string
): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  // Skip verification if signing secret not configured (dev mode)
  if (!signingSecret) {
    console.warn('[Slack] SLACK_SIGNING_SECRET not configured - skipping signature verification');
    return true;
  }

  if (!signature || !timestamp) {
    console.error('[Slack] Missing signature or timestamp headers');
    return false;
  }

  // Check timestamp to prevent replay attacks (5 min window)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    console.error('[Slack] Request timestamp too old');
    return false;
  }

  // Compute expected signature
  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature = 'v0=' + crypto
    .createHmac('sha256', signingSecret)
    .update(sigBasestring, 'utf8')
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(mySignature, 'utf8'),
      Buffer.from(signature, 'utf8')
    );
  } catch {
    return false;
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    const signature = request.headers.get('x-slack-signature');
    const timestamp = request.headers.get('x-slack-request-timestamp');
    const rawBody = await request.text();

    // Verify Slack signature (security check)
    if (!verifySlackSignature(signature, timestamp, rawBody)) {
      console.error('[Slack] Invalid signature - rejecting request');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let body: any;

    // Parse based on content type
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = new URLSearchParams(rawBody);
      body = Object.fromEntries(formData);
      // Handle Slack interactive payloads (they come as form-encoded with a payload field)
      if (body.payload) {
        body = JSON.parse(body.payload);
      }
    } else {
      body = JSON.parse(rawBody);
    }

    // ==========================================================================
    // URL VERIFICATION (Required for Events API setup)
    // ==========================================================================
    if (body.type === 'url_verification') {
      console.log('[Slack] URL verification challenge received');
      return NextResponse.json({ challenge: body.challenge });
    }

    // ==========================================================================
    // SLASH COMMANDS
    // ==========================================================================
    if (body.command) {
      return handleSlashCommand(body);
    }

    // ==========================================================================
    // INTERACTIVE COMPONENTS (Button clicks, etc.)
    // ==========================================================================
    if (body.type === 'block_actions') {
      return handleBlockActions(body);
    }

    // ==========================================================================
    // EVENT CALLBACKS (Messages, app_mentions, etc.)
    // ==========================================================================
    if (body.type === 'event_callback') {
      // Immediately respond with 200 to prevent retries
      // Process event async
      processEventAsync(body).catch(err => console.error('[Slack] Event processing error:', err));
      return NextResponse.json({ ok: true });
    }

    // Unknown request type
    console.log('[Slack] Unknown request type:', body.type || 'no type');
    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error('[Slack] Webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'active',
    version: '2.0',
    features: ['slash_commands', 'interactive_buttons', 'event_callbacks', 'two_way_messaging'],
  });
}

// ============================================================================
// SLASH COMMAND HANDLER
// ============================================================================

async function handleSlashCommand(body: any): Promise<NextResponse> {
  const command = body.command;
  const text = body.text || '';
  const userId = body.user_id;
  const teamId = body.team_id;
  const channelId = body.channel_id;

  console.log(`[Slack] Slash command: ${command} "${text}" from ${userId}`);

  // Handle /sam-help immediately without DB lookup (for speed)
  if (command === '/sam-help') {
    return NextResponse.json({
      response_type: 'ephemeral',
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: '🤖 SAM AI Assistant', emoji: true } },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Slash Commands:*\n' +
              '`/sam-status` - Check SAM connection status\n' +
              '`/sam-campaigns` - View active campaigns\n' +
              '`/sam-ask [question]` - Ask SAM anything\n' +
              '`/sam-help` - Show this help message',
          },
        },
        { type: 'divider' },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*🚀 Interactive Wizards (DM @SAM or use /sam-ask):*\n' +
              '`set up my ICP` - Define your Ideal Customer Profile step-by-step\n' +
              '`search` or `find CTOs in Berlin` - Search LinkedIn for prospects\n' +
              '`create campaign` - Full campaign wizard with AI message drafting\n\n' +
              '_These are multi-turn conversations - SAM will guide you through each step!_',
          },
        },
        { type: 'divider' },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*⚡ Quick Commands:*\n' +
              '`show messages for [campaign]` - View message sequence\n' +
              '`pause campaign [name]` - Pause a campaign\n' +
              '`resume campaign [name]` - Resume a campaign\n' +
              '`show stats for [campaign]` - View campaign stats\n' +
              '`show prospects` - List prospects by status',
          },
        },
        { type: 'divider' },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*📊 Notifications & Actions:*\n' +
              '• Reply notifications with Approve/Edit/Reject buttons\n' +
              '• Connection acceptance alerts\n' +
              '• Daily campaign digest\n' +
              '• React with ✅ or ❌ to approve/reject',
          },
        },
      ],
    });
  }

  // Find workspace by Slack team ID (for commands that need it)
  const workspace = await findWorkspaceBySlackTeam(teamId);

  switch (command) {
    case '/sam-status':
      return NextResponse.json({
        response_type: 'ephemeral',
        blocks: [
          { type: 'header', text: { type: 'plain_text', text: 'SAM Status', emoji: true } },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: workspace
                ? `*Connected to workspace:* ${workspace.name}\n*Status:* Running\n*Dashboard:* <https://app.meet-sam.com/workspace/${workspace.id}|Open Dashboard>`
                : '*Status:* Running\n*Dashboard:* <https://app.meet-sam.com|Open Dashboard>',
            },
          },
        ],
      });

    case '/sam-campaigns':
      if (!workspace) {
        return NextResponse.json({
          response_type: 'ephemeral',
          text: 'Slack is not connected to a SAM workspace. Please configure the integration first.',
        });
      }

      const campaigns = await getActiveCampaigns(workspace.id);
      const campaignList = campaigns.length > 0
        ? campaigns.map(c => `- *${c.name}*: ${c.status} (${c.prospect_count} prospects)`).join('\n')
        : 'No active campaigns';

      return NextResponse.json({
        response_type: 'ephemeral',
        blocks: [
          { type: 'header', text: { type: 'plain_text', text: 'Active Campaigns', emoji: true } },
          { type: 'section', text: { type: 'mrkdwn', text: campaignList } },
          {
            type: 'actions',
            elements: [{
              type: 'button',
              text: { type: 'plain_text', text: 'View All Campaigns', emoji: true },
              url: `https://app.meet-sam.com/workspace/${workspace.id}/campaign-hub`,
            }],
          },
        ],
      });

    case '/sam-ask':
      if (!text.trim()) {
        return NextResponse.json({
          response_type: 'ephemeral',
          text: 'Usage: `/sam-ask [your question]`\nExample: `/sam-ask What campaigns are running today?`',
        });
      }

      if (!workspace) {
        return NextResponse.json({
          response_type: 'ephemeral',
          text: 'Slack is not connected to a SAM workspace. Please configure the integration first.',
        });
      }

      // Queue the question for SAM AI processing
      await queueSlackQuestion(workspace.id, channelId, userId, text);

      return NextResponse.json({
        response_type: 'in_channel',
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `<@${userId}> asked: _${text}_` },
          },
          {
            type: 'context',
            elements: [{ type: 'mrkdwn', text: 'SAM is thinking... Reply will appear in this thread.' }],
          },
        ],
      });

    default:
      return NextResponse.json({
        response_type: 'ephemeral',
        text: `Unknown command: ${command}. Type \`/sam-help\` for available commands.`,
      });
  }
}

// ============================================================================
// INTERACTIVE BUTTON HANDLER
// ============================================================================

async function handleBlockActions(body: any): Promise<NextResponse> {
  const actions = body.actions || [];
  const user = body.user;
  const channel = body.channel;
  const message = body.message;
  const teamId = body.team?.id;

  console.log(`[Slack] Block action from ${user?.id}:`, actions.map((a: any) => a.action_id));

  const workspace = await findWorkspaceBySlackTeam(teamId);
  if (!workspace) {
    return NextResponse.json({
      response_type: 'ephemeral',
      text: 'Error: Slack workspace not connected to SAM.',
    });
  }

  for (const action of actions) {
    const actionId = action.action_id;
    const value = action.value;

    switch (actionId) {
      // ========== START MENU ACTIONS ==========
      case 'start_icp_setup':
        await triggerFlow(workspace.id, channel.id, user.id, 'set up my ICP');
        break;

      case 'start_search':
        await triggerFlow(workspace.id, channel.id, user.id, 'search for prospects');
        break;

      case 'start_campaign':
        await triggerFlow(workspace.id, channel.id, user.id, 'create campaign');
        break;

      case 'view_campaign_status':
        await triggerFlow(workspace.id, channel.id, user.id, 'show campaigns');
        break;

      case 'start_analyze':
        await triggerFlow(workspace.id, channel.id, user.id, 'analyze performance');
        break;

      case 'analyze_messages':
        await triggerFlow(workspace.id, channel.id, user.id, 'analyze messages');
        break;

      case 'analyze_timing':
        await triggerFlow(workspace.id, channel.id, user.id, 'analyze timing');
        break;

      case 'analyze_segments':
        await triggerFlow(workspace.id, channel.id, user.id, 'analyze segments');
        break;

      case 'get_recommendations':
        await triggerFlow(workspace.id, channel.id, user.id, 'give me strategy recommendations');
        break;

      // ========== ICP SETUP ACTIONS ==========
      case 'icp_size_1_50':
      case 'icp_size_51_200':
      case 'icp_size_201_500':
      case 'icp_size_500_plus':
        await triggerFlow(workspace.id, channel.id, user.id, value);
        break;

      // ========== SEARCH ACTIONS ==========
      case 'search_from_icp':
        await triggerFlow(workspace.id, channel.id, user.id, 'search');
        break;

      case 'add_to_campaign':
        await triggerFlow(workspace.id, channel.id, user.id, 'add to campaign');
        break;

      case 'quick_campaign':
        await triggerFlow(workspace.id, channel.id, user.id, 'create quick campaign');
        break;

      // ========== CAMPAIGN CREATION ACTIONS ==========
      case 'channel_linkedin':
      case 'channel_email':
      case 'channel_both':
        await triggerFlow(workspace.id, channel.id, user.id, value);
        break;

      case 'target_icp':
        await triggerFlow(workspace.id, channel.id, user.id, 'use my ICP');
        break;

      case 'target_search':
        await triggerFlow(workspace.id, channel.id, user.id, 'search');
        break;

      case 'use_all_prospects':
        await triggerFlow(workspace.id, channel.id, user.id, `use all ${value}`);
        break;

      case 'draft_cr':
      case 'draft_fu':
        await triggerFlow(workspace.id, channel.id, user.id, 'yes, draft it');
        break;

      case 'use_draft_cr':
      case 'use_draft_fu':
        await triggerFlow(workspace.id, channel.id, user.id, 'use this');
        break;

      case 'skip_fu':
        await triggerFlow(workspace.id, channel.id, user.id, 'skip');
        break;

      case 'schedule_aggressive':
        await triggerFlow(workspace.id, channel.id, user.id, 'aggressive');
        break;

      case 'schedule_normal':
        await triggerFlow(workspace.id, channel.id, user.id, 'normal');
        break;

      case 'schedule_conservative':
        await triggerFlow(workspace.id, channel.id, user.id, 'conservative');
        break;

      // ========== EXISTING ACTIONS ==========
      case 'approve_comment':
        await handleApproveComment(workspace.id, value, user.id, channel.id, message.ts);
        break;

      case 'reject_comment':
        await handleRejectComment(workspace.id, value, user.id, channel.id, message.ts);
        break;

      case 'approve_followup':
        await handleApproveFollowUp(workspace.id, value, user.id, channel.id, message.ts);
        break;

      case 'reject_followup':
        await handleRejectFollowUp(workspace.id, value, user.id, channel.id, message.ts);
        break;

      case 'mark_hot_lead':
        await handleMarkHotLead(workspace.id, value, user.id, channel.id, message.ts);
        break;

      case 'archive_conversation':
        await handleArchiveConversation(workspace.id, value, user.id, channel.id, message.ts);
        break;

      case 'quick_followup':
        await handleQuickFollowup(workspace.id, value, user.id, channel.id, message.ts);
        break;

      default:
        console.log(`[Slack] Unknown action: ${actionId}`);
    }
  }

  return NextResponse.json({ ok: true });
}

// Helper to trigger conversation flows from button clicks
async function triggerFlow(workspaceId: string, channelId: string, userId: string, input: string): Promise<void> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com'}/api/slack/sam-response`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET || '',
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        question: input,
        channel_id: channelId,
        user_id: userId,
      }),
    });

    const result = await response.json();

    if (result.success && result.response) {
      await slackService.sendBotMessage(workspaceId, channelId, {
        text: result.response,
        blocks: result.blocks,
      });
    } else if (!result.success) {
      console.error('[Slack] Flow response failed:', result.error || 'Unknown error');
      await slackService.sendBotMessage(workspaceId, channelId, {
        text: `Sorry, I encountered an error processing your request. Please try again.`,
      });
    }
  } catch (error) {
    console.error('[Slack] Error triggering flow:', error);
    try {
      await slackService.sendBotMessage(workspaceId, channelId, {
        text: `Sorry, something went wrong. Please try again later.`,
      });
    } catch (e) {
      console.error('[Slack] Failed to send error message:', e);
    }
  }
}

// ============================================================================
// EVENT CALLBACK HANDLER (Async)
// ============================================================================

async function processEventAsync(body: any): Promise<void> {
  const event = body.event;
  const teamId = body.team_id;

  if (!event) {
    console.log('[Slack] No event in callback');
    return;
  }

  console.log(`[Slack] Event: ${event.type} in ${event.channel}`);

  const workspace = await findWorkspaceBySlackTeam(teamId);
  if (!workspace) {
    console.log('[Slack] No workspace found for team:', teamId);
    return;
  }

  switch (event.type) {
    case 'message':
      // Ignore bot messages and message changes
      if (event.bot_id || event.subtype === 'message_changed' || event.subtype === 'message_deleted') {
        return;
      }
      await handleIncomingMessage(workspace.id, event);
      break;

    case 'app_mention':
      await handleAppMention(workspace.id, event);
      break;

    case 'reaction_added':
      await handleReactionAdded(workspace.id, event);
      break;

    default:
      console.log(`[Slack] Unhandled event type: ${event.type}`);
  }
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

async function handleIncomingMessage(workspaceId: string, event: any): Promise<void> {
  const { channel, user, text, ts, thread_ts } = event;

  // Log the inbound message
  await slackService.logMessage(workspaceId, {
    channel_id: channel,
    message_ts: ts,
    direction: 'inbound',
    sender_type: 'user',
    sender_id: user,
    content: text,
    thread_ts: thread_ts,
    raw_event: event,
  });

  // Check if this is a reply in a SAM thread
  if (thread_ts) {
    const existingThread = await supabaseAdmin()
      .from('slack_messages')
      .select('sam_thread_id')
      .eq('workspace_id', workspaceId)
      .eq('message_ts', thread_ts)
      .single();

    if (existingThread.data?.sam_thread_id) {
      // Continue SAM conversation
      await processSamConversation(workspaceId, channel, ts, text, existingThread.data.sam_thread_id);
      return;
    }
  }

  // Check if this is a DM with the bot or starts with @sam
  const isDirectMessage = event.channel_type === 'im';
  const mentionsSam = text.toLowerCase().includes('@sam') || text.toLowerCase().startsWith('sam ');

  if (isDirectMessage || mentionsSam) {
    await processSamConversation(workspaceId, channel, ts, text);
  }
}

async function handleAppMention(workspaceId: string, event: any): Promise<void> {
  const { channel, user, text, ts, thread_ts } = event;

  console.log(`[Slack] App mention in ${channel}: "${text.substring(0, 50)}..."`);

  // Log the mention
  await slackService.logMessage(workspaceId, {
    channel_id: channel,
    message_ts: ts,
    direction: 'inbound',
    sender_type: 'user',
    sender_id: user,
    content: text,
    thread_ts: thread_ts,
    raw_event: event,
  });

  // Extract the actual question (remove the @mention)
  const question = text.replace(/<@[A-Z0-9]+>/g, '').trim();

  if (question) {
    await processSamConversation(workspaceId, channel, ts, question, undefined, thread_ts);
  } else {
    // Just a mention without a question
    await slackService.replyInThread(workspaceId, channel, thread_ts || ts, {
      text: "Hi! I'm SAM, your AI sales assistant. Ask me anything about your campaigns, prospects, or sales strategy!",
    });
  }
}

async function handleReactionAdded(workspaceId: string, event: any): Promise<void> {
  const { reaction, item, user } = event;

  // Check if this is a reaction to a pending action message
  if (item.type !== 'message') return;

  const messageTs = item.ts;
  const channel = item.channel;

  // Quick approve/reject via emoji
  if (reaction === 'white_check_mark' || reaction === '+1' || reaction === 'thumbsup') {
    // Find pending action for this message
    const { data: pendingAction } = await supabaseAdmin()
      .from('slack_pending_actions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('message_ts', messageTs)
      .eq('status', 'pending')
      .single();

    if (pendingAction) {
      if (pendingAction.action_type === 'approve_comment') {
        await handleApproveComment(workspaceId, pendingAction.resource_id, user, channel, messageTs);
      } else if (pendingAction.action_type === 'approve_followup') {
        await handleApproveFollowUp(workspaceId, pendingAction.resource_id, user, channel, messageTs);
      }
    }
  } else if (reaction === 'x' || reaction === '-1' || reaction === 'thumbsdown') {
    const { data: pendingAction } = await supabaseAdmin()
      .from('slack_pending_actions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('message_ts', messageTs)
      .eq('status', 'pending')
      .single();

    if (pendingAction) {
      if (pendingAction.action_type === 'approve_comment') {
        await handleRejectComment(workspaceId, pendingAction.resource_id, user, channel, messageTs);
      } else if (pendingAction.action_type === 'approve_followup') {
        await handleRejectFollowUp(workspaceId, pendingAction.resource_id, user, channel, messageTs);
      }
    }
  }
}

// ============================================================================
// SAM AI CONVERSATION
// ============================================================================

async function processSamConversation(
  workspaceId: string,
  channel: string,
  messageTs: string,
  question: string,
  existingThreadId?: string,
  replyToTs?: string
): Promise<void> {
  try {
    // Add thinking reaction
    await slackService.addReaction(workspaceId, channel, messageTs, 'thinking_face');

    // Call SAM AI API
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com'}/api/slack/sam-response`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET || '',
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        question,
        thread_id: existingThreadId,
        channel_id: channel,
      }),
    });

    const result = await response.json();

    // Remove thinking reaction
    // Note: We'd need to add a removeReaction method to slackService

    if (result.success && result.response) {
      // Reply in thread
      const replyResult = await slackService.replyInThread(workspaceId, channel, replyToTs || messageTs, {
        text: result.response,
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: result.response } },
        ],
      });

      // Store the SAM thread ID for continuity
      if (replyResult.success && result.thread_id) {
        await supabaseAdmin()
          .from('slack_messages')
          .update({ sam_thread_id: result.thread_id })
          .eq('workspace_id', workspaceId)
          .eq('message_ts', messageTs);
      }
    } else {
      await slackService.replyInThread(workspaceId, channel, replyToTs || messageTs, {
        text: "I'm sorry, I couldn't process your request. Please try again or contact support.",
      });
    }
  } catch (error) {
    console.error('[Slack] SAM conversation error:', error);
    await slackService.replyInThread(workspaceId, channel, replyToTs || messageTs, {
      text: "I encountered an error processing your request. Please try again.",
    });
  }
}

// ============================================================================
// ACTION HANDLERS
// ============================================================================

async function handleApproveComment(
  workspaceId: string,
  commentId: string,
  userId: string,
  channelId: string,
  messageTs: string
): Promise<void> {
  console.log(`[Slack] Approving comment ${commentId}`);

  // Update comment status
  const { error } = await supabaseAdmin()
    .from('linkedin_post_comments')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', commentId)
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error('[Slack] Failed to approve comment:', error);
    return;
  }

  // Update pending action
  await supabaseAdmin()
    .from('slack_pending_actions')
    .update({ status: 'completed', completed_at: new Date().toISOString(), completed_by: userId })
    .eq('workspace_id', workspaceId)
    .eq('resource_id', commentId);

  // Update the Slack message to show it was approved
  await slackService.updateMessage(workspaceId, channelId, messageTs, {
    text: 'Comment approved',
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: '*Comment Approved* by <@' + userId + '>' } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: 'This comment has been approved and will be posted.' }] },
    ],
  });
}

async function handleRejectComment(
  workspaceId: string,
  commentId: string,
  userId: string,
  channelId: string,
  messageTs: string
): Promise<void> {
  console.log(`[Slack] Rejecting comment ${commentId}`);

  const { error } = await supabaseAdmin()
    .from('linkedin_post_comments')
    .update({ status: 'rejected', rejected_at: new Date().toISOString() })
    .eq('id', commentId)
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error('[Slack] Failed to reject comment:', error);
    return;
  }

  await supabaseAdmin()
    .from('slack_pending_actions')
    .update({ status: 'completed', completed_at: new Date().toISOString(), completed_by: userId })
    .eq('workspace_id', workspaceId)
    .eq('resource_id', commentId);

  await slackService.updateMessage(workspaceId, channelId, messageTs, {
    text: 'Comment rejected',
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: '*Comment Rejected* by <@' + userId + '>' } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: 'This comment has been rejected and will not be posted.' }] },
    ],
  });
}

async function handleApproveFollowUp(
  workspaceId: string,
  draftId: string,
  userId: string,
  channelId: string,
  messageTs: string
): Promise<void> {
  console.log(`[Slack] Approving follow-up ${draftId}`);

  // Call the follow-up approval API
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com'}/api/follow-up-agent/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': process.env.INTERNAL_API_SECRET || '',
    },
    body: JSON.stringify({
      draft_id: draftId,
      workspace_id: workspaceId,
      action: 'approve',
    }),
  });

  const result = await response.json();

  if (result.success) {
    await slackService.updateMessage(workspaceId, channelId, messageTs, {
      text: 'Follow-up approved',
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: '*Follow-Up Approved* by <@' + userId + '>' } },
        { type: 'context', elements: [{ type: 'mrkdwn', text: 'This message has been approved and will be sent.' }] },
      ],
    });
  } else {
    await slackService.replyInThread(workspaceId, channelId, messageTs, {
      text: `Failed to approve follow-up: ${result.error}`,
    });
  }
}

async function handleRejectFollowUp(
  workspaceId: string,
  draftId: string,
  userId: string,
  channelId: string,
  messageTs: string
): Promise<void> {
  console.log(`[Slack] Rejecting follow-up ${draftId}`);

  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com'}/api/follow-up-agent/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': process.env.INTERNAL_API_SECRET || '',
    },
    body: JSON.stringify({
      draft_id: draftId,
      workspace_id: workspaceId,
      action: 'reject',
    }),
  });

  const result = await response.json();

  if (result.success) {
    await slackService.updateMessage(workspaceId, channelId, messageTs, {
      text: 'Follow-up rejected',
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: '*Follow-Up Rejected* by <@' + userId + '>' } },
        { type: 'context', elements: [{ type: 'mrkdwn', text: 'This message has been rejected and will not be sent.' }] },
      ],
    });
  }
}

async function handleMarkHotLead(
  workspaceId: string,
  prospectId: string,
  userId: string,
  channelId: string,
  messageTs: string
): Promise<void> {
  console.log(`[Slack] Marking prospect ${prospectId} as hot lead`);

  const { error } = await supabaseAdmin()
    .from('campaign_prospects')
    .update({
      status: 'hot_lead',
      lead_score: 90,
      updated_at: new Date().toISOString(),
    })
    .eq('id', prospectId)
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error('[Slack] Failed to mark hot lead:', error);
    return;
  }

  await slackService.updateMessage(workspaceId, channelId, messageTs, {
    text: 'Marked as hot lead',
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: '*Marked as Hot Lead* by <@' + userId + '>' } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: 'This prospect has been flagged for priority follow-up.' }] },
    ],
  });
}

async function handleArchiveConversation(
  workspaceId: string,
  messageId: string,
  userId: string,
  channelId: string,
  messageTs: string
): Promise<void> {
  console.log(`[Slack] Archiving conversation for message ${messageId}`);

  // Archive the message/conversation
  await supabaseAdmin()
    .from('linkedin_messages')
    .update({
      status: 'archived',
      metadata: { archived_by: userId, archived_at: new Date().toISOString() },
    })
    .eq('id', messageId)
    .eq('workspace_id', workspaceId);

  await slackService.updateMessage(workspaceId, channelId, messageTs, {
    text: 'Conversation archived',
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: '*Conversation Archived* by <@' + userId + '>' } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: 'This conversation has been archived.' }] },
    ],
  });
}

async function handleQuickFollowup(
  workspaceId: string,
  prospectId: string,
  userId: string,
  channelId: string,
  messageTs: string
): Promise<void> {
  console.log(`[Slack] Triggering quick follow-up for prospect ${prospectId}`);

  // Get prospect and campaign details
  const { data: prospect } = await supabaseAdmin()
    .from('campaign_prospects')
    .select('*, campaigns!inner(name, message_templates)')
    .eq('id', prospectId)
    .eq('workspace_id', workspaceId)
    .single();

  if (!prospect) {
    await slackService.replyInThread(workspaceId, channelId, messageTs, {
      text: 'Could not find prospect details.',
    });
    return;
  }

  // Queue the follow-up for immediate sending
  const { error } = await supabaseAdmin()
    .from('campaign_prospects')
    .update({
      follow_up_due_at: new Date().toISOString(), // Set to now for immediate processing
      updated_at: new Date().toISOString(),
    })
    .eq('id', prospectId);

  if (error) {
    console.error('[Slack] Failed to queue follow-up:', error);
    await slackService.replyInThread(workspaceId, channelId, messageTs, {
      text: `Failed to queue follow-up: ${error.message}`,
    });
    return;
  }

  await slackService.updateMessage(workspaceId, channelId, messageTs, {
    text: 'Follow-up queued',
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: '*Follow-Up Queued* by <@' + userId + '>' } },
      {
        type: 'context',
        elements: [{
          type: 'mrkdwn',
          text: `Follow-up for *${prospect.first_name} ${prospect.last_name}* has been queued for immediate sending.`,
        }],
      },
    ],
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function findWorkspaceBySlackTeam(teamId: string): Promise<{ id: string; name: string } | null> {
  if (!teamId) return null;

  // First get the workspace_id from slack_app_config
  const { data: config, error: configError } = await supabaseAdmin()
    .from('slack_app_config')
    .select('workspace_id')
    .eq('slack_team_id', teamId)
    .eq('status', 'active')
    .single();

  if (configError || !config?.workspace_id) {
    console.log('[Slack] No config found for team:', teamId, configError?.message);
    return null;
  }

  // Then get the workspace details
  const { data: workspace, error: wsError } = await supabaseAdmin()
    .from('workspaces')
    .select('id, name')
    .eq('id', config.workspace_id)
    .single();

  if (wsError || !workspace) {
    console.log('[Slack] No workspace found for id:', config.workspace_id, wsError?.message);
    return null;
  }

  return {
    id: workspace.id,
    name: workspace.name,
  };
}

async function getActiveCampaigns(workspaceId: string): Promise<any[]> {
  const { data } = await supabaseAdmin()
    .from('campaigns')
    .select('id, name, status, campaign_prospects(count)')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .limit(10);

  return (data || []).map(c => ({
    id: c.id,
    name: c.name,
    status: c.status,
    prospect_count: c.campaign_prospects?.[0]?.count || 0,
  }));
}

async function queueSlackQuestion(
  workspaceId: string,
  channelId: string,
  userId: string,
  question: string
): Promise<void> {
  // This triggers async processing
  // The response will be sent back to the thread
  processSamConversation(workspaceId, channelId, '', question).catch(err =>
    console.error('[Slack] Failed to process question:', err)
  );
}
