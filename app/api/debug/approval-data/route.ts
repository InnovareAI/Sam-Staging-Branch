import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
    const userId = 'f6885ff3-deef-4781-8721-93011c990b1b'; // tl@innovareai.com

    // Get sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from('prospect_approval_sessions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(5);

    // Get prospects for first session
    let prospects = null;
    if (sessions && sessions.length > 0) {
      const { data: prospectsData } = await supabase
        .from('prospect_approval_data')
        .select('*')
        .eq('session_id', sessions[0].id)
        .limit(5);

      prospects = prospectsData;
    }

    return NextResponse.json({
      success: true,
      workspace_id: workspaceId,
      user_id: userId,
      sessions: sessions?.map(s => ({
        id: s.id.substring(0, 8),
        campaign_name: s.campaign_name,
        total_prospects: s.total_prospects,
        created_at: s.created_at
      })),
      first_session_prospects: prospects?.length || 0,
      sample_prospects: prospects?.slice(0, 2).map(p => ({
        name: p.name,
        title: p.title,
        company: p.company
      })),
      error: sessionsError?.message
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
