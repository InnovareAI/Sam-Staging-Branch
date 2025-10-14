import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's current workspace
    const { data: userData } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single();

    if (!userData?.current_workspace_id) {
      return NextResponse.json({ success: false, error: 'No workspace found' }, { status: 400 });
    }

    const body = await request.json();
    const { campaign_name, campaign_tag, source, prospects } = body;

    if (!prospects || prospects.length === 0) {
      return NextResponse.json({ success: false, error: 'No prospects provided' }, { status: 400 });
    }

    // Create approval session
    const { data: session, error: sessionError } = await supabase
      .from('prospect_approval_sessions')
      .insert({
        workspace_id: userData.current_workspace_id,
        user_id: user.id,
        campaign_name: campaign_name || 'Uploaded Prospects',
        campaign_tag: campaign_tag || 'manual-upload',
        prospect_source: source || 'manual-upload',
        total_prospects: prospects.length,
        pending_count: prospects.length,
        session_status: 'active'
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Error creating session:', sessionError);
      return NextResponse.json({ success: false, error: sessionError.message }, { status: 500 });
    }

    // Save prospects to approval data table
    const approvalData = prospects.map((p: any) => ({
      session_id: session.id,
      prospect_id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workspace_id: userData.current_workspace_id,
      name: p.name,
      title: p.title || '',
      company: p.company || { name: '' },
      location: p.location || '',
      contact: p.contact || { email: '', linkedin_url: '' },
      source: p.source || source || 'manual-upload',
      enrichment_score: p.enrichment_score || 70,
      approval_status: p.approval_status || 'pending'
    }));

    const { error: dataError } = await supabase
      .from('prospect_approval_data')
      .insert(approvalData);

    if (dataError) {
      console.error('Error saving prospects:', dataError);
      // Rollback session
      await supabase.from('prospect_approval_sessions').delete().eq('id', session.id);
      return NextResponse.json({ success: false, error: dataError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      session_id: session.id,
      count: prospects.length,
      campaign_name: campaign_name
    });

  } catch (error) {
    console.error('Upload prospects error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
