/**
 * LinkedIn Hashtag Post Discovery via Unipile API
 *
 * Discovers LinkedIn posts by keyword/hashtag using Unipile's authenticated LinkedIn search.
 * Much faster and more reliable than web scraping.
 *
 * Flow:
 * 1. Get active monitors with hashtags (not PROFILE: prefixed)
 * 2. For each hashtag, search LinkedIn via Unipile API
 * 3. Extract posts (author, content, engagement, URL)
 * 4. Save to linkedin_posts_discovered table
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const UNIPILE_DSN = process.env.UNIPILE_DSN || 'api6.unipile.com:13670';
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;
const UNIPILE_ACCOUNT_ID = process.env.UNIPILE_ACCOUNT_ID!;
const CRON_SECRET = process.env.CRON_SECRET;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Limits (3 keywords × 15 posts = 45 max per day)
const MAX_POSTS_PER_KEYWORD = 15;
const MAX_KEYWORDS_PER_RUN = 3;

interface UnipilePost {
  social_id: string;
  share_url: string;
  text: string;
  date: string;
  parsed_datetime?: string;
  reaction_counter: number;
  comment_counter: number;
  repost_counter: number;
  author: {
    id: string;
    name: string;
    headline?: string;
    public_identifier: string;
    is_company: boolean;
  };
  attachments?: Array<{
    type: string;
    url: string;
  }>;
}

/**
 * Search LinkedIn posts via Unipile API
 */
async function searchLinkedInPosts(keyword: string): Promise<UnipilePost[]> {
  console.log(`🔍 Searching LinkedIn for: ${keyword}`);

  try {
    const response = await fetch(
      `https://${UNIPILE_DSN}/api/v1/linkedin/search?account_id=${UNIPILE_ACCOUNT_ID}`,
      {
        method: 'POST',
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api: 'classic',
          category: 'posts',
          keywords: keyword,
          date_posted: 'past_day',
          sort_by: 'date',
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Unipile search error: ${error}`);
      return [];
    }

    const data = await response.json();
    const posts = data.items || [];

    console.log(`✅ Found ${posts.length} posts for "${keyword}"`);
    return posts.slice(0, MAX_POSTS_PER_KEYWORD);
  } catch (error) {
    console.error(`❌ Search error for "${keyword}":`, error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  console.log('🚀 Starting Unipile hashtag discovery...');

  // Verify cron secret for scheduled calls
  const cronSecret = request.headers.get('x-cron-secret');
  const isScheduled = request.headers.get('x-netlify-scheduled') === 'true';

  if (isScheduled && cronSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Get all active monitors
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
      return NextResponse.json({
        success: true,
        message: 'No active monitors',
        discovered: 0,
      });
    }

    // Collect all unique hashtags (excluding PROFILE: prefixed ones)
    const allHashtags = new Set<string>();
    const hashtagToMonitors = new Map<string, string[]>();

    monitors.forEach((monitor) => {
      const hashtags = monitor.hashtags || [];
      hashtags.forEach((tag: string) => {
        // Skip profile monitors
        if (tag.startsWith('PROFILE:')) return;

        // Handle different formats: "GenAI", "#GenAI", "HASHTAG:GenAI", "KEYWORD:GenAI"
        let cleanTag = tag;
        if (cleanTag.startsWith('HASHTAG:')) cleanTag = cleanTag.substring(8);
        if (cleanTag.startsWith('KEYWORD:')) cleanTag = cleanTag.substring(8);
        cleanTag = cleanTag.replace(/^#/, '');

        allHashtags.add(cleanTag);

        // Track which monitors want this hashtag
        if (!hashtagToMonitors.has(cleanTag)) {
          hashtagToMonitors.set(cleanTag, []);
        }
        hashtagToMonitors.get(cleanTag)!.push(monitor.id);
      });
    });

    const hashtagsToSearch = Array.from(allHashtags).slice(0, MAX_KEYWORDS_PER_RUN);
    console.log(`📋 Searching ${hashtagsToSearch.length} keywords:`, hashtagsToSearch);

    let totalDiscovered = 0;
    let totalSaved = 0;

    // Search each hashtag
    for (const hashtag of hashtagsToSearch) {
      const posts = await searchLinkedInPosts(hashtag);
      totalDiscovered += posts.length;

      // Save posts to database
      for (const post of posts) {
        // Get monitor IDs for this hashtag
        const monitorIds = hashtagToMonitors.get(hashtag) || [];
        if (monitorIds.length === 0) continue;

        // Use first monitor ID (posts will be associated with a monitor)
        const monitorId = monitorIds[0];
        const monitor = monitors.find((m) => m.id === monitorId);

        // Check if post already exists
        const { data: existing } = await supabase
          .from('linkedin_posts_discovered')
          .select('id')
          .eq('social_id', post.social_id)
          .single();

        if (existing) {
          console.log(`⏭️ Post already exists: ${post.social_id}`);
          continue;
        }

        // Extract hashtags from post text
        const hashtagMatches = post.text?.match(/#\w+/g) || [];
        const hashtags = hashtagMatches.map((h) => h.substring(1).toLowerCase());

        // Insert new post (using correct column names from schema)
        const { error: insertError } = await supabase
          .from('linkedin_posts_discovered')
          .insert({
            monitor_id: monitorId,
            workspace_id: monitor?.workspace_id,
            social_id: post.social_id,
            share_url: post.share_url,
            author_name: post.author?.name || 'Unknown',
            author_headline: post.author?.headline || '',
            author_profile_id: post.author?.public_identifier,
            post_content: post.text,
            hashtags: hashtags,
            status: 'discovered',
            post_date: post.parsed_datetime || new Date().toISOString(),
            engagement_metrics: {
              likes: post.reaction_counter || 0,
              comments: post.comment_counter || 0,
              reposts: post.repost_counter || 0,
            },
          });

        if (insertError) {
          console.error(`❌ Error saving post:`, insertError);
        } else {
          totalSaved++;
          console.log(`✅ Saved post from ${post.author?.name}`);
        }
      }

      // Small delay between searches
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log(`🎉 Discovery complete: ${totalDiscovered} found, ${totalSaved} saved`);

    return NextResponse.json({
      success: true,
      keywords_searched: hashtagsToSearch.length,
      posts_discovered: totalDiscovered,
      posts_saved: totalSaved,
      message: `Discovered ${totalDiscovered} posts, saved ${totalSaved} new posts`,
    });
  } catch (error) {
    console.error('❌ Discovery error:', error);
    return NextResponse.json(
      {
        error: 'Discovery failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET endpoint for manual testing
export async function GET() {
  return NextResponse.json({
    message: 'Unipile LinkedIn hashtag discovery endpoint',
    usage: 'POST to trigger discovery',
    config: {
      max_posts_per_keyword: MAX_POSTS_PER_KEYWORD,
      max_keywords_per_run: MAX_KEYWORDS_PER_RUN,
      unipile_configured: !!(UNIPILE_API_KEY && UNIPILE_ACCOUNT_ID),
    },
  });
}
