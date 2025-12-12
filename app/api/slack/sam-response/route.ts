import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';

/**
 * SAM Response API for Slack
 * Generates AI responses to questions from Slack
 *
 * Supported commands:
 * - Show message sequence for campaign X
 * - Update message N with text
 * - Pause/resume campaign
 * - Show prospects and their status
 * - Archive campaign
 * - Change campaign settings
 */

// Command patterns for intent detection
const COMMAND_PATTERNS = {
  SHOW_MESSAGES: /show\s+(me\s+)?(the\s+)?message\s*(sequence|template)?s?\s*(for|of|in)?\s*(campaign)?\s*(.+)?/i,
  UPDATE_MESSAGE: /update\s+(the\s+)?(message\s+)?(#?\d+|first|second|third|fourth|connection\s*request|follow[\s-]?up\s*\d?)\s*(with|to)\s*(.+)/i,
  PAUSE_CAMPAIGN: /pause\s+(the\s+)?(campaign)?\s*(.+)?/i,
  RESUME_CAMPAIGN: /resume\s+(the\s+)?(campaign)?\s*(.+)?/i,
  SHOW_PROSPECTS: /show\s+(me\s+)?(all\s+)?(the\s+)?prospects?\s*(and\s+(their\s+)?status)?(\s*for\s*campaign\s*(.+))?/i,
  ARCHIVE_CAMPAIGN: /archive\s+(the\s+)?(campaign)?\s*(.+)?/i,
  CAMPAIGN_SETTINGS: /(change|update|modify)\s+(campaign\s+)?settings?\s*(for)?\s*(.+)?/i,
  CAMPAIGN_STATS: /(show|get|what\s*are)\s+(the\s+)?(campaign\s+)?stats?(istics)?\s*(for)?\s*(.+)?/i,
};

export async function POST(request: NextRequest) {
  try {
    // Verify internal secret for security
    const internalSecret = request.headers.get('x-internal-secret');
    if (internalSecret !== process.env.INTERNAL_API_SECRET && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { workspace_id, question, thread_id, channel_id } = body;

    if (!workspace_id || !question) {
      return NextResponse.json({ error: 'Missing workspace_id or question' }, { status: 400 });
    }

    console.log(`[Slack SAM] Processing question for workspace ${workspace_id}: "${question.substring(0, 50)}..."`);

    // Get workspace context
    const { data: workspace } = await supabaseAdmin()
      .from('workspaces')
      .select('id, name, industry, company_description')
      .eq('id', workspace_id)
      .single();

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Get recent campaign data for context
    const { data: campaigns } = await supabaseAdmin()
      .from('campaigns')
      .select(`
        id, name, status, created_at,
        campaign_prospects(count)
      `)
      .eq('workspace_id', workspace_id)
      .order('created_at', { ascending: false })
      .limit(5);

    // Get recent prospect stats
    const { data: prospectStats } = await supabaseAdmin()
      .from('campaign_prospects')
      .select('status')
      .eq('workspace_id', workspace_id);

    // Get recent replies for context
    const { data: recentReplies } = await supabaseAdmin()
      .from('linkedin_messages')
      .select('content, sender_name, created_at')
      .eq('workspace_id', workspace_id)
      .eq('direction', 'incoming')
      .order('created_at', { ascending: false })
      .limit(5);

    // Get hot leads
    const { data: hotLeads } = await supabaseAdmin()
      .from('campaign_prospects')
      .select('first_name, last_name, company, title')
      .eq('workspace_id', workspace_id)
      .or('status.eq.hot_lead,lead_score.gte.80')
      .limit(5);

    const stats = {
      total: prospectStats?.length || 0,
      sent: prospectStats?.filter(p => p.status === 'connection_request_sent').length || 0,
      accepted: prospectStats?.filter(p => p.status === 'connection_accepted').length || 0,
      replied: prospectStats?.filter(p => p.status === 'replied').length || 0,
    };

    // Build context for SAM
    const context = buildContext(workspace, campaigns || [], stats, recentReplies || [], hotLeads || []);

    // Generate response using OpenRouter (with command execution)
    const response = await generateSamResponse(question, context, thread_id, workspace_id, campaigns || []);

    // Create or continue SAM thread
    let samThreadId = thread_id;
    if (!samThreadId) {
      const { data: newThread } = await supabaseAdmin()
        .from('sam_threads')
        .insert({
          workspace_id,
          title: question.substring(0, 100),
          thread_type: 'slack_conversation',
          status: 'active',
        })
        .select('id')
        .single();

      samThreadId = newThread?.id;
    }

    // Store the conversation
    if (samThreadId) {
      await supabaseAdmin().from('sam_conversation_messages').insert([
        {
          thread_id: samThreadId,
          role: 'user',
          content: question,
          metadata: { source: 'slack', channel_id },
        },
        {
          thread_id: samThreadId,
          role: 'assistant',
          content: response,
          metadata: { source: 'slack' },
        },
      ]);
    }

    return NextResponse.json({
      success: true,
      response,
      thread_id: samThreadId,
    });

  } catch (error) {
    console.error('[Slack SAM] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate response',
    }, { status: 500 });
  }
}

function buildContext(
  workspace: any,
  campaigns: any[],
  stats: { total: number; sent: number; accepted: number; replied: number },
  recentReplies: any[],
  hotLeads: any[]
): string {
  const campaignSummary = campaigns.length > 0
    ? campaigns.map(c => `- ${c.name} (ID: ${c.id}): ${c.status} (${c.campaign_prospects?.[0]?.count || 0} prospects)`).join('\n')
    : 'No campaigns yet';

  const repliesSummary = recentReplies.length > 0
    ? recentReplies.map(r => `- ${r.sender_name}: "${r.content?.substring(0, 80)}..."`).join('\n')
    : 'No recent replies';

  const hotLeadsSummary = hotLeads.length > 0
    ? hotLeads.map(h => `- ${h.first_name} ${h.last_name} (${h.title} at ${h.company})`).join('\n')
    : 'No hot leads identified';

  return `
## Workspace Context
- Name: ${workspace.name}
- Industry: ${workspace.industry || 'Not specified'}
- Description: ${workspace.company_description || 'Not specified'}

## Campaigns (with IDs for reference)
${campaignSummary}

## Overall Statistics
- Total Prospects: ${stats.total}
- Connection Requests Sent: ${stats.sent}
- Connections Accepted: ${stats.accepted}
- Replies Received: ${stats.replied}
- Acceptance Rate: ${stats.sent > 0 ? ((stats.accepted / stats.sent) * 100).toFixed(1) : 0}%
- Reply Rate: ${stats.accepted > 0 ? ((stats.replied / stats.accepted) * 100).toFixed(1) : 0}%

## Recent Replies
${repliesSummary}

## Hot Leads
${hotLeadsSummary}
`.trim();
}

// =============================================================================
// CAMPAIGN COMMAND EXECUTORS
// =============================================================================

async function findCampaignByName(workspaceId: string, campaignName: string): Promise<any | null> {
  // Try exact match first
  let { data: campaign } = await supabaseAdmin()
    .from('campaigns')
    .select('*')
    .eq('workspace_id', workspaceId)
    .ilike('name', campaignName.trim())
    .single();

  if (!campaign) {
    // Try fuzzy match
    const { data: campaigns } = await supabaseAdmin()
      .from('campaigns')
      .select('*')
      .eq('workspace_id', workspaceId);

    if (campaigns) {
      const searchTerm = campaignName.toLowerCase().trim();
      campaign = campaigns.find(c =>
        c.name.toLowerCase().includes(searchTerm) ||
        searchTerm.includes(c.name.toLowerCase())
      );
    }
  }

  return campaign;
}

async function executeShowMessages(workspaceId: string, campaignName: string): Promise<string> {
  const campaign = await findCampaignByName(workspaceId, campaignName);

  if (!campaign) {
    return `I couldn't find a campaign matching "${campaignName}". Here are your campaigns - try being more specific.`;
  }

  const templates = campaign.message_templates || {};
  const cr = templates.connection_request || templates.connectionRequest || 'Not set';
  const followUps = templates.follow_ups || templates.followUps || [];

  let response = `*Message Sequence for "${campaign.name}"*\n\n`;
  response += `*1. Connection Request:*\n> ${cr.substring(0, 200)}${cr.length > 200 ? '...' : ''}\n\n`;

  if (followUps.length > 0) {
    followUps.forEach((fu: any, i: number) => {
      const msg = typeof fu === 'string' ? fu : fu.message || fu.content || '';
      const delay = typeof fu === 'object' ? fu.delay_days || fu.delayDays || 3 : 3;
      response += `*${i + 2}. Follow-up ${i + 1}* (after ${delay} days):\n> ${msg.substring(0, 200)}${msg.length > 200 ? '...' : ''}\n\n`;
    });
  } else {
    response += '_No follow-up messages configured._\n';
  }

  return response;
}

async function executePauseCampaign(workspaceId: string, campaignName: string): Promise<string> {
  const campaign = await findCampaignByName(workspaceId, campaignName);

  if (!campaign) {
    return `I couldn't find a campaign matching "${campaignName}".`;
  }

  if (campaign.status === 'paused') {
    return `Campaign "${campaign.name}" is already paused.`;
  }

  const { error } = await supabaseAdmin()
    .from('campaigns')
    .update({ status: 'paused', updated_at: new Date().toISOString() })
    .eq('id', campaign.id);

  if (error) {
    return `Failed to pause campaign: ${error.message}`;
  }

  return `Campaign "${campaign.name}" has been *paused*. No new messages will be sent until you resume it.`;
}

async function executeResumeCampaign(workspaceId: string, campaignName: string): Promise<string> {
  const campaign = await findCampaignByName(workspaceId, campaignName);

  if (!campaign) {
    return `I couldn't find a campaign matching "${campaignName}".`;
  }

  if (campaign.status === 'active') {
    return `Campaign "${campaign.name}" is already active.`;
  }

  const { error } = await supabaseAdmin()
    .from('campaigns')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', campaign.id);

  if (error) {
    return `Failed to resume campaign: ${error.message}`;
  }

  return `Campaign "${campaign.name}" has been *resumed*. Messages will continue to be sent.`;
}

async function executeShowProspects(workspaceId: string, campaignName?: string): Promise<string> {
  let query = supabaseAdmin()
    .from('campaign_prospects')
    .select('first_name, last_name, company, title, status, contacted_at, campaign_id, campaigns!inner(name)')
    .eq('workspace_id', workspaceId)
    .order('contacted_at', { ascending: false })
    .limit(20);

  if (campaignName) {
    const campaign = await findCampaignByName(workspaceId, campaignName);
    if (campaign) {
      query = query.eq('campaign_id', campaign.id);
    }
  }

  const { data: prospects } = await query;

  if (!prospects || prospects.length === 0) {
    return campaignName
      ? `No prospects found for campaign "${campaignName}".`
      : 'No prospects found in your workspace.';
  }

  // Group by status
  const byStatus: Record<string, any[]> = {};
  prospects.forEach(p => {
    const status = p.status || 'unknown';
    if (!byStatus[status]) byStatus[status] = [];
    byStatus[status].push(p);
  });

  let response = campaignName
    ? `*Prospects for "${(prospects[0].campaigns as any)?.name || campaignName}"*\n\n`
    : `*Recent Prospects (last 20)*\n\n`;

  Object.entries(byStatus).forEach(([status, list]) => {
    const emoji = status === 'replied' ? '💬' : status === 'connected' ? '🤝' : status === 'connection_request_sent' ? '📤' : '⏳';
    response += `${emoji} *${status.replace(/_/g, ' ')}* (${list.length}):\n`;
    list.slice(0, 5).forEach(p => {
      response += `  • ${p.first_name} ${p.last_name} - ${p.title || 'Unknown'} at ${p.company || 'Unknown'}\n`;
    });
    if (list.length > 5) {
      response += `  _...and ${list.length - 5} more_\n`;
    }
    response += '\n';
  });

  return response;
}

async function executeArchiveCampaign(workspaceId: string, campaignName: string): Promise<string> {
  const campaign = await findCampaignByName(workspaceId, campaignName);

  if (!campaign) {
    return `I couldn't find a campaign matching "${campaignName}".`;
  }

  const { error } = await supabaseAdmin()
    .from('campaigns')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', campaign.id);

  if (error) {
    return `Failed to archive campaign: ${error.message}`;
  }

  return `Campaign "${campaign.name}" has been *archived*. It won't appear in your active campaigns list.`;
}

async function executeUpdateMessage(
  workspaceId: string,
  campaignName: string,
  messageIndex: string,
  newContent: string
): Promise<string> {
  const campaign = await findCampaignByName(workspaceId, campaignName);

  if (!campaign) {
    return `I couldn't find a campaign to update. Please specify the campaign name.`;
  }

  const templates = campaign.message_templates || {};

  // Parse message index
  let index = 0;
  const indexLower = messageIndex.toLowerCase();
  if (indexLower.includes('connection') || indexLower.includes('first') || indexLower === '1') {
    index = 0;
  } else if (indexLower.includes('second') || indexLower === '2') {
    index = 1;
  } else if (indexLower.includes('third') || indexLower === '3') {
    index = 2;
  } else if (indexLower.includes('fourth') || indexLower === '4') {
    index = 3;
  } else {
    const num = parseInt(messageIndex.replace(/\D/g, ''));
    if (!isNaN(num)) index = num - 1;
  }

  if (index === 0) {
    // Update connection request
    templates.connection_request = newContent;
  } else {
    // Update follow-up
    const followUps = templates.follow_ups || [];
    const fuIndex = index - 1;
    if (fuIndex >= 0 && fuIndex < followUps.length) {
      if (typeof followUps[fuIndex] === 'string') {
        followUps[fuIndex] = newContent;
      } else {
        followUps[fuIndex].message = newContent;
      }
      templates.follow_ups = followUps;
    } else {
      return `Follow-up message #${index} doesn't exist. This campaign has ${followUps.length} follow-ups.`;
    }
  }

  const { error } = await supabaseAdmin()
    .from('campaigns')
    .update({ message_templates: templates, updated_at: new Date().toISOString() })
    .eq('id', campaign.id);

  if (error) {
    return `Failed to update message: ${error.message}`;
  }

  const msgType = index === 0 ? 'connection request' : `follow-up #${index}`;
  return `Updated ${msgType} for campaign "${campaign.name}".\n\n*New message:*\n> ${newContent.substring(0, 200)}${newContent.length > 200 ? '...' : ''}`;
}

async function executeCampaignStats(workspaceId: string, campaignName: string): Promise<string> {
  const campaign = await findCampaignByName(workspaceId, campaignName);

  if (!campaign) {
    return `I couldn't find a campaign matching "${campaignName}".`;
  }

  const { data: prospects } = await supabaseAdmin()
    .from('campaign_prospects')
    .select('status')
    .eq('campaign_id', campaign.id);

  const stats = {
    total: prospects?.length || 0,
    pending: prospects?.filter(p => p.status === 'pending').length || 0,
    sent: prospects?.filter(p => p.status === 'connection_request_sent').length || 0,
    accepted: prospects?.filter(p => ['connected', 'accepted', 'messaging'].includes(p.status)).length || 0,
    replied: prospects?.filter(p => p.status === 'replied').length || 0,
  };

  const acceptRate = stats.sent > 0 ? ((stats.accepted / stats.sent) * 100).toFixed(1) : '0';
  const replyRate = stats.accepted > 0 ? ((stats.replied / stats.accepted) * 100).toFixed(1) : '0';

  return `*Campaign: ${campaign.name}*
Status: ${campaign.status}
Created: ${new Date(campaign.created_at).toLocaleDateString()}

*Prospect Statistics:*
• Total prospects: ${stats.total}
• Pending: ${stats.pending}
• CRs sent: ${stats.sent}
• Accepted: ${stats.accepted} (${acceptRate}% acceptance rate)
• Replied: ${stats.replied} (${replyRate}% reply rate)`;
}

// =============================================================================
// COMMAND DETECTION AND ROUTING
// =============================================================================

async function detectAndExecuteCommand(
  workspaceId: string,
  question: string,
  campaigns: any[]
): Promise<string | null> {
  // Check each command pattern
  let match;

  // Show messages
  match = question.match(COMMAND_PATTERNS.SHOW_MESSAGES);
  if (match) {
    const campaignName = match[6]?.trim() || campaigns[0]?.name;
    if (campaignName) {
      return executeShowMessages(workspaceId, campaignName);
    }
  }

  // Pause campaign
  match = question.match(COMMAND_PATTERNS.PAUSE_CAMPAIGN);
  if (match) {
    const campaignName = match[3]?.trim() || campaigns[0]?.name;
    if (campaignName) {
      return executePauseCampaign(workspaceId, campaignName);
    }
  }

  // Resume campaign
  match = question.match(COMMAND_PATTERNS.RESUME_CAMPAIGN);
  if (match) {
    const campaignName = match[3]?.trim() || campaigns[0]?.name;
    if (campaignName) {
      return executeResumeCampaign(workspaceId, campaignName);
    }
  }

  // Show prospects
  match = question.match(COMMAND_PATTERNS.SHOW_PROSPECTS);
  if (match) {
    const campaignName = match[7]?.trim();
    return executeShowProspects(workspaceId, campaignName);
  }

  // Archive campaign
  match = question.match(COMMAND_PATTERNS.ARCHIVE_CAMPAIGN);
  if (match) {
    const campaignName = match[3]?.trim();
    if (campaignName) {
      return executeArchiveCampaign(workspaceId, campaignName);
    }
  }

  // Campaign stats
  match = question.match(COMMAND_PATTERNS.CAMPAIGN_STATS);
  if (match) {
    const campaignName = match[6]?.trim() || campaigns[0]?.name;
    if (campaignName) {
      return executeCampaignStats(workspaceId, campaignName);
    }
  }

  // Update message - more complex pattern
  match = question.match(COMMAND_PATTERNS.UPDATE_MESSAGE);
  if (match) {
    const messageIndex = match[3];
    const newContent = match[5];
    // Need to find campaign from context
    const campaignName = campaigns[0]?.name;
    if (campaignName && newContent) {
      return executeUpdateMessage(workspaceId, campaignName, messageIndex, newContent);
    }
  }

  return null; // No command detected
}

// =============================================================================
// AI RESPONSE GENERATION
// =============================================================================

async function generateSamResponse(
  question: string,
  context: string,
  threadId?: string,
  workspaceId?: string,
  campaigns?: any[]
): Promise<string> {
  // First, try to detect and execute a direct command
  if (workspaceId && campaigns) {
    const commandResult = await detectAndExecuteCommand(workspaceId, question, campaigns);
    if (commandResult) {
      return commandResult;
    }
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return "I'm sorry, I'm not able to process your request right now. Please try again later.";
  }

  const systemPrompt = `You are SAM, an AI sales development assistant. You help users manage their LinkedIn outreach campaigns and prospect relationships.

You have access to the following workspace data:
${context}

Guidelines:
- Be concise and helpful - this is a Slack conversation
- Use bullet points for lists
- Keep responses under 300 words unless the question requires detail
- If asked about specific data you don't have, say so clearly
- Provide actionable advice when appropriate
- Use Slack-friendly markdown (bold with *, code with \`)

You can EXECUTE these commands directly (just tell users to try):
- "show messages for [campaign name]" - displays the message sequence
- "pause campaign [name]" - pauses a campaign
- "resume campaign [name]" - resumes a campaign
- "show prospects" or "show prospects for [campaign]" - lists prospects by status
- "archive campaign [name]" - archives a campaign
- "show stats for [campaign]" - shows campaign statistics
- "update message 2 with [new text]" - updates a message template

You can also help with:
- Campaign status and performance questions
- Prospect engagement advice
- Message template suggestions
- Sales strategy recommendations
- Troubleshooting issues`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://app.meet-sam.com',
        'X-Title': 'SAM AI - Slack',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    const result = await response.json();

    if (result.choices?.[0]?.message?.content) {
      return result.choices[0].message.content;
    }

    return "I couldn't generate a response. Please try rephrasing your question.";
  } catch (error) {
    console.error('[Slack SAM] OpenRouter error:', error);
    return "I encountered an error while processing your request. Please try again.";
  }
}
