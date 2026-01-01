import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';

export const dynamic = 'force-dynamic';

/**
 * Parse relative date strings like "8h", "2d", "1w" into Date objects
 * Unipile returns dates in this format instead of ISO timestamps
 */
function parseRelativeDate(dateStr: string): Date | null {
  if (typeof dateStr !== 'string') return null;

  const match = dateStr.match(/^(\d+)([hdwmyn]|mo)$/);
  if (!match) return null;

  const [, num, unit] = match;
  const value = parseInt(num);
  const now = new Date();

  switch (unit) {
    case 'n': // now
      return now;
    case 'h': // hours
      return new Date(now.getTime() - value * 60 * 60 * 1000);
    case 'd': // days
      return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
    case 'w': // weeks
      return new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000);
    case 'mo': // months
      const monthsAgo = new Date(now);
      monthsAgo.setMonth(monthsAgo.getMonth() - value);
      return monthsAgo;
    case 'y': // years
      const yearsAgo = new Date(now);
      yearsAgo.setFullYear(yearsAgo.getFullYear() - value);
      return yearsAgo;
    default:
      return null;
  }
}

/**
 * API Route: Discover posts from LinkedIn Company Pages
 *
 * This endpoint:
 * 1. Fetches monitors with COMPANY: hashtag prefix
 * 2. Gets recent posts from each company page via Unipile
 * 3. Filters posts by age (last 72 hours)
 * 4. Stores new posts in linkedin_posts_discovered table
 *
 * Usage: Called by Netlify scheduled function or cron job
 */
export async function POST(request: NextRequest) {
  try {
    // Use admin client to bypass RLS policies - this is a system endpoint
    const supabase = pool;

    console.log('🏢 Starting company page post discovery...');

    // Fetch all active monitors with COMPANY: prefix
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

    // Filter for company monitors only (hashtags contain COMPANY:)
    const companyMonitors = monitors.filter(m =>
      m.hashtags?.some((h: string) => h.startsWith('COMPANY:'))
    );

    console.log(`🏢 Found ${companyMonitors.length} company page monitors`);

    if (companyMonitors.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No company monitors found',
        monitorsProcessed: 0,
        postsDiscovered: 0
      });
    }

    let totalDiscovered = 0;

    // Process monitors grouped by workspace to get the right LinkedIn account
    const monitorsByWorkspace = new Map<string, typeof companyMonitors>();
    for (const monitor of companyMonitors) {
      const wsId = monitor.workspace_id;
      if (!monitorsByWorkspace.has(wsId)) {
        monitorsByWorkspace.set(wsId, []);
      }
      monitorsByWorkspace.get(wsId)!.push(monitor);
    }

    const UNIPILE_DSN = process.env.UNIPILE_DSN || 'api6.unipile.com:13670';
    const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

    if (!UNIPILE_API_KEY) {
      console.error('❌ Missing UNIPILE_API_KEY');
      return NextResponse.json({ success: false, error: 'Unipile API key not configured' }, { status: 500 });
    }

    // Process each workspace's monitors
    for (const [workspaceId, wsMonitors] of monitorsByWorkspace) {
      // Get workspace LinkedIn account
      const { data: workspaceAccount, error: accountError } = await supabase
        .from('workspace_accounts')
        .select('unipile_account_id')
        .eq('workspace_id', workspaceId)
        .eq('account_type', 'linkedin')
        .in('connection_status', VALID_CONNECTION_STATUSES)
        .single();

      if (accountError || !workspaceAccount) {
        console.error(`❌ No active LinkedIn account for workspace: ${workspaceId}`);
        continue;
      }

      const ACCOUNT_ID = workspaceAccount.unipile_account_id;
      console.log(`✅ Using workspace account: ${ACCOUNT_ID} for workspace ${workspaceId}`);

      // Process each company monitor in this workspace
      for (const monitor of wsMonitors) {
        const companyHashtags = monitor.hashtags.filter((h: string) => h.startsWith('COMPANY:'));

        for (const companyHashtag of companyHashtags) {
          try {
            const companySlug = companyHashtag.replace('COMPANY:', '');
            console.log(`\n🏢 Processing company page: ${companySlug}`);

            // Step 1: Look up company to get provider_id
            const companyUrl = `https://${UNIPILE_DSN}/api/v1/companies/${companySlug}?account_id=${ACCOUNT_ID}`;
            console.log(`📡 Looking up company: ${companyUrl}`);

            const companyResponse = await fetch(companyUrl, {
              method: 'GET',
              headers: { 'X-API-KEY': UNIPILE_API_KEY }
            });

            if (!companyResponse.ok) {
              console.error(`❌ Failed to lookup company ${companySlug}: ${companyResponse.status}`);
              const errorText = await companyResponse.text();
              console.error(`   Error: ${errorText}`);
              continue;
            }

            const companyData = await companyResponse.json();
            console.log(`✅ Company found: ${companyData.name || companySlug} (provider_id: ${companyData.provider_id || companyData.id})`);

            const companyProviderId = companyData.provider_id || companyData.id;
            const companyName = companyData.name || companySlug;

            // Step 2: Fetch posts from company page
            const postsUrl = `https://${UNIPILE_DSN}/api/v1/companies/${companyProviderId}/posts?account_id=${ACCOUNT_ID}`;
            console.log(`📡 Fetching posts from URL: ${postsUrl}`);

            const postsResponse = await fetch(postsUrl, {
              method: 'GET',
              headers: {
                'X-API-KEY': UNIPILE_API_KEY,
                'Accept': 'application/json'
              }
            });

            if (!postsResponse.ok) {
              console.error(`❌ Failed to fetch posts for ${companySlug}: ${postsResponse.status}`);
              const errorText = await postsResponse.text();
              console.error(`   Error: ${errorText}`);
              continue;
            }

            const postsData = await postsResponse.json();
            console.log(`📦 Raw response structure:`, {
              hasItems: 'items' in postsData,
              hasPosts: 'posts' in postsData,
              hasData: 'data' in postsData,
              topLevelKeys: Object.keys(postsData),
              isArray: Array.isArray(postsData),
            });

            // Try different possible response structures
            let posts: any[] = [];
            if (postsData.items && Array.isArray(postsData.items)) {
              posts = postsData.items;
              console.log(`✅ Found posts in 'items' field`);
            } else if (postsData.posts && Array.isArray(postsData.posts)) {
              posts = postsData.posts;
              console.log(`✅ Found posts in 'posts' field`);
            } else if (postsData.data && Array.isArray(postsData.data)) {
              posts = postsData.data;
              console.log(`✅ Found posts in 'data' field`);
            } else if (Array.isArray(postsData)) {
              posts = postsData;
              console.log(`✅ Response is directly an array of posts`);
            } else {
              console.error(`⚠️ Unknown response structure. Full response:`, JSON.stringify(postsData, null, 2).substring(0, 500));
            }

            console.log(`📝 Retrieved ${posts.length} posts from company page`);

            // Keep only the most recent 3 posts
            if (posts.length > 3) {
              console.log(`✂️ Trimming to 3 most recent posts (was ${posts.length})`);
              posts = posts.slice(0, 3);
            }

            // Step 3: Filter posts by age (72 hours)
            const maxAgeHours = 72;
            const cutoffDate = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));

            console.log(`🕐 Filtering posts. Cutoff date: ${cutoffDate.toISOString()}`);

            const recentPosts = posts.filter((post: any) => {
              const dateValue = post.date || post.created_at || post.published_at || post.timestamp;
              let postDate: Date | null = null;

              // First try to parse as relative date (e.g., "8h", "2d")
              if (dateValue) {
                postDate = parseRelativeDate(dateValue);
              }

              // If that didn't work, try parsed_datetime field (ISO format)
              if (!postDate && post.parsed_datetime) {
                try {
                  postDate = new Date(post.parsed_datetime);
                  if (isNaN(postDate.getTime())) postDate = null;
                } catch (e) { }
              }

              // Finally, try to parse dateValue as ISO date
              if (!postDate && dateValue) {
                try {
                  const isoDate = new Date(dateValue);
                  if (!isNaN(isoDate.getTime())) {
                    postDate = isoDate;
                  }
                } catch (e) { }
              }

              if (!postDate) {
                console.log(`⚠️ Post missing parseable date. Raw date: ${dateValue}`);
                return false;
              }

              return postDate >= cutoffDate;
            });

            console.log(`⏰ Found ${recentPosts.length} posts from last ${maxAgeHours} hours`);

            // Step 4: Check which posts are already discovered
            const existingSocialIds = recentPosts.map((p: any) => {
              return p.social_id || p.urn || p.entity_urn || p.id;
            }).filter(Boolean);

            if (existingSocialIds.length === 0) {
              console.log(`ℹ️ No posts with valid IDs to check`);
              continue;
            }

            const { data: existingPosts, error: selectError } = await supabase
              .from('linkedin_posts_discovered')
              .select('social_id')
              .in('social_id', existingSocialIds);

            if (selectError) {
              console.error(`❌ Error checking existing posts:`, selectError);
            }

            const existingSet = new Set((existingPosts || []).map((p: any) => p.social_id));
            const newPosts = recentPosts.filter((p: any) => {
              const socialId = p.social_id || p.urn || p.entity_urn || p.id;
              return socialId && !existingSet.has(socialId);
            });

            console.log(`🆕 Found ${newPosts.length} new posts to store`);

            // Step 5: Store new posts
            if (newPosts.length > 0) {
              const postsToInsert = newPosts.map((post: any) => {
                const socialId = post.social_id || post.urn || post.entity_urn || post.id;
                const shareUrl = post.share_url || post.permalink || post.url || `https://www.linkedin.com/feed/update/${socialId}`;
                const content = post.text || post.content || post.message || '';

                // Parse the date correctly
                const dateValue = post.date || post.created_at || post.published_at || post.timestamp;
                let postDate: Date | null = parseRelativeDate(dateValue);

                if (!postDate && post.parsed_datetime) {
                  try {
                    postDate = new Date(post.parsed_datetime);
                    if (isNaN(postDate.getTime())) postDate = null;
                  } catch (e) { }
                }

                if (!postDate && dateValue) {
                  try {
                    const isoDate = new Date(dateValue);
                    if (!isNaN(isoDate.getTime())) {
                      postDate = isoDate;
                    }
                  } catch (e) { }
                }

                if (!postDate) {
                  postDate = new Date();
                }

                return {
                  workspace_id: monitor.workspace_id,
                  monitor_id: monitor.id,
                  social_id: socialId,
                  share_url: shareUrl,
                  post_content: content,
                  author_name: companyName,
                  author_profile_id: companyProviderId,
                  hashtags: post.hashtags || [],
                  post_date: postDate.toISOString(),
                  engagement_metrics: {
                    comments: post.comment_counter || post.comments_count || 0,
                    reactions: post.reaction_counter || post.reactions_count || 0,
                    reposts: post.repost_counter || post.reposts_count || 0
                  },
                  status: 'discovered'
                };
              });

              console.log(`💾 Inserting ${postsToInsert.length} posts to database`);

              const { error: insertError } = await supabase
                .from('linkedin_posts_discovered')
                .insert(postsToInsert);

              if (insertError) {
                console.error(`❌ Error inserting posts:`, insertError);
              } else {
                totalDiscovered += newPosts.length;
                console.log(`✅ Stored ${newPosts.length} new posts successfully`);
              }
            }

          } catch (error) {
            console.error(`❌ Error processing company ${companyHashtag} in monitor ${monitor.id}:`, error);
            continue;
          }
        } // End of company loop
      } // End of monitor loop
    } // End of workspace loop

    console.log(`\n✅ Company discovery complete: ${totalDiscovered} new posts discovered`);

    return NextResponse.json({
      success: true,
      monitorsProcessed: companyMonitors.length,
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
