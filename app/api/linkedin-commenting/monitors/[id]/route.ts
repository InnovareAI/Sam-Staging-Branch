import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/lib/supabase';

export const dynamic = 'force-dynamic';

// GET - Get a single monitor
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const monitorId = params.id;
    const supabase = await createServerSupabaseClient();

    const { data: monitor, error } = await supabase
      .from('linkedin_post_monitors')
      .select('*')
      .eq('id', monitorId)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(monitor);

  } catch (error) {
    console.error('Error fetching monitor:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monitor' },
      { status: 500 }
    );
  }
}

// PATCH - Update a monitor
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const monitorId = params.id;
    const body = await request.json();
    const supabase = await createServerSupabaseClient();

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.hashtags !== undefined) updateData.hashtags = body.hashtags;
    if (body.keywords !== undefined) updateData.keywords = body.keywords;
    if (body.timezone !== undefined) updateData.timezone = body.timezone;
    if (body.daily_start_time !== undefined) updateData.daily_start_time = body.daily_start_time;
    if (body.auto_approve_enabled !== undefined) updateData.auto_approve_enabled = body.auto_approve_enabled;
    if (body.auto_approve_start_time !== undefined) updateData.auto_approve_start_time = body.auto_approve_start_time;
    if (body.auto_approve_end_time !== undefined) updateData.auto_approve_end_time = body.auto_approve_end_time;

    const { data: monitor, error } = await supabase
      .from('linkedin_post_monitors')
      .update(updateData)
      .eq('id', monitorId)
      .select()
      .single();

    if (error) {
      console.error('Error updating monitor:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      monitor,
      message: 'Monitor updated successfully'
    });

  } catch (error) {
    console.error('Error updating monitor:', error);
    return NextResponse.json(
      { error: 'Failed to update monitor' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a monitor
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const monitorId = params.id;
    const supabase = await createServerSupabaseClient();

    // First delete associated discovered posts
    const { error: postsError } = await supabase
      .from('linkedin_posts_discovered')
      .delete()
      .eq('monitor_id', monitorId);

    if (postsError) {
      console.error('Error deleting associated posts:', postsError);
    }

    // Then delete the monitor
    const { error } = await supabase
      .from('linkedin_post_monitors')
      .delete()
      .eq('id', monitorId);

    if (error) {
      console.error('Error deleting monitor:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Monitor deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting monitor:', error);
    return NextResponse.json(
      { error: 'Failed to delete monitor' },
      { status: 500 }
    );
  }
}
