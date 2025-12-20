import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');
    const status = searchParams.get('status') || 'pending_approval';
    const monitorId = searchParams.get('monitor_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const countOnly = searchParams.get('count_only') === 'true';
    const dateFilter = searchParams.get('date_filter'); // 'today' or 'history'

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();

    // If count_only, just return the count
    if (countOnly) {
      let countQuery = supabase
        .from('linkedin_post_comments')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('status', status);

      if (monitorId) {
        countQuery = countQuery.eq('monitor_id', monitorId);
      }

      if (dateFilter === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        countQuery = countQuery.gte('created_at', today.toISOString());
      } else if (dateFilter === 'history') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        countQuery = countQuery.lt('created_at', today.toISOString());
      }

      const { count, error } = await countQuery;

      if (error) {
        console.error('Error counting comments:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ count: count || 0 });
    }

    // Fetch comments from linkedin_post_comments table with joined post data
    let query = supabase
      .from('linkedin_post_comments')
      .select(`
        id,
        workspace_id,
        monitor_id,
        post_id,
        comment_text,
        edited_comment_text,
        status,
        generated_at,
        approved_at,
        rejected_at,
        posted_at,
        scheduled_post_time,
        created_at,
        linkedin_posts_discovered(
          share_url,
          author_name,
          author_headline,
          post_content
        ),
        linkedin_post_monitors(name)
      `)
      .eq('workspace_id', workspaceId)
      .eq('status', status);

    // Filter by monitor if specified
    if (monitorId) {
      query = query.eq('monitor_id', monitorId);
    }

    // Filter by date
    if (dateFilter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      query = query.gte('created_at', today.toISOString());
    } else if (dateFilter === 'history') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      query = query.lt('created_at', today.toISOString());
    }

    // Order by appropriate date field based on status
    if (status === 'posted') {
      query = query.order('posted_at', { ascending: false });
    } else if (status === 'scheduled') {
      query = query.order('scheduled_post_time', { ascending: true });
    } else if (status === 'rejected') {
      query = query.order('rejected_at', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    query = query.limit(limit);

    const { data: comments, error } = await query;

    if (error) {
      console.error('Error fetching comments:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform to the expected format
    const transformedComments = comments?.map(c => ({
      id: c.id,
      monitor_id: c.monitor_id,
      post_id: c.post_id,
      post_url: (c.linkedin_posts_discovered as any)?.share_url || '',
      post_author: (c.linkedin_posts_discovered as any)?.author_name || 'Unknown',
      post_author_headline: (c.linkedin_posts_discovered as any)?.author_headline || '',
      post_content: (c.linkedin_posts_discovered as any)?.post_content || '',
      generated_comment: c.edited_comment_text || c.comment_text,
      status: c.status,
      created_at: c.created_at,
      scheduled_for: c.scheduled_post_time,
      posted_at: c.posted_at,
      rejected_at: c.rejected_at,
      campaign_name: (c.linkedin_post_monitors as any)?.name || 'Unknown Campaign'
    }));

    return NextResponse.json({ comments: transformedComments || [] });

  } catch (error) {
    console.error('Error in comments endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}
