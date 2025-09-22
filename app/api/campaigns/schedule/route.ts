import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient();
    
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all'; // 'upcoming', 'active', 'completed', 'cancelled', 'all'

    // Get scheduled campaigns
    let query = supabase
      .from('campaign_schedules')
      .select(`
        *,
        campaigns!inner(
          id,
          name,
          description,
          campaign_type,
          workspace_id,
          status
        )
      `)
      .eq('campaigns.workspace_id', user.user_metadata.workspace_id);

    // Filter by status
    if (status !== 'all') {
      query = query.eq('schedule_status', status);
    }

    // Order by scheduled start date
    query = query.order('scheduled_start_time', { ascending: true });

    const { data: schedules, error } = await query;

    if (error) {
      console.error('Failed to fetch campaign schedules:', error);
      return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 });
    }

    // Group schedules by status
    const now = new Date();
    const groupedSchedules = {
      upcoming: schedules?.filter(s => 
        s.schedule_status === 'scheduled' && 
        new Date(s.scheduled_start_time) > now
      ) || [],
      active: schedules?.filter(s => 
        s.schedule_status === 'active' || 
        (s.schedule_status === 'scheduled' && 
         new Date(s.scheduled_start_time) <= now && 
         (!s.scheduled_end_time || new Date(s.scheduled_end_time) > now))
      ) || [],
      completed: schedules?.filter(s => s.schedule_status === 'completed') || [],
      cancelled: schedules?.filter(s => s.schedule_status === 'cancelled') || []
    };

    return NextResponse.json({
      schedules: schedules || [],
      grouped: groupedSchedules,
      counts: {
        upcoming: groupedSchedules.upcoming.length,
        active: groupedSchedules.active.length,
        completed: groupedSchedules.completed.length,
        cancelled: groupedSchedules.cancelled.length,
        total: schedules?.length || 0
      }
    });

  } catch (error: any) {
    console.error('Campaign schedule fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign schedules', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      campaign_id,
      scheduled_start_time,
      scheduled_end_time,
      timezone = 'UTC',
      repeat_frequency, // 'none', 'daily', 'weekly', 'monthly'
      repeat_until,
      priority = 'normal', // 'low', 'normal', 'high'
      max_daily_messages,
      notes
    } = await req.json();

    if (!campaign_id || !scheduled_start_time) {
      return NextResponse.json({ 
        error: 'Campaign ID and scheduled start time are required' 
      }, { status: 400 });
    }

    // Verify campaign exists and user has access
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name, workspace_id, status')
      .eq('id', campaign_id)
      .eq('workspace_id', user.user_metadata.workspace_id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found or access denied' }, { status: 404 });
    }

    // Create schedule
    const { data: schedule, error } = await supabase
      .from('campaign_schedules')
      .insert({
        campaign_id,
        scheduled_start_time,
        scheduled_end_time,
        timezone,
        repeat_frequency: repeat_frequency || 'none',
        repeat_until,
        priority,
        max_daily_messages,
        notes,
        schedule_status: 'scheduled',
        created_by: user.id
      })
      .select(`
        *,
        campaigns!inner(
          id,
          name,
          description,
          campaign_type,
          workspace_id,
          status
        )
      `)
      .single();

    if (error) {
      console.error('Failed to create campaign schedule:', error);
      return NextResponse.json({ 
        error: 'Failed to create schedule',
        details: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Campaign scheduled successfully',
      schedule,
      campaign: {
        id: campaign.id,
        name: campaign.name
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('Campaign scheduling error:', error);
    return NextResponse.json(
      { error: 'Failed to schedule campaign', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = createClient();
    
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      schedule_id,
      action, // 'start', 'pause', 'resume', 'cancel', 'update'
      scheduled_start_time,
      scheduled_end_time,
      notes
    } = await req.json();

    if (!schedule_id || !action) {
      return NextResponse.json({ 
        error: 'Schedule ID and action are required' 
      }, { status: 400 });
    }

    let updateData: any = {
      updated_at: new Date().toISOString(),
      updated_by: user.id
    };

    switch (action) {
      case 'start':
        updateData.schedule_status = 'active';
        updateData.actual_start_time = new Date().toISOString();
        break;
      case 'pause':
        updateData.schedule_status = 'paused';
        updateData.paused_at = new Date().toISOString();
        break;
      case 'resume':
        updateData.schedule_status = 'active';
        updateData.resumed_at = new Date().toISOString();
        break;
      case 'cancel':
        updateData.schedule_status = 'cancelled';
        updateData.cancelled_at = new Date().toISOString();
        break;
      case 'complete':
        updateData.schedule_status = 'completed';
        updateData.completed_at = new Date().toISOString();
        break;
      case 'update':
        if (scheduled_start_time) updateData.scheduled_start_time = scheduled_start_time;
        if (scheduled_end_time) updateData.scheduled_end_time = scheduled_end_time;
        if (notes) updateData.notes = notes;
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const { data: schedule, error } = await supabase
      .from('campaign_schedules')
      .update(updateData)
      .eq('id', schedule_id)
      .select(`
        *,
        campaigns!inner(
          id,
          name,
          description,
          campaign_type,
          workspace_id,
          status
        )
      `)
      .eq('campaigns.workspace_id', user.user_metadata.workspace_id)
      .single();

    if (error) {
      console.error('Failed to update campaign schedule:', error);
      return NextResponse.json({ 
        error: 'Failed to update schedule',
        details: error.message 
      }, { status: 500 });
    }

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({
      message: `Schedule ${action}ed successfully`,
      schedule,
      action
    });

  } catch (error: any) {
    console.error('Campaign schedule update error:', error);
    return NextResponse.json(
      { error: 'Failed to update schedule', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient();
    
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const scheduleId = searchParams.get('schedule_id');

    if (!scheduleId) {
      return NextResponse.json({ error: 'Schedule ID is required' }, { status: 400 });
    }

    // Delete schedule (only if not active)
    const { data: schedule, error } = await supabase
      .from('campaign_schedules')
      .delete()
      .eq('id', scheduleId)
      .select(`
        *,
        campaigns!inner(workspace_id)
      `)
      .eq('campaigns.workspace_id', user.user_metadata.workspace_id)
      .eq('schedule_status', 'scheduled') // Only allow deletion of scheduled (not active) campaigns
      .single();

    if (error) {
      console.error('Failed to delete campaign schedule:', error);
      return NextResponse.json({ 
        error: 'Failed to delete schedule. Active schedules cannot be deleted.',
        details: error.message 
      }, { status: 500 });
    }

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found, access denied, or cannot be deleted' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Schedule deleted successfully'
    });

  } catch (error: any) {
    console.error('Campaign schedule deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete schedule', details: error.message },
      { status: 500 }
    );
  }
}