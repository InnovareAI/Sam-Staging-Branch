/**
 * Self-Post Monitor Individual API
 * GET /api/linkedin-commenting/self-post-monitors/{id} - Get monitor details
 * PUT /api/linkedin-commenting/self-post-monitors/{id} - Update monitor
 * DELETE /api/linkedin-commenting/self-post-monitors/{id} - Delete monitor
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * GET - Get single monitor with recent replies
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch monitor with replies
    const { data: monitor, error } = await supabase
      .from('linkedin_self_post_monitors')
      .select(`
        *,
        replies:linkedin_self_post_comment_replies(
          id,
          comment_text,
          commenter_name,
          reply_text,
          status,
          scheduled_post_time,
          posted_at,
          created_at
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Monitor not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Verify workspace membership
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', monitor.workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Not a workspace member' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      monitor
    });

  } catch (error) {
    console.error('Self-post monitor GET error:', error);
    return NextResponse.json({
      error: 'Failed to fetch monitor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * PUT - Update monitor settings
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Fetch existing monitor to verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from('linkedin_self_post_monitors')
      .select('workspace_id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Monitor not found' }, { status: 404 });
    }

    // Verify workspace membership
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', existing.workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Not a workspace member' }, { status: 403 });
    }

    // Build update object (only allow certain fields)
    const allowedFields = [
      'post_title',
      'reply_prompt',
      'reply_context',
      'is_active',
      'auto_approve_replies',
      'max_replies_per_day',
      'check_frequency_minutes',
      'reply_to_questions_only',
      'skip_single_word_comments',
      'min_comment_length'
    ];

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // Update monitor
    const { data: monitor, error: updateError } = await supabase
      .from('linkedin_self_post_monitors')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating monitor:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    console.log(`✅ Updated self-post monitor: ${id}`);

    return NextResponse.json({
      success: true,
      monitor,
      message: 'Monitor updated successfully'
    });

  } catch (error) {
    console.error('Self-post monitor PUT error:', error);
    return NextResponse.json({
      error: 'Failed to update monitor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * DELETE - Delete monitor and associated replies
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch existing monitor to verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from('linkedin_self_post_monitors')
      .select('workspace_id, post_title')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Monitor not found' }, { status: 404 });
    }

    // Verify workspace membership
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', existing.workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Not a workspace member' }, { status: 403 });
    }

    // Delete monitor (replies cascade delete via FK)
    const { error: deleteError } = await supabase
      .from('linkedin_self_post_monitors')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting monitor:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    console.log(`✅ Deleted self-post monitor: ${id} (${existing.post_title})`);

    return NextResponse.json({
      success: true,
      message: 'Monitor deleted successfully'
    });

  } catch (error) {
    console.error('Self-post monitor DELETE error:', error);
    return NextResponse.json({
      error: 'Failed to delete monitor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
