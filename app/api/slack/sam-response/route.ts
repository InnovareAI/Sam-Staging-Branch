import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';

/**
 * SAM Response API for Slack
 * Generates AI responses to questions from Slack
 */

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
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('id, name, industry, company_description')
      .eq('id', workspace_id)
      .single();

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Get recent campaign data for context
    const { data: campaigns } = await supabaseAdmin
      .from('campaigns')
      .select(`
        id, name, status, created_at,
        campaign_prospects(count)
      `)
      .eq('workspace_id', workspace_id)
      .order('created_at', { ascending: false })
      .limit(5);

    // Get recent prospect stats
    const { data: prospectStats } = await supabaseAdmin
      .from('campaign_prospects')
      .select('status')
      .eq('workspace_id', workspace_id);

    const stats = {
      total: prospectStats?.length || 0,
      sent: prospectStats?.filter(p => p.status === 'connection_request_sent').length || 0,
      accepted: prospectStats?.filter(p => p.status === 'connection_accepted').length || 0,
      replied: prospectStats?.filter(p => p.status === 'replied').length || 0,
    };

    // Build context for SAM
    const context = buildContext(workspace, campaigns || [], stats);

    // Generate response using OpenRouter
    const response = await generateSamResponse(question, context, thread_id);

    // Create or continue SAM thread
    let samThreadId = thread_id;
    if (!samThreadId) {
      const { data: newThread } = await supabaseAdmin
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
      await supabaseAdmin.from('sam_conversation_messages').insert([
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
  stats: { total: number; sent: number; accepted: number; replied: number }
): string {
  const campaignSummary = campaigns.length > 0
    ? campaigns.map(c => `- ${c.name}: ${c.status} (${c.campaign_prospects?.[0]?.count || 0} prospects)`).join('\n')
    : 'No campaigns yet';

  return `
## Workspace Context
- Name: ${workspace.name}
- Industry: ${workspace.industry || 'Not specified'}
- Description: ${workspace.company_description || 'Not specified'}

## Recent Campaigns
${campaignSummary}

## Overall Statistics
- Total Prospects: ${stats.total}
- Connection Requests Sent: ${stats.sent}
- Connections Accepted: ${stats.accepted}
- Replies Received: ${stats.replied}
- Acceptance Rate: ${stats.sent > 0 ? ((stats.accepted / stats.sent) * 100).toFixed(1) : 0}%
- Reply Rate: ${stats.accepted > 0 ? ((stats.replied / stats.accepted) * 100).toFixed(1) : 0}%
`.trim();
}

async function generateSamResponse(question: string, context: string, threadId?: string): Promise<string> {
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

You can help with:
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
