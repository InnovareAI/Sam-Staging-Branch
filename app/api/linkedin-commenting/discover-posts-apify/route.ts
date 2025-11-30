import { supabaseAdmin } from '@/app/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;

/**
 * CRITICAL: Resolve the correct URN from Unipile
 *
 * Apify returns activity URNs from LinkedIn URLs (e.g., urn:li:activity:7400583686523469824)
 * But Unipile needs the actual post URN (e.g., urn:li:ugcPost:7400583515781890048)
 * These have DIFFERENT numeric IDs!
 *
 * This function queries Unipile to get the correct URN for posting comments.
 */
async function resolveCorrectUrn(
  activityUrn: string,
  unipileAccountId: string
): Promise<{ socialId: string; authorName?: string; authorHeadline?: string } | null> {
  try {
    // Query Unipile with the activity URN to get the actual post details
    const response = await fetch(
      `${UNIPILE_BASE_URL}/api/v1/posts/${encodeURIComponent(activityUrn)}?account_id=${unipileAccountId}`,
      {
        method: 'GET',
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.warn(`⚠️ Could not resolve URN from Unipile: ${response.status}`);
      return null;
    }

    const data = await response.json();

    // Unipile returns the correct social_id (usually ugcPost format)
    if (data.social_id) {
      console.log(`✅ Resolved URN: ${activityUrn} → ${data.social_id}`);
      return {
        socialId: data.social_id,
        authorName: data.author?.name,
        authorHeadline: data.author?.headline
      };
    }

    return null;
  } catch (error) {
    console.error(`❌ Error resolving URN:`, error);
    return null;
  }
}

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

    // Get unique workspace IDs from profile monitors
    const workspaceIds = [...new Set(profileMonitors.map(m => m.workspace_id))];

    // Load settings for each workspace
    const { data: workspaceSettings } = await supabase
      .from('linkedin_brand_guidelines')
      .select('workspace_id, profile_scrape_interval_days, max_profile_scrapes_per_day')
      .in('workspace_id', workspaceIds);

    const settingsMap = new Map(
      (workspaceSettings || []).map(s => [s.workspace_id, s])
    );

    // Track scrapes per workspace today
    const scrapesPerWorkspace = new Map<string, number>();
    const today = new Date().toISOString().split('T')[0];

    // Process each profile monitor with rate limiting
    let profilesScrapedThisRun = 0;
    const MAX_PROFILES_PER_RUN = 20; // Hard limit per run

    for (const monitor of profileMonitors) {
      try {
        // Check hard limit per run
        if (profilesScrapedThisRun >= MAX_PROFILES_PER_RUN) {
          console.log(`⏸️ Reached max profiles per run (${MAX_PROFILES_PER_RUN}), stopping`);
          break;
        }

        const settings = settingsMap.get(monitor.workspace_id) || {
          profile_scrape_interval_days: 1,
          max_profile_scrapes_per_day: 20
        };

        // Check if we've hit the daily limit for this workspace
        const workspaceScrapes = scrapesPerWorkspace.get(monitor.workspace_id) || 0;
        if (workspaceScrapes >= settings.max_profile_scrapes_per_day) {
          console.log(`⏸️ Workspace ${monitor.workspace_id} hit daily limit (${settings.max_profile_scrapes_per_day})`);
          continue;
        }

        // Check if this monitor was scraped recently
        const lastScrapedAt = monitor.last_scraped_at ? new Date(monitor.last_scraped_at) : null;
        if (lastScrapedAt) {
          const daysSinceLastScrape = (Date.now() - lastScrapedAt.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceLastScrape < settings.profile_scrape_interval_days) {
            console.log(`⏸️ Skipping monitor ${monitor.id} - scraped ${daysSinceLastScrape.toFixed(1)} days ago (interval: ${settings.profile_scrape_interval_days} days)`);
            continue;
          }
        }

        // Reset daily counter if it's a new day
        if (monitor.scrape_count_reset_date !== today) {
          await supabase
            .from('linkedin_post_monitors')
            .update({
              scrapes_today: 0,
              scrape_count_reset_date: today
            })
            .eq('id', monitor.id);
        }

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
          // Get Unipile account for this workspace to resolve correct URNs
          const { data: linkedinAccount } = await supabase
            .from('workspace_accounts')
            .select('unipile_account_id')
            .eq('workspace_id', monitor.workspace_id)
            .eq('account_type', 'linkedin')
            .eq('connection_status', 'connected')
            .limit(1)
            .single();

          const unipileAccountId = linkedinAccount?.unipile_account_id;

          // CRITICAL: Resolve correct URNs from Unipile before storing
          // Apify returns activity URNs from URLs, but Unipile needs ugcPost URNs to post comments
          // These have DIFFERENT numeric IDs!
          const postsToInsert = await Promise.all(newPosts.map(async (post: any) => {
            let apifySocialId = post.urn?.activity_urn || post.full_urn;

            // Normalize to URN format if just a number
            if (apifySocialId && /^\d+$/.test(apifySocialId)) {
              apifySocialId = `urn:li:activity:${apifySocialId}`;
            }

            // Resolve the correct URN from Unipile (activity → ugcPost)
            let finalSocialId = apifySocialId;
            let resolvedAuthor: { authorName?: string; authorHeadline?: string } = {};

            if (unipileAccountId && apifySocialId) {
              const resolved = await resolveCorrectUrn(apifySocialId, unipileAccountId);
              if (resolved) {
                finalSocialId = resolved.socialId;
                resolvedAuthor = {
                  authorName: resolved.authorName,
                  authorHeadline: resolved.authorHeadline
                };
              }
            }

            return {
              workspace_id: monitor.workspace_id,
              monitor_id: monitor.id,
              social_id: finalSocialId,
              share_url: post.url || `https://www.linkedin.com/feed/update/${post.full_urn}`,
              post_content: post.text || '',
              author_name: resolvedAuthor.authorName || (post.author?.first_name ? `${post.author.first_name} ${post.author.last_name || ''}`.trim() : vanityName),
              author_profile_id: post.author?.username || vanityName,
              author_title: resolvedAuthor.authorHeadline || post.author?.headline || post.author?.title || null,
              author_headline: resolvedAuthor.authorHeadline || post.author?.headline || post.author?.title || null,
              hashtags: [],
              post_date: new Date(post.posted_at?.timestamp).toISOString(),
              engagement_metrics: {
                comments: post.stats?.comments_count || 0,
                reactions: post.stats?.total_reactions || 0,
                reposts: post.stats?.reposts_count || 0
              },
              status: 'discovered'
            };
          }));

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

        // Update monitor tracking after successful scrape
        await supabase
          .from('linkedin_post_monitors')
          .update({
            last_scraped_at: new Date().toISOString(),
            scrapes_today: (monitor.scrapes_today || 0) + 1,
            scrape_count_reset_date: today
          })
          .eq('id', monitor.id);

        // Update tracking counters
        profilesScrapedThisRun++;
        scrapesPerWorkspace.set(
          monitor.workspace_id,
          (scrapesPerWorkspace.get(monitor.workspace_id) || 0) + 1
        );

        console.log(`📊 Profile scrapes this run: ${profilesScrapedThisRun}, workspace today: ${scrapesPerWorkspace.get(monitor.workspace_id)}`);

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

        // IMPORTANT: This Apify actor charges per result
        // We request 5 posts max to stay economical
        const POSTS_PER_HASHTAG = 5;

        const startResponse = await fetch(startRunUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            keyword: keyword,
            // Try multiple parameter names - Apify actors vary
            maxResults: POSTS_PER_HASHTAG,
            resultsLimit: POSTS_PER_HASHTAG,
            limit: POSTS_PER_HASHTAG,
            maxPosts: POSTS_PER_HASHTAG,
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
        // SAFETY: Slice to our limit even if Apify returns more (they charge per result!)
        const rawPosts = Array.isArray(data) ? data : [];
        const posts = rawPosts.slice(0, POSTS_PER_HASHTAG);

        console.log(`📦 Apify hashtag search returned ${rawPosts.length} posts, using first ${posts.length}`);

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
          // Get Unipile account for this workspace to resolve correct URNs
          const { data: linkedinAccount } = await supabase
            .from('workspace_accounts')
            .select('unipile_account_id')
            .eq('workspace_id', monitor.workspace_id)
            .eq('account_type', 'linkedin')
            .eq('connection_status', 'connected')
            .limit(1)
            .single();

          const unipileAccountId = linkedinAccount?.unipile_account_id;

          // CRITICAL: Resolve correct URNs from Unipile before storing
          // Apify returns activity URNs from URLs, but Unipile needs ugcPost URNs to post comments
          // These have DIFFERENT numeric IDs!
          const postsToInsert = await Promise.all(newPosts.map(async (post: any) => {
            let apifySocialId = post.urn || post.postUrn || post.id;

            // Normalize to URN format if just a number
            if (apifySocialId && /^\d+$/.test(String(apifySocialId))) {
              apifySocialId = `urn:li:activity:${apifySocialId}`;
            }

            // Resolve the correct URN from Unipile (activity → ugcPost)
            let finalSocialId = apifySocialId;
            let resolvedAuthor: { authorName?: string; authorHeadline?: string } = {};

            if (unipileAccountId && apifySocialId) {
              const resolved = await resolveCorrectUrn(apifySocialId, unipileAccountId);
              if (resolved) {
                finalSocialId = resolved.socialId;
                resolvedAuthor = {
                  authorName: resolved.authorName,
                  authorHeadline: resolved.authorHeadline
                };
              }
            }

            return {
              workspace_id: monitor.workspace_id,
              monitor_id: monitor.id,
              social_id: finalSocialId,
              share_url: post.url || post.postUrl || `https://www.linkedin.com/feed/update/${apifySocialId}`,
              post_content: post.text || post.content || '',
              author_name: resolvedAuthor.authorName || post.authorName || post.author?.name || post.author?.first_name || 'Unknown',
              author_profile_id: post.authorProfileId || post.author?.username || post.author?.vanityName || null,
              author_title: resolvedAuthor.authorHeadline || post.authorTitle || post.author?.headline || null,
              author_headline: resolvedAuthor.authorHeadline || post.authorHeadline || post.author?.headline || null,
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
          }));

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
