import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');
    const status = searchParams.get('status') || 'pending';
    const monitorId = searchParams.get('monitor_id');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();

    let query = supabase
      .from('linkedin_posts_discovered')
      .select(`
        id,
        monitor_id,
        post_id,
        post_url,
        post_author,
        post_author_headline,
        post_content,
        generated_comment,
        status,
        created_at,
        posted_at,
        linkedin_commenting_monitors!inner(name)
      `)
      .eq('workspace_id', workspaceId)
      .not('generated_comment', 'is', null);

    // Filter by status
    if (status === 'pending') {
      query = query.eq('status', 'pending');
    } else if (status === 'posted') {
      query = query.eq('status', 'posted');
    } else if (status === 'rejected') {
      query = query.eq('status', 'rejected');
    }

    // Filter by monitor if specified
    if (monitorId) {
      query = query.eq('monitor_id', monitorId);
    }

    // Order by created_at, newest first for pending, most recent posted first
    query = query
      .order('created_at', { ascending: false })
      .limit(limit);

    const { data: comments, error } = await query;

    if (error) {
      console.error('Error fetching comments:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform to include campaign name
    const transformedComments = comments?.map(c => ({
      id: c.id,
      monitor_id: c.monitor_id,
      post_id: c.post_id,
      post_url: c.post_url,
      post_author: c.post_author,
      post_author_headline: c.post_author_headline,
      post_content: c.post_content,
      generated_comment: c.generated_comment,
      status: c.status,
      created_at: c.created_at,
      posted_at: c.posted_at,
      campaign_name: (c.linkedin_commenting_monitors as any)?.name || 'Unknown Campaign'
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
