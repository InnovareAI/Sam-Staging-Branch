/**
 * LinkedIn Hashtag Post Discovery via Bright Data Scraping Browser
 *
 * Discovers LinkedIn posts by hashtag using Bright Data's Scraping Browser.
 * This replaces Apify for hashtag-based post discovery.
 *
 * Flow:
 * 1. Get active monitors with hashtags (not PROFILE: prefixed)
 * 2. For each hashtag, use Bright Data to scrape linkedin.com/feed/hashtag/{tag}
 * 3. Extract posts (author, content, engagement, URL)
 * 4. Save to linkedin_posts_discovered table
 *
 * Cost: Uses Bright Data Scraping Browser credits
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer-core';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 minutes max for scraping

// Environment variables
const BRIGHT_DATA_CUSTOMER_ID = process.env.BRIGHT_DATA_CUSTOMER_ID;
const BRIGHT_DATA_PASSWORD = process.env.BRIGHT_DATA_PASSWORD;
const BRIGHT_DATA_ZONE = process.env.BRIGHT_DATA_ZONE || 'residential';
const CRON_SECRET = process.env.CRON_SECRET;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Limits
const MAX_POSTS_PER_HASHTAG = 10;
const MAX_HASHTAGS_PER_RUN = 5;
const MIN_POST_AGE_HOURS = 0; // Include fresh posts
const MAX_POST_AGE_HOURS = 24; // Only posts from last 24 hours

interface LinkedInPost {
  social_id: string;
  post_url: string;
  author_name: string;
  author_headline?: string;
  author_url?: string;
  author_avatar?: string;
  post_text: string;
  posted_at?: string;
  relative_time?: string;
  hours_ago?: number;
  num_likes: number;
  num_comments: number;
  num_shares: number;
  hashtags: string[];
}

/**
 * Parse LinkedIn relative time string to hours
 * Examples: "2h" -> 2, "1d" -> 24, "3d" -> 72, "1w" -> 168, "2mo" -> 1440
 */
function parseRelativeTimeToHours(timeStr: string): number {
  if (!timeStr) return 999; // Unknown = treat as old

  const match = timeStr.match(/(\d+)\s*(s|m|h|d|w|mo|y)/i);
  if (!match) return 999;

  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's': return 0; // seconds = just now
    case 'm': return value / 60; // minutes to hours
    case 'h': return value; // hours
    case 'd': return value * 24; // days to hours
    case 'w': return value * 24 * 7; // weeks to hours
    case 'mo': return value * 24 * 30; // months to hours
    case 'y': return value * 24 * 365; // years to hours
    default: return 999;
  }
}

/**
 * Scrape LinkedIn hashtag feed using Bright Data Scraping Browser
 */
async function scrapeHashtagPosts(hashtag: string): Promise<LinkedInPost[]> {
  if (!BRIGHT_DATA_CUSTOMER_ID || !BRIGHT_DATA_PASSWORD) {
    console.error('❌ Bright Data credentials not configured');
    return [];
  }

  // Bright Data Scraping Browser connection string
  const browserWSEndpoint = `wss://${BRIGHT_DATA_CUSTOMER_ID}:${BRIGHT_DATA_PASSWORD}@brd.superproxy.io:9222`;

  console.log(`🔍 Scraping hashtag: #${hashtag}`);

  let browser;
  try {
    browser = await puppeteer.connect({
      browserWSEndpoint,
      // Bright Data handles the browser, we just connect
    });

    const page = await browser.newPage();

    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });

    // Navigate to LinkedIn hashtag feed
    const hashtagUrl = `https://www.linkedin.com/feed/hashtag/${encodeURIComponent(hashtag)}/`;
    console.log(`📍 Navigating to: ${hashtagUrl}`);

    await page.goto(hashtagUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Wait for posts to load
    await page.waitForSelector('[data-urn]', { timeout: 15000 }).catch(() => {
      console.log('⚠️ No posts found or selector not available');
    });

    // Scroll to load more posts
    await page.evaluate(() => {
      window.scrollBy(0, 2000);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Extract posts from the page
    const posts = await page.evaluate((maxPosts: number, searchHashtag: string) => {
      const postElements = document.querySelectorAll('[data-urn^="urn:li:activity"]');
      const results: any[] = [];

      postElements.forEach((el, index) => {
        if (index >= maxPosts) return;

        try {
          const urn = el.getAttribute('data-urn') || '';

          // Get author info
          const authorEl = el.querySelector('.update-components-actor__name');
          const authorName = authorEl?.textContent?.trim() || 'Unknown';

          const headlineEl = el.querySelector('.update-components-actor__description');
          const authorHeadline = headlineEl?.textContent?.trim() || '';

          const authorLinkEl = el.querySelector('.update-components-actor__container-link') as HTMLAnchorElement;
          const authorUrl = authorLinkEl?.href || '';

          const avatarEl = el.querySelector('.update-components-actor__avatar img') as HTMLImageElement;
          const authorAvatar = avatarEl?.src || '';

          // Get post timestamp (LinkedIn shows relative time like "2h", "1d", "3d")
          // Try multiple selectors as LinkedIn changes their markup
          let relativeTime = '';
          const timeSelectors = [
            '.update-components-actor__sub-description time',
            '.update-components-actor__sub-description span[aria-hidden="true"]',
            '.feed-shared-actor__sub-description time',
            'time.visually-hidden',
            '.update-components-actor__meta time'
          ];
          for (const selector of timeSelectors) {
            const timeEl = el.querySelector(selector);
            if (timeEl?.textContent) {
              relativeTime = timeEl.textContent.trim();
              // Extract just the time part (e.g., "2h" from "2h •" or "2 hours ago")
              const timeMatch = relativeTime.match(/(\d+)\s*(s|m|h|d|w|mo|y|second|minute|hour|day|week|month|year)/i);
              if (timeMatch) {
                relativeTime = timeMatch[0];
                break;
              }
            }
          }

          // Get post content
          const textEl = el.querySelector('.update-components-text');
          const postText = textEl?.textContent?.trim() || '';

          // Get engagement metrics
          const likesEl = el.querySelector('[data-test-id="social-actions__reaction-count"]');
          const likesText = likesEl?.textContent?.trim() || '0';
          const numLikes = parseInt(likesText.replace(/[^0-9]/g, '')) || 0;

          const commentsEl = el.querySelector('[data-test-id="social-actions__comments"]');
          const commentsText = commentsEl?.textContent?.trim() || '0';
          const numComments = parseInt(commentsText.replace(/[^0-9]/g, '')) || 0;

          // Get post URL
          const postLinkEl = el.querySelector('a[href*="/feed/update/"]') as HTMLAnchorElement;
          const postUrl = postLinkEl?.href || `https://www.linkedin.com/feed/update/${urn}`;

          // Extract hashtags from post text
          const hashtagMatches = postText.match(/#\w+/g) || [];
          const hashtags = hashtagMatches.map(h => h.substring(1).toLowerCase());

          // Only include if post contains our target hashtag
          if (postText.toLowerCase().includes(`#${searchHashtag.toLowerCase()}`)) {
            results.push({
              social_id: urn,
              post_url: postUrl,
              author_name: authorName,
              author_headline: authorHeadline,
              author_url: authorUrl,
              author_avatar: authorAvatar,
              post_text: postText,
              relative_time: relativeTime,
              num_likes: numLikes,
              num_comments: numComments,
              num_shares: 0, // Not easily accessible
              hashtags: hashtags,
            });
          }
        } catch (e) {
          console.error('Error extracting post:', e);
        }
      });

      return results;
    }, MAX_POSTS_PER_HASHTAG, hashtag);

    // Filter posts by age (only last 24 hours)
    const recentPosts: LinkedInPost[] = posts
      .map(post => ({
        ...post,
        hours_ago: parseRelativeTimeToHours(post.relative_time || '')
      }))
      .filter(post => {
        const isRecent = post.hours_ago <= MAX_POST_AGE_HOURS;
        if (!isRecent) {
          console.log(`⏭️ Skipping old post (${post.relative_time || 'unknown time'}): ${post.author_name}`);
        }
        return isRecent;
      });

    console.log(`✅ Found ${posts.length} posts for #${hashtag}, ${recentPosts.length} within last ${MAX_POST_AGE_HOURS}h`);
    return recentPosts;

  } catch (error) {
    console.error(`❌ Scraping error for #${hashtag}:`, error);
    return [];
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

export async function POST(request: NextRequest) {
  console.log('🚀 Starting Bright Data hashtag discovery...');

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
        discovered: 0
      });
    }

    // Collect all unique hashtags (excluding PROFILE: prefixed ones)
    const allHashtags = new Set<string>();
    const hashtagToMonitors = new Map<string, string[]>();

    monitors.forEach(monitor => {
      const hashtags = monitor.hashtags || [];
      hashtags.forEach((tag: string) => {
        // Skip profile monitors
        if (tag.startsWith('PROFILE:')) return;

        // Handle different formats: "GenAI", "#GenAI", "HASHTAG:GenAI", "KEYWORD:GenAI"
        let cleanTag = tag;
        if (cleanTag.startsWith('HASHTAG:')) cleanTag = cleanTag.substring(8);
        if (cleanTag.startsWith('KEYWORD:')) cleanTag = cleanTag.substring(8);
        cleanTag = cleanTag.replace(/^#/, '').toLowerCase();

        allHashtags.add(cleanTag);

        // Track which monitors want this hashtag
        if (!hashtagToMonitors.has(cleanTag)) {
          hashtagToMonitors.set(cleanTag, []);
        }
        hashtagToMonitors.get(cleanTag)!.push(monitor.id);
      });
    });

    const hashtagsToScrape = Array.from(allHashtags).slice(0, MAX_HASHTAGS_PER_RUN);
    console.log(`📋 Scraping ${hashtagsToScrape.length} hashtags:`, hashtagsToScrape);

    let totalDiscovered = 0;
    let totalSaved = 0;

    // Scrape each hashtag
    for (const hashtag of hashtagsToScrape) {
      const posts = await scrapeHashtagPosts(hashtag);
      totalDiscovered += posts.length;

      // Save posts to database
      for (const post of posts) {
        // Get monitor IDs for this hashtag
        const monitorIds = hashtagToMonitors.get(hashtag) || [];
        if (monitorIds.length === 0) continue;

        // Use first monitor ID (posts will be associated with a monitor)
        const monitorId = monitorIds[0];

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

        // Insert new post
        const { error: insertError } = await supabase
          .from('linkedin_posts_discovered')
          .insert({
            monitor_id: monitorId,
            social_id: post.social_id,
            share_url: post.post_url,
            author_name: post.author_name,
            author_headline: post.author_headline,
            author_url: post.author_url,
            author_avatar: post.author_avatar,
            post_text: post.post_text,
            num_likes: post.num_likes,
            num_comments: post.num_comments,
            hashtags: post.hashtags,
            status: 'discovered',
            discovered_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error(`❌ Error saving post:`, insertError);
        } else {
          totalSaved++;
          console.log(`✅ Saved post from ${post.author_name}`);
        }
      }

      // Add delay between hashtags to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log(`🎉 Discovery complete: ${totalDiscovered} found, ${totalSaved} saved`);

    return NextResponse.json({
      success: true,
      hashtags_scraped: hashtagsToScrape.length,
      posts_discovered: totalDiscovered,
      posts_saved: totalSaved,
      message: `Discovered ${totalDiscovered} posts, saved ${totalSaved} new posts`
    });

  } catch (error) {
    console.error('❌ Bright Data discovery error:', error);
    return NextResponse.json({
      error: 'Discovery failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint for manual testing
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Bright Data LinkedIn hashtag discovery endpoint',
    usage: 'POST to trigger discovery',
    config: {
      max_posts_per_hashtag: MAX_POSTS_PER_HASHTAG,
      max_hashtags_per_run: MAX_HASHTAGS_PER_RUN,
      bright_data_configured: !!(BRIGHT_DATA_CUSTOMER_ID && BRIGHT_DATA_PASSWORD)
    }
  });
}
