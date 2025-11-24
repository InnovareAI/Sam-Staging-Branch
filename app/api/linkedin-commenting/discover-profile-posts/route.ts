import { createServerSupabaseClient } from '@/app/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * API Route: Discover posts from LinkedIn profiles
 *
 * This endpoint:
 * 1. Fetches monitors with PROFILE: hashtag prefix
 * 2. Gets last 100 posts from each profile via Unipile
 * 3. Filters posts by age (last 24 hours by default)
 * 4. Stores new posts in linkedin_posts_discovered table
 *
 * Usage: Called by N8N workflow or cron job
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    console.log('🔍 Starting profile post discovery...');

    // Fetch all active monitors with PROFILE: prefix
    const { data: monitors, error: monitorsError } = await supabase
      .from('linkedin_post_monitors')
      .select('*')
      .eq('status', 'active');

    if (monitorsError) {
      console.error('❌ Error fetching monitors:', monitorsError);
      return NextResponse.json({ error: monitorsError.message }, { status: 500 });
    }

    if (!monitors || monitors.length === 0) {
      console.log('ℹ️ No active monitors found');
      return NextResponse.json({ message: 'No active monitors', discovered: 0 });
    }

    console.log(`📋 Found ${monitors.length} active monitors`);

    // Filter for profile monitors only (hashtags contain PROFILE:)
    const profileMonitors = monitors.filter(m =>
      m.hashtags?.some((h: string) => h.startsWith('PROFILE:'))
    );

    console.log(`👤 Found ${profileMonitors.length} profile monitors`);

    let totalDiscovered = 0;

    // Get workspace LinkedIn account from database
    const workspaceId = profileMonitors[0]?.workspace_id;
    if (!workspaceId) {
      return Response.json({ success: false, error: 'No workspace found' });
    }

    const { data: workspaceAccount, error: accountError } = await supabase
      .from('workspace_accounts')
      .select('unipile_account_id, unipile_dsn, unipile_api_key')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'linkedin')
      .eq('status', 'active')
      .single();

    if (accountError || !workspaceAccount) {
      console.error('❌ No active LinkedIn account for workspace:', workspaceId);
      return Response.json({
        success: false,
        error: 'No active LinkedIn account configured for workspace'
      });
    }

    const UNIPILE_DSN = workspaceAccount.unipile_dsn;
    const UNIPILE_API_KEY = workspaceAccount.unipile_api_key;
    const ACCOUNT_ID = workspaceAccount.unipile_account_id;

    console.log(`✅ Using workspace account: ${ACCOUNT_ID}`);

    // Process each profile monitor
    for (const monitor of profileMonitors) {
      try {
        // Extract vanity name from PROFILE:vanity_name
        const profileHashtag = monitor.hashtags.find((h: string) => h.startsWith('PROFILE:'));
        if (!profileHashtag) continue;

        const vanityName = profileHashtag.replace('PROFILE:', '');
        console.log(`\n🔍 Processing profile: ${vanityName}`);

        const profileUrl = `https://${UNIPILE_DSN}/api/v1/users/${vanityName}?account_id=${ACCOUNT_ID}`;
        const profileResponse = await fetch(profileUrl, {
          method: 'GET',
          headers: { 'X-API-KEY': UNIPILE_API_KEY }
        });

        if (!profileResponse.ok) {
          console.error(`❌ Failed to lookup profile ${vanityName}: ${profileResponse.status}`);
          continue;
        }

        const profile = await profileResponse.json();
        console.log(`✅ Profile found: ${profile.first_name} ${profile.last_name}`);

        // Step 2: Fetch posts using the correct Unipile endpoint
        const postsUrl = `https://${UNIPILE_DSN}/api/v1/users/${vanityName}/posts?account_id=${ACCOUNT_ID}`;
        const postsResponse = await fetch(postsUrl, {
          method: 'GET',
          headers: {
            'X-API-KEY': UNIPILE_API_KEY,
            'Accept': 'application/json'
          }
        });

        if (!postsResponse.ok) {
          console.error(`❌ Failed to fetch posts for ${vanityName}: ${postsResponse.status}`);
          const errorText = await postsResponse.text();
          console.error(`   Error: ${errorText}`);
          continue;
        }

        const postsData = await postsResponse.json();
        const posts = postsData.items || [];
        console.log(`📝 Retrieved ${posts.length} posts from profile`);

        // Step 3: Filter posts by age (last 24 hours)
        const maxAgeHours = 24; // Could be pulled from monitor settings if needed
        const cutoffDate = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));

        const recentPosts = posts.filter((post: any) => {
          if (!post.date) return false;
          const postDate = new Date(post.date);
          return postDate >= cutoffDate;
        });

        console.log(`⏰ Found ${recentPosts.length} posts from last ${maxAgeHours} hours`);

        // Step 4: Check which posts are already discovered
        const existingSocialIds = recentPosts.map((p: any) => p.social_id);
        const { data: existingPosts } = await supabase
          .from('linkedin_posts_discovered')
          .select('social_id')
          .in('social_id', existingSocialIds);

        const existingSet = new Set(existingPosts?.map(p => p.social_id) || []);
        const newPosts = recentPosts.filter((p: any) => !existingSet.has(p.social_id));

        console.log(`🆕 Found ${newPosts.length} new posts to store`);

        // Step 5: Store new posts
        if (newPosts.length > 0) {
          const postsToInsert = newPosts.map((post: any) => ({
            workspace_id: monitor.workspace_id,
            monitor_id: monitor.id,
            social_id: post.social_id,
            share_url: post.share_url,
            post_content: post.text,
            author_name: `${profile.first_name} ${profile.last_name}`,
            author_profile_id: profile.provider_id,
            hashtags: post.hashtags || [],
            post_date: post.date,
            engagement_metrics: {
              comments: post.comment_counter || 0,
              reactions: post.reaction_counter || 0,
              reposts: post.repost_counter || 0
            },
            status: 'discovered'
          }));

          const { error: insertError } = await supabase
            .from('linkedin_posts_discovered')
            .insert(postsToInsert);

          if (insertError) {
            console.error(`❌ Error inserting posts:`, insertError);
          } else {
            totalDiscovered += newPosts.length;
            console.log(`✅ Stored ${newPosts.length} new posts`);
          }
        }

      } catch (error) {
        console.error(`❌ Error processing monitor ${monitor.id}:`, error);
        continue;
      }
    }

    console.log(`\n✅ Discovery complete: ${totalDiscovered} new posts discovered`);

    return NextResponse.json({
      success: true,
      monitorsProcessed: profileMonitors.length,
      postsDiscovered: totalDiscovered
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
