import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Simple API endpoint for N8N to get discovered posts
 * No authentication needed - uses service role key
 */
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: posts, error } = await supabase
      .from('linkedin_posts_discovered')
      .select('*, linkedin_post_monitors(workspace_id)')
      .eq('status', 'discovered')
      .order('post_date', { ascending: false })
      .limit(10);

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
