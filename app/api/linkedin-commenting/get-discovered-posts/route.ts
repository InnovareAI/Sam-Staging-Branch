import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Get discovered LinkedIn posts
 * Supports filtering by monitor_id for UI display
 * No authentication needed - uses service role key
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const poolKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const monitorId = searchParams.get('monitor_id');
    const status = searchParams.get('status') || 'discovered';
    const limit = parseInt(searchParams.get('limit') || '10');

    // Build query
    let query = supabase
      .from('linkedin_posts_discovered')
      .select('*, linkedin_post_monitors(workspace_id, name, hashtags)')
      .eq('status', status)
      .order('post_date', { ascending: false })
      .limit(limit);

    // Add monitor filter if provided
    if (monitorId) {
      query = query.eq('monitor_id', monitorId);
    }

    const { data: posts, error } = await query;

    if (error) {
      console.error('Error fetching posts:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Flatten the response for easier N8N consumption
    const flattenedPosts = posts?.map(post => ({
      ...post,
      workspace_id: post.linkedin_post_monitors?.workspace_id
    })) || [];

    return NextResponse.json(flattenedPosts);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
