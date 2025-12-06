/**
 * LinkedIn Post Discovery via Google Custom Search + Unipile API
 *
 * Replaces Apify for hashtag-based post discovery.
 *
 * Search Types:
 * - HASHTAG: Google Custom Search (site:linkedin.com/posts "#term")
 * - KEYWORD: Google Custom Search (site:linkedin.com/posts "term")
 * - PROFILE: Unipile API (guaranteed results from public profiles)
 *
 * Cost: $0.005 per Google query (vs Apify's $4+ per run)
 * Unipile: Free (uses existing account)
 *
 * Google Custom Search API:
 * - Free: 100 queries/day
 * - Paid: $5 per 1,000 queries
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Environment variables
const GOOGLE_API_KEY = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
const GOOGLE_CX = process.env.GOOGLE_CUSTOM_SEARCH_CX; // Custom Search Engine ID
const CRON_SECRET = process.env.CRON_SECRET;

// Unipile credentials for profile-based discovery
const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const UNIPILE_ACCOUNT_ID = 'ymtTx4xVQ6OVUFk83ctwtA'; // Irish LinkedIn account

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Limits
const MAX_RESULTS_PER_HASHTAG = 10;  // 10 results per term is plenty for commenting
const RESULTS_PER_QUERY = 10; // Google returns max 10 per query
const MAX_QUERIES_PER_HASHTAG = 1; // 1 query per term = 10 results (was 3 = 30)
const COOLDOWN_HOURS = 4; // Don't re-scrape same hashtag within 4 hours (was 2)

// Engagement waiting period: random delay before we can comment (1-4 hours)
const MIN_WAIT_HOURS = 1;
const MAX_WAIT_HOURS = 4;

/**
 * Fetch full post content from Unipile API
 * Uses the URN format social_id to get the actual post text
 */
async function fetchPostContentFromUnipile(socialId: string): Promise<{
  text: string | null;
  author_name: string | null;
  author_headline: string | null;
  engagement: { likes: number; comments: number; shares: number } | null;
}> {
  if (!UNIPILE_DSN || !UNIPILE_API_KEY) {
    return { text: null, author_name: null, author_headline: null, engagement: null };
  }

  try {
    const baseUrl = `https://${UNIPILE_DSN}`;
    const postUrl = `${baseUrl}/api/v1/posts/${encodeURIComponent(socialId)}?account_id=${UNIPILE_ACCOUNT_ID}`;

    const response = await fetch(postUrl, {
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log(`   ⚠️ Could not fetch post content: ${response.status}`);
      return { text: null, author_name: null, author_headline: null, engagement: null };
    }

    const data = await response.json();

    return {
      text: data.text || null,
      author_name: data.author?.name || null,
      author_headline: data.author?.headline || null,
      engagement: {
        likes: data.reaction_counter || 0,
        comments: data.comment_counter || 0,
        shares: data.repost_counter || 0
      }
    };
  } catch (error) {
    console.log(`   ⚠️ Error fetching post content:`, error);
    return { text: null, author_name: null, author_headline: null, engagement: null };
  }
}

/**
 * Generate a random comment_eligible_at timestamp
 * This creates a random delay between MIN_WAIT_HOURS and MAX_WAIT_HOURS
 * Purpose: Never comment immediately - wait for engagement from other users
 */
function getRandomEligibleTime(): string {
  const minMs = MIN_WAIT_HOURS * 60 * 60 * 1000;
  const maxMs = MAX_WAIT_HOURS * 60 * 60 * 1000;
  const randomDelayMs = minMs + Math.random() * (maxMs - minMs);
  return new Date(Date.now() + randomDelayMs).toISOString();
}

interface GoogleSearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
}

interface GoogleSearchResponse {
  items?: GoogleSearchResult[];
  searchInformation?: {
    totalResults: string;
  };
  error?: {
    code: number;
    message: string;
  };
}

// Unipile post structure
interface UnipilePost {
  id: string;
  text?: string;
  share_url?: string;
  created_at?: string;
  author?: {
    name?: string;
    public_identifier?: string;
  };
}

/**
 * Discover posts from a LinkedIn profile using Unipile API
 *
 * Two-step process:
 * 1. Look up profile to get provider_id: GET /api/v1/users/{vanity}?account_id=...
 * 2. Fetch posts: GET /api/v1/users/{provider_id}/posts?account_id=...
 *
 * NO connection required - can fetch public posts from any profile
 */
async function discoverProfilePostsViaUnipile(vanity: string): Promise<{
  success: boolean;
  posts: Array<{
    share_url: string;
    author_name: string;
    social_id: string;
    title: string;
    snippet: string;
  }>;
  error?: string;
}> {
  if (!UNIPILE_DSN || !UNIPILE_API_KEY) {
    return { success: false, posts: [], error: 'Unipile not configured' };
  }

  const baseUrl = `https://${UNIPILE_DSN}`;
  const headers = {
    'X-API-KEY': UNIPILE_API_KEY,
    'Content-Type': 'application/json'
  };

  try {
    // Step 1: Look up profile to get provider_id
    console.log(`   🔍 Unipile: Looking up profile for ${vanity}...`);
    const profileUrl = `${baseUrl}/api/v1/users/${vanity}?account_id=${UNIPILE_ACCOUNT_ID}`;

    const profileResponse = await fetch(profileUrl, { headers });

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      console.error(`   ❌ Unipile profile lookup failed:`, profileResponse.status, errorText.substring(0, 200));
      return { success: false, posts: [], error: `Profile lookup failed: ${profileResponse.status}` };
    }

    const profileData = await profileResponse.json();
    const providerId = profileData.provider_id || profileData.id;
    const authorName = profileData.first_name && profileData.last_name
      ? `${profileData.first_name} ${profileData.last_name}`
      : profileData.name || vanity;

    if (!providerId) {
      console.error(`   ❌ No provider_id in profile response:`, Object.keys(profileData));
      return { success: false, posts: [], error: 'No provider_id in profile' };
    }

    console.log(`   ✅ Got provider_id: ${providerId}, name: ${authorName}`);

    // Step 2: Fetch posts using provider_id
    console.log(`   📬 Unipile: Fetching posts for ${authorName}...`);
    const postsUrl = `${baseUrl}/api/v1/users/${providerId}/posts?account_id=${UNIPILE_ACCOUNT_ID}&limit=10`;

    const postsResponse = await fetch(postsUrl, { headers });

    if (!postsResponse.ok) {
      const errorText = await postsResponse.text();
      console.error(`   ❌ Unipile posts fetch failed:`, postsResponse.status, errorText.substring(0, 200));
      return { success: false, posts: [], error: `Posts fetch failed: ${postsResponse.status}` };
    }

    const postsData = await postsResponse.json();
    const items: UnipilePost[] = postsData.items || postsData || [];

    console.log(`   ✅ Got ${items.length} posts from Unipile`);

    // Transform to our format
    // CRITICAL: Extract activity ID from share_url and format as URN for Unipile commenting API
    // post.id is the ugcPost ID, but Unipile commenting needs urn:li:activity:{activityId}
    const posts = items.map((post: UnipilePost) => {
      // Extract activity ID from share_url: activity-1234567890
      const activityMatch = post.share_url?.match(/activity-(\d+)/);
      const socialId = activityMatch
        ? `urn:li:activity:${activityMatch[1]}`
        : `urn:li:ugcPost:${post.id}`; // Fallback to ugcPost URN

      return {
        share_url: post.share_url || `https://www.linkedin.com/feed/update/urn:li:activity:${post.id}`,
        author_name: authorName,
        social_id: socialId,
        title: `Post by ${authorName}`,
        snippet: (post.text || '').substring(0, 200)
      };
    });

    return { success: true, posts };

  } catch (error) {
    console.error(`   ❌ Unipile error:`, error);
    return {
      success: false,
      posts: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function POST(request: NextRequest) {
  console.log('🔍 LinkedIn Post Discovery (Google + Unipile)');
  console.log(`   Time: ${new Date().toISOString()}`);
  console.log(`   Google: Hashtags & Keywords | Unipile: Profile posts`);

  // Verify cron secret
  const cronSecret = request.headers.get('x-cron-secret');
  if (cronSecret !== CRON_SECRET) {
    console.error('❌ Invalid cron secret');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check for required env vars
  if (!GOOGLE_API_KEY) {
    console.error('❌ GOOGLE_CUSTOM_SEARCH_API_KEY not configured');
    return NextResponse.json({
      error: 'Google API key not configured',
      setup: 'Set GOOGLE_CUSTOM_SEARCH_API_KEY in Netlify environment variables'
    }, { status: 500 });
  }

  if (!GOOGLE_CX) {
    console.error('❌ GOOGLE_CUSTOM_SEARCH_CX not configured');
    return NextResponse.json({
      error: 'Google Custom Search Engine ID not configured',
      setup: 'Create a Custom Search Engine at https://programmablesearchengine.google.com/ and set GOOGLE_CUSTOM_SEARCH_CX'
    }, { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // Get active hashtag monitors
    const { data: monitors, error: monitorError } = await supabase
      .from('linkedin_post_monitors')
      .select('id, workspace_id, hashtags, last_scraped_at, name')
      .eq('status', 'active');

    if (monitorError) {
      console.error('❌ Error fetching monitors:', monitorError);
      return NextResponse.json({ error: monitorError.message }, { status: 500 });
    }

    if (!monitors || monitors.length === 0) {
      console.log('📭 No active monitors found');
      return NextResponse.json({ success: true, message: 'No active monitors' });
    }

    console.log(`📊 Found ${monitors.length} active monitors`);

    // Filter to monitors with hashtags, keywords, OR profiles
    const searchMonitors = monitors.filter(m =>
      m.hashtags?.some((h: string) => h.startsWith('HASHTAG:') || h.startsWith('KEYWORD:') || h.startsWith('PROFILE:'))
    );

    console.log(`🏷️ ${searchMonitors.length} monitors have hashtags or keywords`);

    const results: Array<{
      monitor_id: string;
      term: string;
      type: 'hashtag' | 'keyword' | 'profile';
      posts_found: number;
      posts_saved: number;
      debug?: {
        google_items_count?: number;
        google_error?: string;
        first_link?: string;
        insert_errors?: string[];
        insert_attempts?: number;
        skipped_existing?: number;
      };
    }> = [];

    let totalQueriesUsed = 0;

    for (const monitor of searchMonitors) {
      // Check cooldown
      if (monitor.last_scraped_at) {
        const lastScraped = new Date(monitor.last_scraped_at);
        const hoursSince = (Date.now() - lastScraped.getTime()) / (1000 * 60 * 60);
        if (hoursSince < COOLDOWN_HOURS) {
          console.log(`⏸️ Monitor ${monitor.id} on cooldown (${Math.round(hoursSince * 60)} min since last scrape)`);
          continue;
        }
      }

      // Extract hashtags (prefixed with HASHTAG:)
      const hashtags = monitor.hashtags
        .filter((h: string) => h.startsWith('HASHTAG:'))
        .map((h: string) => ({ term: h.replace('HASHTAG:', ''), type: 'hashtag' as const }));

      // Extract keywords (prefixed with KEYWORD:) - searches post text without #
      const keywords = monitor.hashtags
        .filter((h: string) => h.startsWith('KEYWORD:'))
        .map((h: string) => ({ term: h.replace('KEYWORD:', ''), type: 'keyword' as const }));

      // Extract profiles (prefixed with PROFILE:) - searches posts from specific LinkedIn profiles
      // Use LinkedIn vanity URL: PROFILE:john-doe → site:linkedin.com/posts/john-doe
      const profiles = monitor.hashtags
        .filter((h: string) => h.startsWith('PROFILE:'))
        .map((h: string) => ({ term: h.replace('PROFILE:', ''), type: 'profile' as const }));

      // Combine all search terms
      const searchTerms = [...hashtags, ...keywords, ...profiles];
      console.log(`   🔍 Monitor has ${hashtags.length} hashtags, ${keywords.length} keywords, ${profiles.length} profiles`);

      // Fetch ALL existing share_urls for this workspace to avoid duplicates
      // This is more efficient than checking each post individually
      const { data: existingPosts } = await supabase
        .from('linkedin_posts_discovered')
        .select('share_url')
        .eq('workspace_id', monitor.workspace_id);

      const existingUrls = new Set(existingPosts?.map(p => p.share_url) || []);
      console.log(`   📋 ${existingUrls.size} existing posts in workspace (will skip these)`);

      for (const { term, type } of searchTerms) {
        // Log differently based on type
        if (type === 'hashtag') {
          console.log(`\n🔍 Searching for #${term} (hashtag)...`);
        } else if (type === 'keyword') {
          console.log(`\n🔍 Searching for "${term}" (keyword in post text)...`);
        } else {
          console.log(`\n🔍 Searching for posts by ${term} (profile)...`);
        }

        const posts: Array<{
          share_url: string;
          author_name: string;
          social_id: string;
          title: string;
          snippet: string;
        }> = [];

        // Debug info for this search term
        let debugInfo: {
          google_items_count?: number;
          google_error?: string;
          unipile_posts_count?: number;
          unipile_error?: string;
          first_link?: string;
          insert_errors?: string[];
          insert_attempts?: number;
          skipped_existing?: number;
        } = { insert_errors: [], insert_attempts: 0, skipped_existing: 0 };

        // PROFILE searches use Unipile API (guaranteed results from public profiles)
        // HASHTAG and KEYWORD searches use Google Custom Search
        if (type === 'profile') {
          // Use Unipile API for profile-based discovery
          console.log(`   🔗 Using Unipile API for profile discovery (guaranteed results)`);

          const unipileResult = await discoverProfilePostsViaUnipile(term);

          if (!unipileResult.success) {
            console.error(`   ❌ Unipile failed: ${unipileResult.error}`);
            debugInfo.unipile_error = unipileResult.error;
          } else {
            debugInfo.unipile_posts_count = unipileResult.posts.length;

            // Filter out existing posts
            for (const post of unipileResult.posts) {
              if (existingUrls.has(post.share_url)) {
                debugInfo.skipped_existing = (debugInfo.skipped_existing || 0) + 1;
                continue;
              }
              posts.push(post);
              if (posts.length >= MAX_RESULTS_PER_HASHTAG) break;
            }

            if (posts.length > 0) {
              debugInfo.first_link = posts[0].share_url.substring(0, 100);
            }
          }

        } else {
          // Use Google Custom Search for hashtag/keyword searches
          // Run up to MAX_QUERIES_PER_HASHTAG queries (pagination)
          for (let queryNum = 0; queryNum < MAX_QUERIES_PER_HASHTAG; queryNum++) {
            const startIndex = queryNum * RESULTS_PER_QUERY + 1;

            // Build Google Custom Search URL
            // KEY DIFFERENCE:
            // - hashtags: site:linkedin.com/posts "#Bitcoin"
            // - keywords: site:linkedin.com/posts "Bitcoin" (in post text)
            let searchQuery: string;
            if (type === 'hashtag') {
              searchQuery = `site:linkedin.com/posts "#${term}"`;
            } else {
              searchQuery = `site:linkedin.com/posts "${term}"`;
            }
            const googleUrl = new URL('https://www.googleapis.com/customsearch/v1');
            googleUrl.searchParams.set('key', GOOGLE_API_KEY!);
            googleUrl.searchParams.set('cx', GOOGLE_CX!);
            googleUrl.searchParams.set('q', searchQuery);
            googleUrl.searchParams.set('start', startIndex.toString());
            googleUrl.searchParams.set('num', RESULTS_PER_QUERY.toString());

            console.log(`   Query ${queryNum + 1}: start=${startIndex}`);
            console.log(`   URL: ${googleUrl.toString().substring(0, 150)}...`);

            try {
              const response = await fetch(googleUrl.toString());
              const responseText = await response.text();

              let data: GoogleSearchResponse;
              try {
                data = JSON.parse(responseText);
              } catch (parseError) {
                console.error(`   ❌ JSON parse error:`, responseText.substring(0, 200));
                break;
              }

              totalQueriesUsed++;

              if (data.error) {
                console.error(`   ❌ Google API error: ${data.error.message}`);
                console.error(`   Error details:`, JSON.stringify(data.error).substring(0, 300));
                debugInfo.google_error = data.error.message;
                break;
              }

              if (!data.items || data.items.length === 0) {
                console.log(`   📭 No items in response. Keys: ${Object.keys(data).join(', ')}`);
                debugInfo.google_items_count = 0;
                break;
              }

              console.log(`   ✅ Got ${data.items.length} results`);
              console.log(`   First item link: ${data.items[0]?.link?.substring(0, 80)}`);
              debugInfo.google_items_count = data.items.length;
              debugInfo.first_link = data.items[0]?.link?.substring(0, 100);

              // Parse results
              for (const item of data.items) {
                // Only process LinkedIn post URLs
                if (!item.link.includes('linkedin.com/posts/')) {
                  continue;
                }

                // Skip if already exists in database
                if (existingUrls.has(item.link)) {
                  debugInfo.skipped_existing = (debugInfo.skipped_existing || 0) + 1;
                  continue;
                }

                // Extract author name from URL or title
                // URL format: linkedin.com/posts/firstname-lastname_hashtag-activity-1234567890-xyz
                const urlMatch = item.link.match(/linkedin\.com\/posts\/([^_]+)/);
                const authorFromUrl = urlMatch ? urlMatch[1].replace(/-/g, ' ') : 'Unknown';

                // Extract social_id (activity ID) from URL and format as URN for Unipile
                // Format: activity-1234567890 in URL -> urn:li:activity:1234567890 for Unipile API
                const activityMatch = item.link.match(/activity-(\d+)/);
                const socialId = activityMatch
                  ? `urn:li:activity:${activityMatch[1]}`
                  : `google-${Date.now()}-${Math.random().toString(36).substring(7)}`;

                posts.push({
                  share_url: item.link,
                  author_name: authorFromUrl,
                  social_id: socialId,
                  title: item.title,
                  snippet: item.snippet
                });
              }

              // Stop if we have enough results
              if (posts.length >= MAX_RESULTS_PER_HASHTAG) {
                console.log(`   ✓ Reached ${MAX_RESULTS_PER_HASHTAG} results limit`);
                break;
              }

            } catch (fetchError) {
              console.error(`   ❌ Fetch error:`, fetchError);
              break;
            }
          }
        }

        // Log with proper formatting based on type
        const termDisplay = type === 'hashtag' ? `#${term}` : type === 'keyword' ? `"${term}"` : `@${term}`;
        console.log(`   📊 New posts found for ${termDisplay}: ${posts.length} (skipped ${debugInfo.skipped_existing || 0} existing)`);

        // Save posts to database (all posts in the array are new - already filtered)
        let savedCount = 0;
        for (const post of posts.slice(0, MAX_RESULTS_PER_HASHTAG)) {
          // Insert new post (no need to check existence - already filtered during parsing)
          // Set random comment_eligible_at (1-4 hours from now) to enforce waiting period
          debugInfo.insert_attempts = (debugInfo.insert_attempts || 0) + 1;
          const eligibleAt = getRandomEligibleTime();

          // CRITICAL: Fetch actual post content from Unipile
          // Google discovery only gives us URLs - we need the actual text to generate good comments
          console.log(`   📥 Fetching content for: ${post.social_id}`);
          const postContent = await fetchPostContentFromUnipile(post.social_id);

          // Skip posts where we couldn't get content - we can't generate good comments without it
          if (!postContent.text) {
            console.log(`   ⏭️ Skipping post - no content available`);
            continue;
          }

          const { error: insertError } = await supabase
            .from('linkedin_posts_discovered')
            .insert({
              monitor_id: monitor.id,
              workspace_id: monitor.workspace_id,
              share_url: post.share_url,
              author_name: postContent.author_name || post.author_name,
              author_headline: postContent.author_headline,
              social_id: post.social_id,
              // Store the actual post content from Unipile
              post_content: postContent.text,
              // Store engagement metrics
              engagement_metrics: postContent.engagement ? {
                reactions: postContent.engagement.likes,
                comments: postContent.engagement.comments,
                reposts: postContent.engagement.shares
              } : null,
              // Store the search term - hashtags get #, profiles get @, keywords just the term
              hashtags: type === 'hashtag' ? [`#${term}`] : type === 'profile' ? [`@${term}`] : [term],
              status: 'discovered',
              // RANDOMIZER: Wait 1-4 hours before allowing comments (never comment immediately)
              comment_eligible_at: eligibleAt
            });

          if (insertError) {
            console.error(`   ❌ Insert error:`, insertError.message);
            debugInfo.insert_errors?.push(insertError.message);
          } else {
            savedCount++;
            // Add to existingUrls to prevent duplicates within same run
            existingUrls.add(post.share_url);
            console.log(`   ✅ Saved: ${postContent.author_name || post.author_name} - "${postContent.text?.substring(0, 50)}..."`);
          }
        }

        results.push({
          monitor_id: monitor.id,
          term,
          type,
          posts_found: posts.length,
          posts_saved: savedCount,
          debug: debugInfo
        });
      }

      // Update last_scraped_at
      await supabase
        .from('linkedin_post_monitors')
        .update({ last_scraped_at: new Date().toISOString() })
        .eq('id', monitor.id);
    }

    // Calculate cost
    const estimatedCost = totalQueriesUsed * 0.005;

    console.log(`\n📊 Summary:`);
    console.log(`   Queries used: ${totalQueriesUsed}`);
    console.log(`   Estimated cost: $${estimatedCost.toFixed(3)}`);
    console.log(`   Results:`, results);

    return NextResponse.json({
      success: true,
      queries_used: totalQueriesUsed,
      estimated_cost_usd: estimatedCost,
      results,
      note: `Hashtags/Keywords: Google ($0.005/query) | Profiles: Unipile (free)`
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// GET endpoint for testing/status
export async function GET(request: NextRequest) {
  // If ?test=1, do a live test
  const testMode = request.nextUrl.searchParams.get('test') === '1';

  if (testMode && GOOGLE_API_KEY && GOOGLE_CX) {
    try {
      const searchQuery = 'site:linkedin.com/posts "#GenAI"';
      const googleUrl = new URL('https://www.googleapis.com/customsearch/v1');
      googleUrl.searchParams.set('key', GOOGLE_API_KEY);
      googleUrl.searchParams.set('cx', GOOGLE_CX);
      googleUrl.searchParams.set('q', searchQuery);
      googleUrl.searchParams.set('num', '3');

      const response = await fetch(googleUrl.toString());
      const data = await response.json();

      return NextResponse.json({
        test: 'live',
        url_preview: googleUrl.toString().substring(0, 100) + '...',
        response_keys: Object.keys(data),
        has_error: !!data.error,
        error_message: data.error?.message,
        items_count: data.items?.length || 0,
        first_item_link: data.items?.[0]?.link?.substring(0, 80),
        has_posts_path: data.items?.[0]?.link?.includes('linkedin.com/posts/') || false
      });
    } catch (e) {
      return NextResponse.json({ test: 'error', error: String(e) });
    }
  }

  return NextResponse.json({
    service: 'LinkedIn Post Discovery (Google + Unipile)',
    status: 'ready',
    search_types: {
      'HASHTAG:term': 'Google Custom Search (site:linkedin.com/posts "#term")',
      'KEYWORD:term': 'Google Custom Search (site:linkedin.com/posts "term")',
      'PROFILE:vanity': 'Unipile API (guaranteed results from public profiles)'
    },
    config: {
      google: {
        api_key_configured: !!GOOGLE_API_KEY,
        cx_configured: !!GOOGLE_CX,
        api_key_preview: GOOGLE_API_KEY?.substring(0, 10) + '...',
        cx_preview: GOOGLE_CX?.substring(0, 10) + '...',
        cost_per_query: '$0.005'
      },
      unipile: {
        dsn_configured: !!UNIPILE_DSN,
        api_key_configured: !!UNIPILE_API_KEY,
        account_id: UNIPILE_ACCOUNT_ID,
        cost_per_query: 'free'
      },
      max_results_per_term: MAX_RESULTS_PER_HASHTAG,
      cooldown_hours: COOLDOWN_HOURS
    },
    test_url: '?test=1',
    setup: !GOOGLE_API_KEY || !GOOGLE_CX ? {
      step1: 'Create Custom Search Engine at https://programmablesearchengine.google.com/',
      step2: 'Enable "Search the entire web" in settings',
      step3: 'Get API key from https://console.cloud.google.com/apis/credentials',
      step4: 'Enable "Custom Search API" in Google Cloud Console',
      step5: 'Set GOOGLE_CUSTOM_SEARCH_API_KEY and GOOGLE_CUSTOM_SEARCH_CX in Netlify'
    } : undefined
  });
}
