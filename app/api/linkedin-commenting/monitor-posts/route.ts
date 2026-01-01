import { pool } from '@/lib/db';
import { createServerSupabaseClient } from '@/app/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Get all posts for a specific monitor with their comments
 * GET /api/linkedin-commenting/monitor-posts?monitor_id=xxx&limit=100
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const poolKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    // Verify user is authenticated
    const authSupabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await authSupabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const monitorId = searchParams.get('monitor_id');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!monitorId) {
      return NextResponse.json({ error: 'monitor_id is required' }, { status: 400 });
    }

    // Get monitor to verify workspace access
    const { data: monitor } = await adminClient
      .from('linkedin_post_monitors')
      .select('workspace_id')
      .eq('id', monitorId)
      .single();

    if (!monitor) {
      return NextResponse.json({ error: 'Monitor not found' }, { status: 404 });
    }

    // Verify user has access to this workspace
    const { data: member } = await adminClient
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', monitor.workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get posts for this monitor
    const { data: posts, error: postsError } = await adminClient
      .from('linkedin_posts_discovered')
      .select('*')
      .eq('monitor_id', monitorId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (postsError) {
      console.error('Error fetching posts:', postsError);
      return NextResponse.json({ error: postsError.message }, { status: 500 });
    }

    if (!posts || posts.length === 0) {
      return NextResponse.json({ posts: [] });
    }

    // Get comments for these posts
    const postIds = posts.map(p => p.id);
    const { data: comments, error: commentsError } = await adminClient
      .from('linkedin_post_comments')
      .select('*')
      .in('post_id', postIds);

    if (commentsError) {
      console.error('Error fetching comments:', commentsError);
      // Continue without comments rather than failing
    }

    // Create a map of post_id -> comment
    const commentMap = new Map<string, any>();
    if (comments) {
      for (const comment of comments) {
        // Keep the most recent comment for each post
        if (!commentMap.has(comment.post_id) ||
            new Date(comment.created_at) > new Date(commentMap.get(comment.post_id).created_at)) {
          commentMap.set(comment.post_id, {
            id: comment.id,
            comment_text: comment.comment_text,
            status: comment.status,
            scheduled_post_time: comment.scheduled_post_time,
            posted_at: comment.posted_at,
            created_at: comment.created_at
          });
        }
      }
    }

    // Combine posts with their comments
    const postsWithComments = posts.map(post => ({
      id: post.id,
      author_name: post.author_name,
      author_headline: post.author_headline,
      post_content: post.post_content,
      share_url: post.share_url,
      post_date: post.post_date,
      status: post.status,
      hashtags: post.hashtags,
      created_at: post.created_at,
      comment: commentMap.get(post.id) || null
    }));

    return NextResponse.json({ posts: postsWithComments });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
