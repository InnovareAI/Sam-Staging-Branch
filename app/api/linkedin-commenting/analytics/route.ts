import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/app/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');
    const range = searchParams.get('range') || '30d';

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();

    // Calculate date range
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get overview stats
    const { count: totalPostsDiscovered } = await supabase
      .from('linkedin_posts_discovered')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .gte('created_at', startDate.toISOString());

    const { count: totalCommentsGenerated } = await supabase
      .from('linkedin_posts_discovered')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .not('generated_comment', 'is', null)
      .gte('created_at', startDate.toISOString());

    const { count: totalCommentsPosted } = await supabase
      .from('linkedin_posts_discovered')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'posted')
      .gte('posted_at', startDate.toISOString());

    const { count: totalCommentsRejected } = await supabase
      .from('linkedin_posts_discovered')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'rejected')
      .gte('created_at', startDate.toISOString());

    const approvalRate = totalCommentsGenerated && totalCommentsGenerated > 0
      ? Math.round((totalCommentsPosted || 0) / totalCommentsGenerated * 100)
      : 0;

    const avgCommentsPerDay = days > 0
      ? Math.round(((totalCommentsPosted || 0) / days) * 10) / 10
      : 0;

    // Get daily trends
    const { data: dailyPosts } = await supabase
      .from('linkedin_posts_discovered')
      .select('created_at, status, posted_at')
      .eq('workspace_id', workspaceId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    // Aggregate by day
    const trendMap = new Map<string, { posts_discovered: number; comments_posted: number }>();

    // Initialize all days in range
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      const dateStr = date.toISOString().split('T')[0];
      trendMap.set(dateStr, { posts_discovered: 0, comments_posted: 0 });
    }

    // Count posts discovered
    dailyPosts?.forEach(post => {
      const dateStr = new Date(post.created_at).toISOString().split('T')[0];
      const existing = trendMap.get(dateStr);
      if (existing) {
        existing.posts_discovered++;
      }
    });

    // Count posts posted
    dailyPosts?.filter(p => p.status === 'posted' && p.posted_at).forEach(post => {
      const dateStr = new Date(post.posted_at).toISOString().split('T')[0];
      const existing = trendMap.get(dateStr);
      if (existing) {
        existing.comments_posted++;
      }
    });

    const trends = Array.from(trendMap.entries()).map(([date, stats]) => ({
      date,
      ...stats
    }));

    // Get top campaigns
    const { data: campaigns } = await supabase
      .from('linkedin_commenting_monitors')
      .select(`
        id,
        name,
        linkedin_posts_discovered(status)
      `)
      .eq('workspace_id', workspaceId);

    const topCampaigns = campaigns?.map(c => {
      const posts = (c.linkedin_posts_discovered as any[]) || [];
      const postsDiscovered = posts.length;
      const commentsPosted = posts.filter(p => p.status === 'posted').length;
      const generated = posts.filter(p => p.status !== 'discovered').length;
      const approvalRate = generated > 0 ? Math.round((commentsPosted / generated) * 100) : 0;

      return {
        id: c.id,
        name: c.name || 'Unnamed Campaign',
        posts_discovered: postsDiscovered,
        comments_posted: commentsPosted,
        approval_rate: approvalRate
      };
    }).sort((a, b) => b.comments_posted - a.comments_posted).slice(0, 5) || [];

    // Get top engaged profiles
    const { data: profileData } = await supabase
      .from('linkedin_posts_discovered')
      .select('post_author, status')
      .eq('workspace_id', workspaceId)
      .gte('created_at', startDate.toISOString());

    const profileMap = new Map<string, { posts_count: number; comments_posted: number }>();
    profileData?.forEach(post => {
      const existing = profileMap.get(post.post_author) || { posts_count: 0, comments_posted: 0 };
      existing.posts_count++;
      if (post.status === 'posted') {
        existing.comments_posted++;
      }
      profileMap.set(post.post_author, existing);
    });

    const topProfiles = Array.from(profileMap.entries())
      .map(([profile, stats]) => ({ profile, ...stats }))
      .sort((a, b) => b.comments_posted - a.comments_posted)
      .slice(0, 5);

    return NextResponse.json({
      overview: {
        total_posts_discovered: totalPostsDiscovered || 0,
        total_comments_generated: totalCommentsGenerated || 0,
        total_comments_posted: totalCommentsPosted || 0,
        total_comments_rejected: totalCommentsRejected || 0,
        approval_rate: approvalRate,
        avg_comments_per_day: avgCommentsPerDay
      },
      trends,
      top_campaigns: topCampaigns,
      top_profiles: topProfiles
    });

  } catch (error) {
    console.error('Error in analytics endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
