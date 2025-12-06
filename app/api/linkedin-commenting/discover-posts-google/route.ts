/**
 * LinkedIn Post Discovery via Google Custom Search
 *
 * Replaces Apify for hashtag-based post discovery.
 * Uses Google Custom Search API with site:linkedin.com filter.
 *
 * Cost: $0.005 per query (vs Apify's $4+ per run)
 * Results: ~10 posts per query, max 30 per hashtag (3 queries)
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Limits
const MAX_RESULTS_PER_HASHTAG = 25;
const RESULTS_PER_QUERY = 10; // Google returns max 10 per query
const MAX_QUERIES_PER_HASHTAG = 3; // 3 queries × 10 = 30 results max
const COOLDOWN_HOURS = 2; // Don't re-scrape same hashtag within 2 hours

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

export async function POST(request: NextRequest) {
  console.log('🔍 LinkedIn Post Discovery via Google Custom Search');
  console.log(`   Time: ${new Date().toISOString()}`);

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

    // Filter to hashtag monitors only
    const hashtagMonitors = monitors.filter(m =>
      m.hashtags?.some((h: string) => h.startsWith('HASHTAG:'))
    );

    console.log(`🏷️ ${hashtagMonitors.length} monitors have hashtags`);

    const results: Array<{
      monitor_id: string;
      hashtag: string;
      posts_found: number;
      posts_saved: number;
    }> = [];

    let totalQueriesUsed = 0;

    for (const monitor of hashtagMonitors) {
      // Check cooldown
      if (monitor.last_scraped_at) {
        const lastScraped = new Date(monitor.last_scraped_at);
        const hoursSince = (Date.now() - lastScraped.getTime()) / (1000 * 60 * 60);
        if (hoursSince < COOLDOWN_HOURS) {
          console.log(`⏸️ Monitor ${monitor.id} on cooldown (${Math.round(hoursSince * 60)} min since last scrape)`);
          continue;
        }
      }

      // Extract hashtags
      const hashtags = monitor.hashtags
        .filter((h: string) => h.startsWith('HASHTAG:'))
        .map((h: string) => h.replace('HASHTAG:', ''));

      for (const hashtag of hashtags) {
        console.log(`\n🔍 Searching for #${hashtag}...`);

        const posts: Array<{
          post_url: string;
          author_name: string;
          title: string;
          snippet: string;
        }> = [];

        // Run up to MAX_QUERIES_PER_HASHTAG queries (pagination)
        for (let queryNum = 0; queryNum < MAX_QUERIES_PER_HASHTAG; queryNum++) {
          const startIndex = queryNum * RESULTS_PER_QUERY + 1;

          // Build Google Custom Search URL
          // Search for LinkedIn posts with the hashtag
          const searchQuery = `site:linkedin.com/posts "#${hashtag}"`;
          const googleUrl = new URL('https://www.googleapis.com/customsearch/v1');
          googleUrl.searchParams.set('key', GOOGLE_API_KEY);
          googleUrl.searchParams.set('cx', GOOGLE_CX);
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
              break;
            }

            if (!data.items || data.items.length === 0) {
              console.log(`   📭 No items in response. Keys: ${Object.keys(data).join(', ')}`);
              break;
            }

            console.log(`   ✅ Got ${data.items.length} results`);
            console.log(`   First item link: ${data.items[0]?.link?.substring(0, 80)}`);

            // Parse results
            for (const item of data.items) {
              // Only process LinkedIn post URLs
              if (!item.link.includes('linkedin.com/posts/')) {
                continue;
              }

              // Extract author name from URL or title
              // URL format: linkedin.com/posts/firstname-lastname_hashtag-...
              const urlMatch = item.link.match(/linkedin\.com\/posts\/([^_]+)/);
              const authorFromUrl = urlMatch ? urlMatch[1].replace(/-/g, ' ') : 'Unknown';

              posts.push({
                post_url: item.link,
                author_name: authorFromUrl,
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

        console.log(`   📊 Total posts found for #${hashtag}: ${posts.length}`);

        // Save posts to database
        let savedCount = 0;
        for (const post of posts.slice(0, MAX_RESULTS_PER_HASHTAG)) {
          // Check if post already exists
          const { data: existing } = await supabase
            .from('linkedin_posts_discovered')
            .select('id')
            .eq('post_url', post.post_url)
            .single();

          if (existing) {
            console.log(`   ⏭️ Post already exists: ${post.post_url.substring(0, 60)}...`);
            continue;
          }

          // Insert new post
          // Note: metadata column doesn't exist in table, store title in author_name temporarily
          const { error: insertError } = await supabase
            .from('linkedin_posts_discovered')
            .insert({
              monitor_id: monitor.id,
              workspace_id: monitor.workspace_id,
              post_url: post.post_url,
              author_name: post.author_name,
              hashtags: [hashtag],
              status: 'discovered',
              discovered_at: new Date().toISOString()
              // Note: title and snippet from Google search not stored (no metadata column)
            });

          if (insertError) {
            console.error(`   ❌ Insert error:`, insertError.message);
          } else {
            savedCount++;
            console.log(`   ✅ Saved: ${post.author_name} - ${post.post_url.substring(0, 50)}...`);
          }
        }

        results.push({
          monitor_id: monitor.id,
          hashtag,
          posts_found: posts.length,
          posts_saved: savedCount
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
      note: `Google Custom Search: $0.005/query vs Apify's $4+/run`
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
    service: 'LinkedIn Post Discovery via Google Custom Search',
    status: 'ready',
    config: {
      api_key_configured: !!GOOGLE_API_KEY,
      cx_configured: !!GOOGLE_CX,
      api_key_preview: GOOGLE_API_KEY?.substring(0, 10) + '...',
      cx_preview: GOOGLE_CX?.substring(0, 10) + '...',
      max_results_per_hashtag: MAX_RESULTS_PER_HASHTAG,
      cooldown_hours: COOLDOWN_HOURS,
      cost_per_query: '$0.005'
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
