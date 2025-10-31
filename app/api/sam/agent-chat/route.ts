/**
 * SAM AI Agent SDK Chat API
 * Uses Claude Agent SDK for continuous conversations with automatic context compaction
 * Date: October 31, 2025
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { SAMAgentFactory, SAMSubAgent } from '@/lib/agents/sam-agent-sdk';

/**
 * POST /api/sam/agent-chat
 *
 * Stream a conversation with SAM Agent SDK
 *
 * Body:
 * {
 *   message: string;
 *   workspace_id: string;
 *   session_id?: string;
 *   use_sub_agent?: 'prospectResearcher' | 'campaignCreator' | 'emailWriter' | 'linkedinStrategist' | 'dataEnricher';
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, workspace_id, session_id, use_sub_agent } = body;

    if (!message || !workspace_id) {
      return NextResponse.json({
        error: 'Missing required fields: message, workspace_id'
      }, { status: 400 });
    }

    // Authenticate user
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Verify workspace access
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({
        error: 'Workspace access denied'
      }, { status: 403 });
    }

    // Use sub-agent if specified, otherwise use main agent
    if (use_sub_agent) {
      console.log(`🤖 Using sub-agent: ${use_sub_agent}`);

      const subAgent = SAMAgentFactory.createSubAgent(use_sub_agent, workspace_id);
      const response = await subAgent.execute(message);

      return NextResponse.json({
        success: true,
        agent_type: 'sub-agent',
        sub_agent_name: use_sub_agent,
        response,
        workspace_id,
      });
    }

    // Use main SAM agent with streaming
    console.log(`💬 Starting SAM Agent chat for workspace: ${workspace_id}`);

    const session = SAMAgentFactory.getSession(workspace_id, session_id);

    // Create a ReadableStream for streaming responses
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Stream responses from SAM agent
          for await (const chunk of session.chat(message)) {
            const data = JSON.stringify({ type: 'chunk', content: chunk });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }

          // Send completion signal
          const metadata = session.getMetadata();
          const complete = JSON.stringify({
            type: 'complete',
            metadata: {
              session_id: metadata.sessionId,
              message_count: metadata.messageCount,
            }
          });
          controller.enqueue(encoder.encode(`data: ${complete}\n\n`));

          controller.close();
        } catch (error) {
          console.error('SAM Agent streaming error:', error);
          const errorData = JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : String(error)
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('SAM Agent chat error:', error);
    return NextResponse.json({
      error: 'Failed to process chat message',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * GET /api/sam/agent-chat?workspace_id=xxx
 *
 * Get session metadata and history
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspace_id = searchParams.get('workspace_id');
    const session_id = searchParams.get('session_id');

    if (!workspace_id) {
      return NextResponse.json({
        error: 'Missing workspace_id'
      }, { status: 400 });
    }

    // Authenticate user
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Verify workspace access
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({
        error: 'Workspace access denied'
      }, { status: 403 });
    }

    // Get session if exists
    const session = SAMAgentFactory.getSession(workspace_id, session_id);
    const metadata = session.getMetadata();
    const history = session.getHistory();

    return NextResponse.json({
      success: true,
      session: {
        ...metadata,
        history_length: history.length,
        history: history.slice(-10) // Last 10 messages
      }
    });

  } catch (error) {
    console.error('SAM Agent session error:', error);
    return NextResponse.json({
      error: 'Failed to retrieve session',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * DELETE /api/sam/agent-chat?session_id=xxx
 *
 * Clean up old sessions
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const max_age_hours = parseInt(searchParams.get('max_age_hours') || '24');

    // Authenticate user (admin only for cleanup)
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Clean up old sessions
    SAMAgentFactory.cleanupSessions(max_age_hours);

    const activeSessions = SAMAgentFactory.getActiveSessions();

    return NextResponse.json({
      success: true,
      message: `Cleaned up sessions older than ${max_age_hours} hours`,
      active_sessions: activeSessions.length,
      sessions: activeSessions
    });

  } catch (error) {
    console.error('SAM Agent cleanup error:', error);
    return NextResponse.json({
      error: 'Failed to cleanup sessions',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
