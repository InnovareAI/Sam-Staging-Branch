import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Mark a discovered post as processed
 * Called by N8N after comment is saved
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await request.json();
    const { post_id } = body;

    if (!post_id) {
      return NextResponse.json({
        error: 'Missing required field: post_id'
      }, { status: 400 });
    }

    // Update post status to 'commented' (final state after comment is posted)
    // NOTE: Do NOT set to 'processing' - that breaks the auto-generate flow
    // If you need an intermediate state, use 'comment_pending' (set by auto-generate-comments)
    const { data, error } = await supabase
      .from('linkedin_posts_discovered')
      .update({
        status: 'commented',
        comment_generated_at: new Date().toISOString()
      })
      .eq('id', post_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating post:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      post_id: data.id,
      status: 'commented'
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
