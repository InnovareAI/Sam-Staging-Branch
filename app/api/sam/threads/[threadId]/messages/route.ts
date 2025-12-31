/**
 * SAM AI Thread Messages API
 * 
 * Handles messages within conversation threads.
 * Migrated to use SamChatService and Postgres Pool (removing Supabase).
 */
export const maxDuration = 60; // Extend timeout for AI generation

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';
import { SamChatService } from '@/lib/sam/chat-service';

// Service singleton (or instantiate per request if needed)
const chatService = new SamChatService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    // 1. Auth
    const auth = await verifyAuth(request);
    if (!auth.isAuthenticated || !auth.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const resolvedParams = await params;
    const { threadId } = resolvedParams;

    // 2. Validate Access
    const threadCheck = await pool.query(
      `SELECT id FROM sam_conversation_threads WHERE id = $1 AND user_id = $2`,
      [threadId, auth.user.uid]
    );

    if (threadCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    // 3. Fetch Messages
    const { rows: messages } = await pool.query(
      `SELECT * FROM sam_conversation_messages 
       WHERE thread_id = $1 
       ORDER BY message_order ASC`,
      [threadId]
    );

    return NextResponse.json({
      success: true,
      messages: messages
    });

  } catch (error: any) {
    console.error('GET messages error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    // 1. Auth
    const auth = await verifyAuth(request);
    if (!auth.isAuthenticated || !auth.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const resolvedParams = await params;
    const { threadId } = resolvedParams;

    // 2. Parse Body
    const body = await request.json();
    const { content, attachmentIds } = body;

    if (!content && (!attachmentIds || attachmentIds.length === 0)) {
      return NextResponse.json({ error: 'Message content required' }, { status: 400 });
    }

    // 3. Process via Service
    const result = await chatService.processChatRequest({
      userId: auth.user.uid,
      workspaceId: auth.workspaceId || '',
      threadId,
      content: content || '',
      attachmentIds
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to process message' },
        { status: 500 }
      );
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('POST messages error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
