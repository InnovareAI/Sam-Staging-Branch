import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Save AI-generated comment to approval queue
 * Called by N8N after generating comment
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await request.json();
    const {
      workspace_id,
      post_id,
      post_social_id,
      comment_text,
      generated_by = 'claude',
      generation_model = 'claude-3.5-sonnet'
    } = body;

    // Validate required fields
    if (!workspace_id || !post_id || !post_social_id || !comment_text) {
      return NextResponse.json({
        error: 'Missing required fields',
        required: ['workspace_id', 'post_id', 'post_social_id', 'comment_text']
      }, { status: 400 });
    }

    // Insert comment into queue
    const { data, error } = await supabase
      .from('linkedin_comment_queue')
      .insert({
        workspace_id,
        post_id,
        post_social_id,
        comment_text,
        requires_approval: true,
        status: 'pending',
        generated_by,
        generation_model,
        comment_length: comment_text.length
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving comment:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      comment_id: data.id,
      status: 'pending'
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
