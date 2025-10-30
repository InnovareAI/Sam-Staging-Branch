/**
 * Follow-up Agent - Update Follow-up Status
 * Called by N8N after successfully queueing a follow-up message
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify N8N internal trigger
    const triggerHeader = request.headers.get('x-internal-trigger');
    if (triggerHeader !== 'n8n-followup-agent') {
      return NextResponse.json(
        { error: 'Unauthorized - N8N trigger required' },
        { status: 401 }
      );
    }

    const followUpId = params.id;
    const body = await request.json();

    if (!body.status) {
      return NextResponse.json(
        { error: 'Missing required field: status' },
        { status: 400 }
      );
    }

    console.log('📝 Updating follow-up status:', {
      follow_up_id: followUpId,
      new_status: body.status
    });

    const supabase = await createClient();

    // Update follow-up status
    const updateData: any = {
      status: body.status,
      updated_at: new Date().toISOString()
    };

    // Add sent_at if status is 'sent'
    if (body.status === 'sent' && body.sent_at) {
      updateData.sent_at = body.sent_at;
    }

    const { data: updatedFollowUp, error } = await supabase
      .from('prospect_follow_ups')
      .update(updateData)
      .eq('id', followUpId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating follow-up status:', error);
      return NextResponse.json(
        { error: 'Database error', details: error.message },
        { status: 500 }
      );
    }

    console.log('✅ Follow-up status updated:', {
      follow_up_id: followUpId,
      status: updatedFollowUp.status,
      attempt: updatedFollowUp.follow_up_attempt
    });

    return NextResponse.json({
      success: true,
      follow_up: updatedFollowUp
    });

  } catch (error) {
    console.error('❌ Error in status update endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
