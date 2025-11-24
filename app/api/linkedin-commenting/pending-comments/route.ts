/**
 * Fetch pending comments for approval workflow
 * GET /api/linkedin-commenting/pending-comments?workspace_id=xxx
 */

import { supabaseAdmin } from '@/app/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Missing workspace_id parameter' },
        { status: 400 }
      );
    }

    console.log('📋 Fetching pending comments for workspace:', workspaceId);

    const supabase = supabaseAdmin();

    // Fetch comments with status = 'pending_approval'
    // Join with posts and monitors to get full context
    const { data: comments, error } = await supabase
      .from('linkedin_post_comments')
      .select(`
        id,
        comment_text,
        status,
        generated_at,
        scheduled_post_time,
        post:linkedin_posts_discovered!inner (
          id,
          author_name,
          author_profile_id,
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
      .eq('status', 'pending_approval')
      .order('generated_at', { ascending: false });

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
