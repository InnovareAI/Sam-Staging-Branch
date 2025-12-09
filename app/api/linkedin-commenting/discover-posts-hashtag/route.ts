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

// Limits
const MAX_POSTS_PER_KEYWORD = 15;
const MAX_KEYWORDS_PER_RUN = 3;
const DAILY_POST_CAP_PER_WORKSPACE = 25; // Per-workspace cap

/**
 * Content filter patterns to exclude low-value posts
 * These are typically self-promotional credential/certificate announcements
 * that don't drive meaningful engagement
 */
const EXCLUDE_PATTERNS = [
  // Certificate/credential announcements
  /completed?.*(certification|certificate|course|training|credential)/i,
  /just (earned|received|obtained|got|passed).*(certification|certificate|badge)/i,
  /happy to (share|announce).*(certification|certificate|completed)/i,
  /proud to (share|announce).*(certification|certificate|completed)/i,
  /excited to (share|announce).*(certification|certificate|completed)/i,
  /thrilled to (share|announce).*(certification|certificate|completed)/i,
  /i('ve| have) (successfully )?completed/i,
  /coursera|udemy|linkedin learning|google cloud skills|aws training/i,
  /digital badge|credly|acclaim/i,
  /new certification|certified (in|as|by)/i,

  // Generic self-promotion
  /check out my (new )?(profile|resume|cv)/i,
  /i('m| am) (now )?(looking for|open to|seeking)/i,  // Job seekers

  // Very short or empty posts
  /^.{0,50}$/,  // Less than 50 chars total
];

/**
 * Keywords that indicate high-quality thought leadership content
 * Posts containing these are more likely to be worth engaging with
 */
const QUALITY_INDICATORS = [
  /\b(insight|perspective|lesson|learned|takeaway|observation)\b/i,
  /\b(unpopular opinion|hot take|here's (what|why))\b/i,
  /\b(data shows|research|study|according to)\b/i,
  /\b(strategy|framework|approach|methodology)\b/i,
  /\b(trend|future|prediction|outlook)\b/i,
  /\b(challenge|problem|solution|opportunity)\b/i,
  /\?(.*\?)?$/,  // Ends with a question (drives engagement)
];

/**
 * Simple English language detection
 * Uses common English words and character patterns to identify English text
 * Returns true if the text appears to be in English
 */
function isEnglishText(text: string): boolean {
  if (!text || text.length < 20) return false;

  // Common English words that appear frequently
  const commonEnglishWords = [
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
    'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
    'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
    'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
    'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
    'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
    'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
    'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
    'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
    'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
    'is', 'are', 'was', 'were', 'been', 'being', 'has', 'had', 'does', 'did',
    'very', 'much', 'more', 'here', 'where', 'why', 'should', 'need', 'must', 'may'
  ];

  // Normalize text: lowercase, remove URLs, mentions, hashtags
  const cleanText = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/@\w+/g, '')
    .replace(/#\w+/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleanText.split(' ').filter(w => w.length > 1);
  if (words.length < 5) return false;

  // Count how many common English words appear
  let englishWordCount = 0;
  for (const word of words) {
    if (commonEnglishWords.includes(word)) {
      englishWordCount++;
    }
  }

  // Calculate ratio of English words to total words
  const englishRatio = englishWordCount / words.length;

  // If at least 15% of words are common English words, consider it English
  // This threshold is low because posts contain technical terms, names, etc.
  return englishRatio >= 0.15;
}

/**
 * Check if a post should be excluded based on content patterns
 */
function shouldExcludePost(text: string): { exclude: boolean; reason?: string } {
  if (!text || text.trim().length < 50) {
    return { exclude: true, reason: 'Too short' };
  }

  // CRITICAL: English posts only
  if (!isEnglishText(text)) {
    return { exclude: true, reason: 'Non-English content' };
  }

  for (const pattern of EXCLUDE_PATTERNS) {
    if (pattern.test(text)) {
      return { exclude: true, reason: `Matches exclusion pattern: ${pattern.source.substring(0, 30)}...` };
    }
  }

  return { exclude: false };
}

/**
 * Score a post's quality based on content indicators
 * Higher score = more likely to be worth engaging with
 */
function scorePostQuality(text: string, engagementMetrics: { likes?: number; comments?: number }): number {
  let score = 0;

  // Quality content indicators
  for (const pattern of QUALITY_INDICATORS) {
    if (pattern.test(text)) {
      score += 10;
    }
  }

  // Length bonus (longer thoughtful posts)
  if (text.length > 500) score += 5;
  if (text.length > 1000) score += 5;

  // Engagement bonus
  const likes = engagementMetrics.likes || 0;
  const comments = engagementMetrics.comments || 0;
  if (likes > 10) score += 5;
  if (likes > 50) score += 10;
  if (comments > 5) score += 10;
  if (comments > 20) score += 15;

  return score;
}

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
    const today = new Date().toISOString().split('T')[0];

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

    // Get unique workspace IDs from active monitors
    const workspaceIds = [...new Set(monitors.map(m => m.workspace_id).filter(Boolean))];

    // Check per-workspace daily caps
    const workspacePostCounts = new Map<string, number>();
    for (const wsId of workspaceIds) {
      const { count } = await supabase
        .from('linkedin_posts_discovered')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', wsId)
        .gte('created_at', `${today}T00:00:00Z`);

      workspacePostCounts.set(wsId, count || 0);
      console.log(`📊 Workspace ${wsId}: ${count || 0}/${DAILY_POST_CAP_PER_WORKSPACE} posts today`);
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
    const workspacesSavedCounts = new Map<string, number>(); // Track saves per workspace this run

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
        const workspaceId = monitor?.workspace_id;

        // Check per-workspace daily cap
        if (workspaceId) {
          const existingCount = workspacePostCounts.get(workspaceId) || 0;
          const savedThisRun = workspacesSavedCounts.get(workspaceId) || 0;
          const totalForWorkspace = existingCount + savedThisRun;

          if (totalForWorkspace >= DAILY_POST_CAP_PER_WORKSPACE) {
            console.log(`📊 Workspace ${workspaceId} cap reached (${totalForWorkspace}/${DAILY_POST_CAP_PER_WORKSPACE}), skipping`);
            continue;
          }
        }

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

        // CONTENT FILTERING: Exclude low-quality posts (certificates, credentials, etc.)
        const filterResult = shouldExcludePost(post.text || '');
        if (filterResult.exclude) {
          console.log(`🚫 Excluded post: ${filterResult.reason} - "${(post.text || '').substring(0, 50)}..."`);
          continue;
        }

        // Score post quality (for logging/debugging)
        const qualityScore = scorePostQuality(post.text || '', {
          likes: post.reaction_counter,
          comments: post.comment_counter
        });
        console.log(`📊 Quality score: ${qualityScore} for post from ${post.author?.name}`);

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
          // Track per-workspace save count
          if (workspaceId) {
            workspacesSavedCounts.set(workspaceId, (workspacesSavedCounts.get(workspaceId) || 0) + 1);
          }
          console.log(`✅ Saved post from ${post.author?.name} (workspace: ${workspaceId})`);
        }
      }

      // Small delay between searches
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Log per-workspace breakdown
    const perWorkspaceStats: Record<string, { saved: number; total: number }> = {};
    for (const [wsId, savedCount] of workspacesSavedCounts) {
      const existingCount = workspacePostCounts.get(wsId) || 0;
      perWorkspaceStats[wsId] = {
        saved: savedCount,
        total: existingCount + savedCount,
      };
    }
    console.log(`🎉 Discovery complete: ${totalDiscovered} found, ${totalSaved} saved`);
    console.log(`📊 Per-workspace breakdown:`, JSON.stringify(perWorkspaceStats));

    return NextResponse.json({
      success: true,
      keywords_searched: hashtagsToSearch.length,
      posts_discovered: totalDiscovered,
      posts_saved: totalSaved,
      per_workspace: perWorkspaceStats,
      daily_cap_per_workspace: DAILY_POST_CAP_PER_WORKSPACE,
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
      daily_cap_per_workspace: DAILY_POST_CAP_PER_WORKSPACE,
      unipile_configured: !!(UNIPILE_API_KEY && UNIPILE_ACCOUNT_ID),
    },
  });
}
