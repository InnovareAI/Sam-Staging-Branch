import { supabaseAdmin } from '@/app/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * LinkedIn Post Discovery using Apify
 *
 * This endpoint scrapes LinkedIn profiles using Apify and stores posts.
 * Replaces the broken Unipile-based discovery system.
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

    let totalDiscovered = 0;
    const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;

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

        const startRunUrl = `https://api.apify.com/v2/acts/apimaestro~linkedin-profile-posts/runs?token=${APIFY_API_TOKEN}`;

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

        // Normalize social_ids to URN format for duplicate checking
        // Extract numeric ID from any URN format and normalize to urn:li:activity:NUMBER
        const existingSocialIds = recentPosts
          .map((p: any) => {
            let socialId = p.urn?.activity_urn || p.full_urn;
            if (!socialId) return null;

            // Extract numeric ID from any URN format
            // Handles: urn:li:activity:123, urn:li:ugcPost:123, or plain 123
            const numericMatch = socialId.match(/(\d{16,20})/); // LinkedIn IDs are 16-20 digits
            if (numericMatch) {
              return `urn:li:activity:${numericMatch[1]}`;
            }

            // Fallback: if already starts with urn:li:activity, keep it
            if (socialId.startsWith('urn:li:activity:')) {
              return socialId;
            }

            // Last resort: assume it's a plain number
            if (/^\d+$/.test(socialId)) {
              return `urn:li:activity:${socialId}`;
            }

            return socialId;
          })
          .filter(Boolean);

        const { data: existingPosts } = await supabase
          .from('linkedin_posts_discovered')
          .select('share_url, social_id')
          .eq('workspace_id', monitor.workspace_id)
          .or(`share_url.in.(${existingUrls.join(',')}),social_id.in.(${existingSocialIds.join(',')})`);

        const existingUrlSet = new Set(existingPosts?.map(p => p.share_url) || []);
        const existingSocialIdSet = new Set(existingPosts?.map(p => p.social_id) || []);

        const newPosts = recentPosts.filter((p: any) => {
          // Normalize social_id for comparison using same logic
          let socialId = p.urn?.activity_urn || p.full_urn;
          if (!socialId) return !existingUrlSet.has(p.url);

          // Extract numeric ID and normalize
          const numericMatch = socialId.match(/(\d{16,20})/);
          if (numericMatch) {
            socialId = `urn:li:activity:${numericMatch[1]}`;
          } else if (socialId.startsWith('urn:li:activity:')) {
            // Already normalized
          } else if (/^\d+$/.test(socialId)) {
            socialId = `urn:li:activity:${socialId}`;
          }

          return !existingUrlSet.has(p.url) && !existingSocialIdSet.has(socialId);
        });

        console.log(`🆕 Found ${newPosts.length} new posts to store (${recentPosts.length - newPosts.length} already exist)`);

        // Store new posts
        if (newPosts.length > 0) {
          const postsToInsert = newPosts.map((post: any) => {
            // Normalize social_id to always use URN format (urn:li:activity:NUMBER)
            // Extracts numeric ID from ANY URN type (activity, ugcPost, share, etc.)
            // Prevents duplicates from different URN format variations
            let socialId = post.urn?.activity_urn || post.full_urn;

            if (socialId) {
              // Extract numeric ID from any URN format
              const numericMatch = socialId.match(/(\d{16,20})/);
              if (numericMatch) {
                socialId = `urn:li:activity:${numericMatch[1]}`;
              } else if (socialId.startsWith('urn:li:activity:')) {
                // Already in correct format
              } else if (/^\d+$/.test(socialId)) {
                socialId = `urn:li:activity:${socialId}`;
              }
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
