/**
 * Fetch pending comments for approval workflow
 * GET /api/linkedin-commenting/pending-comments?workspace_id=xxx
 */

import { supabaseAdmin } from '@/app/lib/supabase';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authClient = await createSupabaseRouteClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Missing workspace_id parameter' },
        { status: 400 }
      );
    }

    // Verify user has access to this workspace
    const { data: membership } = await authClient
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Access denied to this workspace' }, { status: 403 });
    }

    console.log('📋 Fetching pending comments for workspace:', workspaceId);

    const supabase = supabaseAdmin();

    // Fetch comments that need review:
    // - pending_approval: awaiting manual approval
    // - scheduled: auto-approved, but can still be reviewed/edited before posting
    // Join with posts and monitors to get full context
    const { data: comments, error } = await supabase
      .from('linkedin_post_comments')
      .select(`
        id,
        comment_text,
        status,
        generated_at,
        scheduled_post_time,
        created_at,
        post:linkedin_posts_discovered!inner (
          id,
          author_name,
          author_profile_id,
          author_headline,
          post_content,
          share_url,
          post_date,
          engagement_metrics,
          monitor_id
        ),
        monitor:linkedin_post_monitors!linkedin_post_comments_monitor_id_fkey (
          id,
          name
        )
      `)
      .eq('workspace_id', workspaceId)
      .in('status', ['pending_approval', 'scheduled'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching pending comments:', error);
      return NextResponse.json(
        { error: 'Failed to fetch pending comments', details: error.message },
        { status: 500 }
      );
    }

    console.log(`✅ Found ${comments?.length || 0} pending comments`);

    return NextResponse.json({
      success: true,
      comments: comments || [],
      count: comments?.length || 0
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
