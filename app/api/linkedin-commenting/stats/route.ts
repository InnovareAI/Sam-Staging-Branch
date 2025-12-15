import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, supabaseAdmin } from '@/app/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
    }

    // Use admin client to bypass RLS
    const supabase = supabaseAdmin();

    // Get total and active profiles (monitors)
    const { data: monitors, error: monitorsError } = await supabase
      .from('linkedin_post_monitors')
      .select('id, status, hashtags')
      .eq('workspace_id', workspaceId);

    if (monitorsError) {
      console.error('Error fetching monitors:', monitorsError);
    }

    const totalProfiles = monitors?.length || 0;
    const activeProfiles = monitors?.filter(m => m.status === 'active').length || 0;

    // Count profiles monitored (extract from hashtags with PROFILE: prefix)
    let profilesMonitored = 0;
    monitors?.forEach(m => {
      const profiles = m.hashtags?.filter((h: string) => h.startsWith('PROFILE:'));
      profilesMonitored += profiles?.length || 0;
    });

    // Get pending comments count
    const { count: pendingComments, error: pendingError } = await supabase
      .from('linkedin_posts_discovered')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'pending');

    if (pendingError) {
      console.error('Error fetching pending comments:', pendingError);
    }

    // Get today's posted comments
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count: postedToday, error: postedTodayError } = await supabase
      .from('linkedin_posts_discovered')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'posted')
      .gte('posted_at', today.toISOString());

    if (postedTodayError) {
      console.error('Error fetching posted today:', postedTodayError);
    }

    // Get this week's posted comments
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { count: postedThisWeek, error: postedWeekError } = await supabase
      .from('linkedin_posts_discovered')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'posted')
      .gte('posted_at', weekAgo.toISOString());

    if (postedWeekError) {
      console.error('Error fetching posted this week:', postedWeekError);
    }

    // Calculate engagement rate (posted / generated)
    const { count: totalGenerated, error: generatedError } = await supabase
      .from('linkedin_posts_discovered')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .not('generated_comment', 'is', null);

    const { count: totalPosted, error: totalPostedError } = await supabase
      .from('linkedin_posts_discovered')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'posted');

    const engagementRate = totalGenerated && totalGenerated > 0
      ? Math.round((totalPosted || 0) / totalGenerated * 100)
      : 0;

    return NextResponse.json({
      total_profiles: totalProfiles,
      active_profiles: activeProfiles,
      pending_comments: pendingComments || 0,
      posted_today: postedToday || 0,
      posted_this_week: postedThisWeek || 0,
      engagement_rate: engagementRate,
      profiles_monitored: profilesMonitored
    });

  } catch (error) {
    console.error('Error in stats endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
