import { supabaseAdmin } from '@/app/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * LinkedIn Post Discovery using Apify
 *
 * This endpoint scrapes LinkedIn profiles AND hashtags using Apify and stores posts.
 * Supports two monitor types:
 * - PROFILE:vanity_name - Scrapes posts from a specific LinkedIn profile
 * - HASHTAG:keyword - Searches posts by hashtag/keyword (e.g., #genAI, #sales)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = supabaseAdmin();

    console.log('🔍 Starting Apify-based post discovery...');

    // Fetch all active monitors
    const { data: monitors, error: monitorsError } = await supabase
      .from('linkedin_post_monitors')
      .select('*')
      .eq('status', 'active');

    if (monitorsError) {
      console.error('❌ Error fetching monitors:', monitorsError);
      return NextResponse.json({ error: monitorsError.message }, { status: 500 });
    }

    if (!monitors || monitors.length === 0) {
      return NextResponse.json({ message: 'No active monitors', discovered: 0 });
    }

    console.log(`📋 Found ${monitors.length} active monitors`);

    // Filter for profile monitors (PROFILE:vanity_name)
    const profileMonitors = monitors.filter(m =>
      m.hashtags?.some((h: string) => h.startsWith('PROFILE:'))
    );

    console.log(`👤 Processing ${profileMonitors.length} profile monitors`);

    // Filter for hashtag monitors (HASHTAG:keyword)
    const hashtagMonitors = monitors.filter(m =>
      m.hashtags?.some((h: string) => h.startsWith('HASHTAG:'))
    );

    console.log(`#️⃣ Processing ${hashtagMonitors.length} hashtag monitors`);

    let totalDiscovered = 0;
    const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;

    // Actor URLs - replace with custom actors when ready
    const PROFILE_ACTOR = 'apimaestro~linkedin-profile-posts';
    const HASHTAG_ACTOR = 'apimaestro~linkedin-posts-search-scraper-no-cookies';

    if (!APIFY_API_TOKEN) {
      console.error('❌ Missing APIFY_API_TOKEN');
      return NextResponse.json({ error: 'Apify API token not configured' }, { status: 500 });
    }

    // Process each profile monitor
    for (const monitor of profileMonitors) {
      try {
        const profileHashtag = monitor.hashtags.find((h: string) => h.startsWith('PROFILE:'));
        if (!profileHashtag) continue;

        const vanityName = profileHashtag.replace('PROFILE:', '').replace(/\/$/, '');
        console.log(`\n🔍 Scraping profile: ${vanityName}`);

        // Start Apify actor run (asynchronous)
        console.log(`📡 Starting Apify actor for ${vanityName}...`);

        const startRunUrl = `https://api.apify.com/v2/acts/${PROFILE_ACTOR}/runs?token=${APIFY_API_TOKEN}`;

        const startResponse = await fetch(startRunUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: vanityName,
            page_number: 1,
            total_posts: 1  // Only scrape 1 post per profile
          })
        });

        if (!startResponse.ok) {
          console.error(`❌ Failed to start Apify actor: ${startResponse.status}`);
          const errorText = await startResponse.text();
          console.error(`   Error: ${errorText}`);
          continue;
        }

        const runData = await startResponse.json();
        const runId = runData.data.id;
        const defaultDatasetId = runData.data.defaultDatasetId;

        console.log(`⏳ Waiting for run ${runId} to complete...`);

        // Poll for completion (wait up to 60 seconds)
        let attempts = 0;
        let runComplete = false;

        while (attempts < 60 && !runComplete) {
          await new Promise(resolve => setTimeout(resolve, 1000));

          const statusResponse = await fetch(
            `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`
          );

          if (statusResponse.ok) {
            const status = await statusResponse.json();
            if (status.data.status === 'SUCCEEDED') {
              runComplete = true;
              console.log(`✅ Run completed successfully`);
            } else if (status.data.status === 'FAILED') {
              console.error(`❌ Run failed`);
              break;
            }
          }
          attempts++;
        }

        if (!runComplete) {
          console.error(`❌ Run timed out after 60 seconds`);
          continue;
        }

        // Get dataset items
        const datasetUrl = `https://api.apify.com/v2/datasets/${defaultDatasetId}/items?token=${APIFY_API_TOKEN}`;
        const dataResponse = await fetch(datasetUrl);

        if (!dataResponse.ok) {
          console.error(`❌ Failed to get dataset items: ${dataResponse.status}`);
          continue;
        }

        const data = await dataResponse.json();

        // Log the raw response structure for debugging
        console.log(`📦 Raw Apify response:`, JSON.stringify(data).substring(0, 500));

        // Apify apimaestro actor returns an array of posts directly: [{...}, {...}]
        const posts = Array.isArray(data) ? data : [];

        console.log(`📦 Apify returned ${posts.length} posts`);

        if (!posts || posts.length === 0) {
          console.log(`⚠️ No posts found for ${vanityName}`);
          continue;
        }

        console.log(`📝 Found ${posts.length} posts from profile`);

        if (posts.length === 0) continue;

        // Filter posts by age (last 24 hours)
        const maxAgeHours = 24;
        const cutoffDate = Date.now() - (maxAgeHours * 60 * 60 * 1000);

        const recentPosts = posts.filter((post: any) => {
          // Apify returns timestamp in milliseconds
          const postTimestamp = post.posted_at?.timestamp;
          if (!postTimestamp) return false;
          return postTimestamp >= cutoffDate;
        });

        console.log(`⏰ Found ${recentPosts.length} posts from last ${maxAgeHours} hours`);

        // Check which posts already exist (check both URL and social_id)
        const existingUrls = recentPosts.map((p: any) => p.url).filter(Boolean);

        // Extract original social_ids from Apify response for duplicate checking
        // We preserve the original URN format but also extract numeric IDs for robust matching
        const existingSocialIds = recentPosts
          .map((p: any) => p.urn?.activity_urn || p.full_urn)
          .filter(Boolean);

        // Also extract numeric IDs for comparison (handles format variations)
        const existingNumericIds = recentPosts
          .map((p: any) => {
            const socialId = p.urn?.activity_urn || p.full_urn;
            if (!socialId) return null;
            const numericMatch = String(socialId).match(/(\d{16,20})/);
            return numericMatch ? numericMatch[1] : null;
          })
          .filter(Boolean);

        // Query existing posts - check by URL or by original social_id
        const { data: existingPosts } = await supabase
          .from('linkedin_posts_discovered')
          .select('share_url, social_id')
          .eq('workspace_id', monitor.workspace_id)
          .or(`share_url.in.(${existingUrls.join(',')}),social_id.in.(${existingSocialIds.join(',')})`);

        const existingUrlSet = new Set(existingPosts?.map(p => p.share_url) || []);
        // Extract numeric IDs from existing DB records for robust comparison
        const existingDbNumericIds = new Set(
          existingPosts?.map(p => {
            const match = String(p.social_id || '').match(/(\d{16,20})/);
            return match ? match[1] : null;
          }).filter(Boolean) || []
        );

        const newPosts = recentPosts.filter((p: any) => {
          // Check URL first
          if (existingUrlSet.has(p.url)) return false;

          // Compare using numeric ID (handles any URN format variation)
          const socialId = p.urn?.activity_urn || p.full_urn;
          if (!socialId) return true; // No social_id, assume new

          const numericMatch = String(socialId).match(/(\d{16,20})/);
          if (numericMatch && existingDbNumericIds.has(numericMatch[1])) {
            return false; // Numeric ID already exists
          }

          return true;
        });

        console.log(`🆕 Found ${newPosts.length} new posts to store (${recentPosts.length - newPosts.length} already exist)`);

        // Store new posts
        if (newPosts.length > 0) {
          const postsToInsert = newPosts.map((post: any) => {
            // CRITICAL: Preserve original URN format for Unipile API compatibility
            // Unipile's /api/v1/posts/{socialId}/comments endpoint REQUIRES the original URN type
            // LinkedIn uses: urn:li:activity:, urn:li:ugcPost:, urn:li:share:
            // Converting to urn:li:activity: breaks Unipile's ability to find the post
            // For duplicate detection, we use the numeric ID, but store the ORIGINAL URN
            let socialId = post.urn?.activity_urn || post.full_urn;

            // Keep the original URN format - DO NOT normalize to urn:li:activity:
            // If it's just a number, wrap it in the default format
            if (socialId && /^\d+$/.test(socialId)) {
              socialId = `urn:li:activity:${socialId}`;
            }

            return {
              workspace_id: monitor.workspace_id,
              monitor_id: monitor.id,
              social_id: socialId,
              share_url: post.url || `https://www.linkedin.com/feed/update/${post.full_urn}`,
              post_content: post.text || '',
              author_name: post.author?.first_name ? `${post.author.first_name} ${post.author.last_name || ''}`.trim() : vanityName,
              author_profile_id: post.author?.username || vanityName,
              author_title: post.author?.headline || post.author?.title || null,
              author_headline: post.author?.headline || post.author?.title || null,
              hashtags: [],
              post_date: new Date(post.posted_at?.timestamp).toISOString(),
              engagement_metrics: {
                comments: post.stats?.comments_count || 0,
                reactions: post.stats?.total_reactions || 0,
                reposts: post.stats?.reposts_count || 0
              },
              status: 'discovered'
            };
          });

          const { data: insertedPosts, error: insertError } = await supabase
            .from('linkedin_posts_discovered')
            .insert(postsToInsert)
            .select();

          if (insertError) {
            // Check if it's a duplicate key error (unique constraint violation)
            if (insertError.code === '23505') {
              console.warn(`⚠️ Some posts already exist (duplicate prevented by database constraint)`);
              // Count how many were actually inserted by checking again
              const { count } = await supabase
                .from('linkedin_posts_discovered')
                .select('*', { count: 'exact', head: true })
                .eq('monitor_id', monitor.id)
                .gte('created_at', new Date(Date.now() - 60000).toISOString()); // Last minute

              if (count && count > 0) {
                totalDiscovered += count;
                console.log(`✅ Stored ${count} new posts (duplicates skipped)`);
              }
            } else {
              console.error(`❌ Error inserting posts:`, insertError);
            }
          } else {
            totalDiscovered += newPosts.length;
            console.log(`✅ Stored ${newPosts.length} new posts`);

            // 🤖 AUTO-GENERATE COMMENTS FOR NEW POSTS
            if (insertedPosts && insertedPosts.length > 0) {
              console.log(`🤖 Auto-generating comments for ${insertedPosts.length} new posts...`);

              // Trigger comment generation in background
              // Don't await - let it run async so discovery completes faster
              fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com'}/api/linkedin-commenting/auto-generate-comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  post_ids: insertedPosts.map(p => p.id),
                  workspace_id: monitor.workspace_id,
                  monitor_id: monitor.id
                })
              }).catch(err => console.error('❌ Error triggering auto-comment generation:', err));
            }
          }
        }

      } catch (error) {
        console.error(`❌ Error processing monitor ${monitor.id}:`, error);
        continue;
      }
    }

    // Process hashtag monitors
    for (const monitor of hashtagMonitors) {
      try {
        const hashtagEntry = monitor.hashtags.find((h: string) => h.startsWith('HASHTAG:'));
        if (!hashtagEntry) continue;

        const keyword = hashtagEntry.replace('HASHTAG:', '').trim();
        console.log(`\n#️⃣ Searching hashtag: ${keyword}`);

        // Start Apify actor run for hashtag search
        console.log(`📡 Starting Apify hashtag search actor for #${keyword}...`);

        const startRunUrl = `https://api.apify.com/v2/acts/${HASHTAG_ACTOR}/runs?token=${APIFY_API_TOKEN}`;

        const startResponse = await fetch(startRunUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            keyword: keyword,
            maxResults: 10,  // Limit to 10 posts per hashtag
            searchAge: 24    // Last 24 hours
          })
        });

        if (!startResponse.ok) {
          console.error(`❌ Failed to start Apify hashtag actor: ${startResponse.status}`);
          const errorText = await startResponse.text();
          console.error(`   Error: ${errorText}`);
          continue;
        }

        const runData = await startResponse.json();
        const runId = runData.data.id;
        const defaultDatasetId = runData.data.defaultDatasetId;

        console.log(`⏳ Waiting for hashtag search run ${runId} to complete...`);

        // Poll for completion (wait up to 90 seconds for hashtag searches)
        let attempts = 0;
        let runComplete = false;

        while (attempts < 90 && !runComplete) {
          await new Promise(resolve => setTimeout(resolve, 1000));

          const statusResponse = await fetch(
            `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`
          );

          if (statusResponse.ok) {
            const status = await statusResponse.json();
            if (status.data.status === 'SUCCEEDED') {
              runComplete = true;
              console.log(`✅ Hashtag search completed successfully`);
            } else if (status.data.status === 'FAILED') {
              console.error(`❌ Hashtag search run failed`);
              break;
            }
          }
          attempts++;
        }

        if (!runComplete) {
          console.error(`❌ Hashtag search timed out after 90 seconds`);
          continue;
        }

        // Get dataset items
        const datasetUrl = `https://api.apify.com/v2/datasets/${defaultDatasetId}/items?token=${APIFY_API_TOKEN}`;
        const dataResponse = await fetch(datasetUrl);

        if (!dataResponse.ok) {
          console.error(`❌ Failed to get hashtag dataset items: ${dataResponse.status}`);
          continue;
        }

        const data = await dataResponse.json();

        // Log the raw response structure for debugging
        console.log(`📦 Raw Apify hashtag response:`, JSON.stringify(data).substring(0, 500));

        // Hashtag search actor returns array of posts
        const posts = Array.isArray(data) ? data : [];

        console.log(`📦 Apify hashtag search returned ${posts.length} posts`);

        if (!posts || posts.length === 0) {
          console.log(`⚠️ No posts found for hashtag #${keyword}`);
          continue;
        }

        // Filter posts by age (last 24 hours)
        const maxAgeHours = 24;
        const cutoffDate = Date.now() - (maxAgeHours * 60 * 60 * 1000);

        const recentPosts = posts.filter((post: any) => {
          // Hashtag actor may use different timestamp field
          const postTimestamp = post.postedAt || post.posted_at?.timestamp || post.timestamp;
          if (!postTimestamp) return true; // Include if no timestamp (let DB dedup handle it)
          const ts = typeof postTimestamp === 'number' ? postTimestamp : new Date(postTimestamp).getTime();
          return ts >= cutoffDate;
        });

        console.log(`⏰ Found ${recentPosts.length} posts from last ${maxAgeHours} hours`);

        // Check which posts already exist
        const existingUrls = recentPosts.map((p: any) => p.url || p.postUrl).filter(Boolean);

        // Extract original social_ids for duplicate checking (preserve format)
        const existingSocialIds = recentPosts
          .map((p: any) => p.urn || p.postUrn || p.id)
          .filter(Boolean);

        const { data: existingPosts } = await supabase
          .from('linkedin_posts_discovered')
          .select('share_url, social_id')
          .eq('workspace_id', monitor.workspace_id)
          .or(`share_url.in.(${existingUrls.join(',')}),social_id.in.(${existingSocialIds.join(',')})`);

        const existingUrlSet = new Set(existingPosts?.map(p => p.share_url) || []);
        // Extract numeric IDs from DB for robust comparison across URN formats
        const existingDbNumericIds = new Set(
          existingPosts?.map(p => {
            const match = String(p.social_id || '').match(/(\d{16,20})/);
            return match ? match[1] : null;
          }).filter(Boolean) || []
        );

        const newPosts = recentPosts.filter((p: any) => {
          const url = p.url || p.postUrl;
          if (existingUrlSet.has(url)) return false;

          // Compare using numeric ID (handles any URN format variation)
          const socialId = p.urn || p.postUrn || p.id;
          if (!socialId) return true; // No social_id, assume new

          const numericMatch = String(socialId).match(/(\d{16,20})/);
          if (numericMatch && existingDbNumericIds.has(numericMatch[1])) {
            return false; // Numeric ID already exists
          }

          return true;
        });

        console.log(`🆕 Found ${newPosts.length} new hashtag posts to store (${recentPosts.length - newPosts.length} already exist)`);

        // Store new posts
        if (newPosts.length > 0) {
          const postsToInsert = newPosts.map((post: any) => {
            // CRITICAL: Preserve original URN format for Unipile API compatibility
            // Unipile's /api/v1/posts/{socialId}/comments endpoint REQUIRES the original URN type
            // LinkedIn uses: urn:li:activity:, urn:li:ugcPost:, urn:li:share:
            // Converting to urn:li:activity: breaks Unipile's ability to find posts
            let socialId = post.urn || post.postUrn || post.id;

            // Only wrap bare numbers - preserve all other URN formats
            if (socialId && /^\d+$/.test(String(socialId))) {
              socialId = `urn:li:activity:${socialId}`;
            }

            return {
              workspace_id: monitor.workspace_id,
              monitor_id: monitor.id,
              social_id: socialId,
              share_url: post.url || post.postUrl || `https://www.linkedin.com/feed/update/${socialId}`,
              post_content: post.text || post.content || '',
              author_name: post.authorName || post.author?.name || post.author?.first_name || 'Unknown',
              author_profile_id: post.authorProfileId || post.author?.username || post.author?.vanityName || null,
              author_title: post.authorTitle || post.author?.headline || null,
              author_headline: post.authorHeadline || post.author?.headline || null,
              hashtags: [keyword],
              post_date: post.postedAt || post.posted_at?.timestamp
                ? new Date(post.postedAt || post.posted_at?.timestamp).toISOString()
                : new Date().toISOString(),
              engagement_metrics: {
                comments: post.numComments || post.stats?.comments_count || 0,
                reactions: post.numLikes || post.stats?.total_reactions || 0,
                reposts: post.numReposts || post.stats?.reposts_count || 0
              },
              status: 'discovered'
            };
          });

          const { data: insertedPosts, error: insertError } = await supabase
            .from('linkedin_posts_discovered')
            .insert(postsToInsert)
            .select();

          if (insertError) {
            if (insertError.code === '23505') {
              console.warn(`⚠️ Some hashtag posts already exist (duplicate prevented by database constraint)`);
            } else {
              console.error(`❌ Error inserting hashtag posts:`, insertError);
            }
          } else {
            totalDiscovered += newPosts.length;
            console.log(`✅ Stored ${newPosts.length} new hashtag posts`);

            // Auto-generate comments for new posts
            if (insertedPosts && insertedPosts.length > 0) {
              console.log(`🤖 Auto-generating comments for ${insertedPosts.length} new hashtag posts...`);

              fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com'}/api/linkedin-commenting/auto-generate-comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  post_ids: insertedPosts.map(p => p.id),
                  workspace_id: monitor.workspace_id,
                  monitor_id: monitor.id
                })
              }).catch(err => console.error('❌ Error triggering auto-comment generation:', err));
            }
          }
        }

      } catch (error) {
        console.error(`❌ Error processing hashtag monitor ${monitor.id}:`, error);
        continue;
      }
    }

    console.log(`\n✅ Discovery complete: ${totalDiscovered} new posts discovered`);

    return NextResponse.json({
      success: true,
      monitorsProcessed: profileMonitors.length + hashtagMonitors.length,
      profileMonitorsProcessed: profileMonitors.length,
      hashtagMonitorsProcessed: hashtagMonitors.length,
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
