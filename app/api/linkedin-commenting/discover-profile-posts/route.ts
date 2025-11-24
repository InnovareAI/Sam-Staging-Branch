import { supabaseAdmin } from '@/app/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

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
    // Use admin client to bypass RLS policies - this is a system endpoint
    const supabase = supabaseAdmin();

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
      .select('unipile_account_id')
      .eq('workspace_id', workspaceId)
      .eq('account_type', 'linkedin')
      .eq('connection_status', 'connected')
      .single();

    if (accountError || !workspaceAccount) {
      console.error('❌ No active LinkedIn account for workspace:', workspaceId);
      return Response.json({
        success: false,
        error: 'No active LinkedIn account configured for workspace'
      });
    }

    const UNIPILE_DSN = process.env.UNIPILE_DSN || 'api6.unipile.com:13670';
    const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
    const ACCOUNT_ID = workspaceAccount.unipile_account_id;

    if (!UNIPILE_API_KEY) {
      console.error('❌ Missing UNIPILE_API_KEY');
      return Response.json({ success: false, error: 'Unipile API key not configured' });
    }

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
        console.log(`✅ Profile found: ${profile.first_name} ${profile.last_name} (provider_id: ${profile.provider_id})`);

        // Step 2: Fetch posts using provider_id (NOT vanity name)
        // CRITICAL: Unipile requires provider_id to fetch posts correctly
        const postsUrl = `https://${UNIPILE_DSN}/api/v1/users/${profile.provider_id}/posts?account_id=${ACCOUNT_ID}`;
        console.log(`📡 Fetching posts from URL: ${postsUrl}`);

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
        console.log(`📦 Raw response structure:`, {
          hasItems: 'items' in postsData,
          hasPosts: 'posts' in postsData,
          hasData: 'data' in postsData,
          topLevelKeys: Object.keys(postsData),
          isArray: Array.isArray(postsData),
        });

        // Try different possible response structures
        let posts = [];
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

        console.log(`📝 Retrieved ${posts.length} posts from profile`);

        if (posts.length > 0) {
          const firstPost = posts[0];
          console.log(`🔍 Sample post structure:`, {
            hasSocialId: 'social_id' in firstPost,
            hasId: 'id' in firstPost,
            hasUrn: 'urn' in firstPost,
            hasDate: 'date' in firstPost,
            hasCreatedAt: 'created_at' in firstPost,
            hasPublishedAt: 'published_at' in firstPost,
            hasShareUrl: 'share_url' in firstPost,
            hasPermalink: 'permalink' in firstPost,
            hasUrl: 'url' in firstPost,
            topLevelKeys: Object.keys(firstPost).slice(0, 10),
            dateValue: firstPost.date || firstPost.created_at || firstPost.published_at
          });
        }

        // Step 3: Filter posts by age
        // Temporarily using 72 hours for testing (most recent post is 8h old)
        const maxAgeHours = 72; // Extended to 72h for testing
        const cutoffDate = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));

        console.log(`🕐 Filtering posts. Cutoff date: ${cutoffDate.toISOString()}`);
        console.log(`🕐 Current time: ${new Date().toISOString()}`);

        const recentPosts = posts.filter((post: any) => {
          // Try different date field names
          const dateValue = post.date || post.created_at || post.published_at || post.timestamp;

          // Parse the date - could be relative ("8h") or ISO format
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
            } catch (e) {}
          }

          // Finally, try to parse dateValue as ISO date
          if (!postDate && dateValue) {
            try {
              const isoDate = new Date(dateValue);
              if (!isNaN(isoDate.getTime())) {
                postDate = isoDate;
              }
            } catch (e) {}
          }

          if (!postDate) {
            console.log(`⚠️ Post missing parseable date. Raw date: ${dateValue}, parsed_datetime: ${post.parsed_datetime}`);
            return false;
          }

          const isRecent = postDate >= cutoffDate;

          // Log the first few posts for debugging
          if (posts.indexOf(post) < 3) {
            const ageHours = (Date.now() - postDate.getTime()) / (1000 * 60 * 60);
            console.log(`  Post date: ${dateValue} → ${postDate.toISOString()} - Age: ${ageHours.toFixed(1)}h - Within 24h: ${isRecent}`);
          }

          return isRecent;
        });

        console.log(`⏰ Found ${recentPosts.length} posts from last ${maxAgeHours} hours out of ${posts.length} total`);

        // Step 4: Check which posts are already discovered
        // First check what field contains the unique ID
        if (recentPosts.length > 0) {
          const samplePost = recentPosts[0];
          console.log(`🔑 Looking for unique ID field. Sample post has:`, {
            social_id: samplePost.social_id,
            id: samplePost.id,
            urn: samplePost.urn,
            post_id: samplePost.post_id,
            entity_urn: samplePost.entity_urn,
          });
        }

        // Try to extract social_id from different possible fields
        const existingSocialIds = recentPosts.map((p: any) => {
          const socialId = p.social_id || p.urn || p.entity_urn || p.id;
          if (!socialId) {
            console.log(`⚠️ Post missing social_id. Full post:`, JSON.stringify(p, null, 2).substring(0, 500));
          }
          return socialId;
        }).filter(Boolean);

        console.log(`📊 Checking database for ${existingSocialIds.length} social IDs`);
        console.log(`   Sample IDs:`, existingSocialIds.slice(0, 3));

        let existingPosts = [];
        let selectError = null;

        // Only query if we have IDs to check
        if (existingSocialIds.length > 0) {
          const result = await supabase
            .from('linkedin_posts_discovered')
            .select('social_id')
            .in('social_id', existingSocialIds);

          existingPosts = result.data || [];
          selectError = result.error;
        }

        if (selectError) {
          console.error(`❌ Error checking existing posts:`, selectError);
        } else {
          console.log(`📊 Found ${existingPosts?.length || 0} existing posts in database`);
        }

        const existingSet = new Set(existingPosts.map((p: any) => p.social_id));
        const newPosts = recentPosts.filter((p: any) => {
          const socialId = p.social_id || p.urn || p.entity_urn || p.id;
          return socialId && !existingSet.has(socialId);
        });

        console.log(`🆕 Found ${newPosts.length} new posts to store`);

        // Step 5: Store new posts
        if (newPosts.length > 0) {
          const postsToInsert = newPosts.map((post: any, index: number) => {
            // Extract the correct field values based on Unipile's actual response structure
            const socialId = post.social_id || post.urn || post.entity_urn || post.id;
            const shareUrl = post.share_url || post.permalink || post.url || `https://www.linkedin.com/feed/update/${socialId}`;
            const content = post.text || post.content || post.message || '';

            // Parse the date correctly
            const dateValue = post.date || post.created_at || post.published_at || post.timestamp;
            let postDate: Date | null = parseRelativeDate(dateValue);

            // Fall back to parsed_datetime if available
            if (!postDate && post.parsed_datetime) {
              try {
                postDate = new Date(post.parsed_datetime);
                if (isNaN(postDate.getTime())) postDate = null;
              } catch (e) {}
            }

            // Try parsing as ISO date
            if (!postDate && dateValue) {
              try {
                const isoDate = new Date(dateValue);
                if (!isNaN(isoDate.getTime())) {
                  postDate = isoDate;
                }
              } catch (e) {}
            }

            // Use current date as fallback (should never happen for valid posts)
            if (!postDate) {
              console.log(`⚠️ Using current date as fallback for post ${socialId}`);
              postDate = new Date();
            }

            const insertData = {
              workspace_id: monitor.workspace_id,
              monitor_id: monitor.id,
              social_id: socialId,
              share_url: shareUrl,
              post_content: content,
              author_name: `${profile.first_name} ${profile.last_name}`,
              author_profile_id: profile.provider_id,
              hashtags: post.hashtags || [],
              post_date: postDate.toISOString(),
              engagement_metrics: {
                comments: post.comment_counter || post.comments_count || 0,
                reactions: post.reaction_counter || post.reactions_count || 0,
                reposts: post.repost_counter || post.reposts_count || 0
              },
              status: 'discovered'
            };

            // Log the first post being inserted for debugging
            if (index === 0) {
              console.log(`📝 Sample post being inserted:`, JSON.stringify(insertData, null, 2));
            }

            return insertData;
          });

          console.log(`💾 Attempting to insert ${postsToInsert.length} posts to database`);
          console.log(`   First post social_id: ${postsToInsert[0]?.social_id}`);
          console.log(`   Workspace ID: ${monitor.workspace_id}`);
          console.log(`   Monitor ID: ${monitor.id}`);

          // Log full insert data for debugging
          console.log('📦 Full insert data for first post:', JSON.stringify(postsToInsert[0], null, 2));

          const { data: insertedData, error: insertError } = await supabase
            .from('linkedin_posts_discovered')
            .insert(postsToInsert)
            .select();

          if (insertError) {
            console.error(`❌ Error inserting posts:`, insertError);
            console.error(`   Error details:`, JSON.stringify(insertError, null, 2));
            // Log the first post that failed to help debug
            if (postsToInsert.length > 0) {
              console.error(`   First post that failed:`, JSON.stringify(postsToInsert[0], null, 2));
            }
          } else {
            totalDiscovered += newPosts.length;
            console.log(`✅ Stored ${newPosts.length} new posts successfully`);
            if (insertedData && insertedData.length > 0) {
              console.log(`   First inserted post ID: ${insertedData[0].id}`);
            }
          }
        }

      } catch (error) {
        console.error(`❌ Error processing monitor ${monitor.id}:`, error);
        console.error(`   Full error:`, JSON.stringify(error, null, 2));
        if (error instanceof Error) {
          console.error(`   Stack trace:`, error.stack);
        }
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
