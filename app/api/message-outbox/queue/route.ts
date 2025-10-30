/**
 * Message Outbox - Queue Message
 * Queue a message for delivery via email or LinkedIn
 * Used by Follow-up Agent and other automated messaging systems
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Verify N8N internal trigger (or allow authenticated users)
    const triggerHeader = request.headers.get('x-internal-trigger');
    const isN8NTrigger = triggerHeader === 'n8n-followup-agent' || triggerHeader === 'n8n-reply-agent';

    const supabase = await createClient();

    // If not N8N trigger, verify user authentication
    if (!isN8NTrigger) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    const body = await request.json();

    // Validate required fields
    if (!body.workspace_id || !body.channel || !body.message) {
      return NextResponse.json(
        { error: 'Missing required fields: workspace_id, channel, message' },
        { status: 400 }
      );
    }

    // Validate channel
    if (!['email', 'linkedin', 'both'].includes(body.channel)) {
      return NextResponse.json(
        { error: 'Invalid channel. Must be: email, linkedin, or both' },
        { status: 400 }
      );
    }

    console.log('📬 Queueing message to outbox:', {
      workspace_id: body.workspace_id,
      prospect_id: body.prospect_id,
      channel: body.channel,
      message_type: body.message_type || 'standard'
    });

    // Build message outbox record
    const outboxRecord: any = {
      workspace_id: body.workspace_id,
      campaign_id: body.campaign_id || null,
      prospect_id: body.prospect_id || null,
      reply_id: body.reply_id || null,
      channel: body.channel,
      message_content: body.message,
      subject: body.subject || null,
      status: 'queued',
      scheduled_send_time: body.scheduled_send_time || null,
      metadata: {
        message_type: body.message_type || 'standard', // 'follow_up', 'reply', 'campaign', 'standard'
        follow_up_id: body.follow_up_id || null,
        follow_up_attempt: body.follow_up_attempt || null,
        queued_by: isN8NTrigger ? 'n8n-automation' : 'user',
        queued_at: new Date().toISOString(),
        ...body.metadata
      }
    };

    // Insert into message_outbox
    const { data: queuedMessage, error } = await supabase
      .from('message_outbox')
      .insert(outboxRecord)
      .select()
      .single();

    if (error) {
      console.error('❌ Error queueing message:', error);
      return NextResponse.json(
        { error: 'Database error', details: error.message },
        { status: 500 }
      );
    }

    console.log('✅ Message queued successfully:', {
      message_id: queuedMessage.id,
      channel: queuedMessage.channel,
      status: queuedMessage.status
    });

    return NextResponse.json({
      success: true,
      message_id: queuedMessage.id,
      status: queuedMessage.status,
      queued_at: queuedMessage.created_at
    });

  } catch (error) {
    console.error('❌ Error in queue endpoint:', error);
    return NextResponse.json(
      {
        error: 'Failed to queue message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
