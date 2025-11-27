/**
 * Fetch posted comments history
 * GET /api/linkedin-commenting/posted-comments?workspace_id=xxx
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
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

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

    console.log('📜 Fetching posted comments history for workspace:', workspaceId);

    const supabase = supabaseAdmin();

    // Fetch posted comments with engagement metrics from the main table
    const { data: comments, error, count } = await supabase
      .from('linkedin_post_comments')
      .select(`
        id,
        comment_text,
        posted_at,
        linkedin_comment_id,
        engagement_metrics,
        engagement_checked_at,
        post:linkedin_posts_discovered!inner (
          id,
          author_name,
          author_profile_id,
          author_title,
          post_content,
          share_url,
          post_date,
          engagement_metrics
        )
      `, { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .eq('status', 'posted')
      .order('posted_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('❌ Error fetching posted comments:', error);
      return NextResponse.json(
        { error: 'Failed to fetch posted comments', details: error.message },
        { status: 500 }
      );
    }

    console.log(`✅ Found ${comments?.length || 0} posted comments (total: ${count})`);

    return NextResponse.json({
      success: true,
      comments: comments || [],
      count: comments?.length || 0,
      total: count || 0,
      hasMore: (offset + limit) < (count || 0)
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
