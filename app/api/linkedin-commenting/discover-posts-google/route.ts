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

    // Filter to monitors with hashtags OR keywords
    const searchMonitors = monitors.filter(m =>
      m.hashtags?.some((h: string) => h.startsWith('HASHTAG:') || h.startsWith('KEYWORD:'))
    );

    console.log(`🏷️ ${searchMonitors.length} monitors have hashtags or keywords`);

    const results: Array<{
      monitor_id: string;
      term: string;
      type: 'hashtag' | 'keyword';
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

      // Combine all search terms
      const searchTerms = [...hashtags, ...keywords];
      console.log(`   🔍 Monitor has ${hashtags.length} hashtags and ${keywords.length} keywords`);

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
        } else {
          console.log(`\n🔍 Searching for "${term}" (keyword in post text)...`);
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
          first_link?: string;
          insert_errors?: string[];
          insert_attempts?: number;
          skipped_existing?: number;
        } = { insert_errors: [], insert_attempts: 0, skipped_existing: 0 };

        // Run up to MAX_QUERIES_PER_HASHTAG queries (pagination)
        for (let queryNum = 0; queryNum < MAX_QUERIES_PER_HASHTAG; queryNum++) {
          const startIndex = queryNum * RESULTS_PER_QUERY + 1;

          // Build Google Custom Search URL
          // KEY DIFFERENCE: hashtags use "#term", keywords use just "term"
          const searchQuery = type === 'hashtag'
            ? `site:linkedin.com/posts "#${term}"`      // Hashtag: search for #Bitcoin
            : `site:linkedin.com/posts "${term}"`;      // Keyword: search for Bitcoin (in post text)
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

              // Extract social_id (activity ID) from URL
              // Format: activity-1234567890 at the end before the hash
              const activityMatch = item.link.match(/activity-(\d+)/);
              const socialId = activityMatch ? activityMatch[1] : `google-${Date.now()}-${Math.random().toString(36).substring(7)}`;

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

        // Log with proper formatting based on type
        const termDisplay = type === 'hashtag' ? `#${term}` : `"${term}"`;
        console.log(`   📊 New posts found for ${termDisplay}: ${posts.length} (skipped ${debugInfo.skipped_existing || 0} existing)`);

        // Save posts to database (all posts in the array are new - already filtered)
        let savedCount = 0;
        for (const post of posts.slice(0, MAX_RESULTS_PER_HASHTAG)) {
          // Insert new post (no need to check existence - already filtered during parsing)
          debugInfo.insert_attempts = (debugInfo.insert_attempts || 0) + 1;
          const { error: insertError } = await supabase
            .from('linkedin_posts_discovered')
            .insert({
              monitor_id: monitor.id,
              workspace_id: monitor.workspace_id,
              share_url: post.share_url,
              author_name: post.author_name,
              social_id: post.social_id,
              // Store the search term - for hashtags include #, for keywords just the term
              hashtags: type === 'hashtag' ? [`#${term}`] : [term],
              status: 'discovered'
            });

          if (insertError) {
            console.error(`   ❌ Insert error:`, insertError.message);
            debugInfo.insert_errors?.push(insertError.message);
          } else {
            savedCount++;
            // Add to existingUrls to prevent duplicates within same run
            existingUrls.add(post.share_url);
            console.log(`   ✅ Saved: ${post.author_name} - ${post.share_url.substring(0, 50)}...`);
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
