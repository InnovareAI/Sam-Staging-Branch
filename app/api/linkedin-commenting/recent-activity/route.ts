import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();

    // Get recent activity - posts discovered, comments pending, comments posted
    const { data: activities, error } = await supabase
      .from('linkedin_posts_discovered')
      .select(`
        id,
        post_author,
        post_content,
        generated_comment,
        status,
        created_at,
        posted_at
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching recent activity:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform to activity format
    const transformedActivities = activities?.map(a => {
      let type: 'posted' | 'pending' | 'discovered' = 'discovered';
      let timestamp = a.created_at;

      if (a.status === 'posted') {
        type = 'posted';
        timestamp = a.posted_at || a.created_at;
      } else if (a.status === 'pending' && a.generated_comment) {
        type = 'pending';
      }

      return {
        id: a.id,
        type,
        post_author: a.post_author,
        post_snippet: a.post_content?.substring(0, 100) + (a.post_content?.length > 100 ? '...' : ''),
        comment_snippet: a.generated_comment?.substring(0, 80) + (a.generated_comment?.length > 80 ? '...' : ''),
        timestamp
      };
    });

    return NextResponse.json({ activities: transformedActivities || [] });

  } catch (error) {
    console.error('Error in recent-activity endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent activity' },
      { status: 500 }
    );
  }
}
