/**
 * Follow-up Agent - Poll Ready Follow-ups
 * N8N polls this endpoint every minute to get follow-ups ready to send
 */

import { createClient } from '@/app/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Verify N8N internal trigger
    const triggerHeader = request.headers.get('x-internal-trigger');
    if (triggerHeader !== 'n8n-followup-agent') {
      return NextResponse.json(
        { error: 'Unauthorized - N8N trigger required' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    // Query the follow_ups_ready_to_send view
    const { data: readyFollowUps, error } = await supabase
      .from('follow_ups_ready_to_send')
      .select('*')
      .limit(10); // Process max 10 follow-ups per poll

    if (error) {
      console.error('❌ Error fetching ready follow-ups:', error);
      return NextResponse.json(
        { error: 'Database error', details: error.message },
        { status: 500 }
      );
    }

    console.log(`📊 Follow-ups ready to send: ${readyFollowUps?.length || 0}`);

    // Return empty array if no follow-ups ready
    if (!readyFollowUps || readyFollowUps.length === 0) {
      return NextResponse.json({ follow_ups: [] });
    }

    // Return follow-ups with structured data
    return NextResponse.json({
      follow_ups: readyFollowUps,
      count: readyFollowUps.length,
      polled_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error in poll-ready endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
