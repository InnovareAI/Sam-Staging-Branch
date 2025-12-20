/**
 * LinkedIn Commenting Agent - Save Discovered Posts
 * N8N calls this to save posts discovered from Unipile
 */

import { createClient } from '@/app/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Verify N8N internal trigger
    const triggerHeader = request.headers.get('x-internal-trigger');
    if (triggerHeader !== 'n8n-commenting-agent') {
      return NextResponse.json(
        { error: 'Unauthorized - N8N trigger required' },
        { status: 401 }
      );
    }

    const body = await request.json();

    if (!body.monitor || !body.posts) {
      return NextResponse.json(
        { error: 'Missing required fields: monitor, posts' },
        { status: 400 }
      );
    }

    console.log('💾 Saving discovered posts:', {
      monitor_id: body.monitor.id,
      monitor_type: body.monitor.monitor_type,
      posts_count: Array.isArray(body.posts) ? body.posts.length : 1
    });

    const { supabaseAdmin } = await import('@/app/lib/supabase');
    const supabase = supabaseAdmin();
    const monitor = body.monitor;
    const SCRAPING_LIMIT = 10;
    let posts = Array.isArray(body.posts) ? body.posts : [body.posts];

    // Enforce scraping limit of 10 posts twice daily (per run)
    if (posts.length > SCRAPING_LIMIT) {
      console.log(`✂️ Trimming posts to limit of ${SCRAPING_LIMIT} (was ${posts.length})`);
      posts = posts.slice(0, SCRAPING_LIMIT);
    }

    let savedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    // Process each post
    for (const post of posts) {
      try {
        // Extract post data from Unipile response
        // Note: Actual Unipile response structure may vary
        const postData = {
          workspace_id: monitor.workspace_id,
          post_linkedin_id: post.id || post.urn || post.post_id,
          post_url: post.url || post.permalink || `https://linkedin.com/feed/update/${post.id}`,
          post_social_id: post.social_id || post.urn || post.id,

          // Author info
          author_linkedin_id: post.author?.id || post.author_id,
          author_name: post.author?.name || post.author_name || 'Unknown',
          author_profile_url: post.author?.profile_url || post.author?.url,
          author_title: post.author?.title || post.author?.headline,
          author_company: post.author?.company || post.author?.organization,

          // Post content
          post_text: post.text || post.content || post.description || '',
          post_type: post.type || 'text',
          has_media: Boolean(post.media || post.attachments || post.images),
          media_urls: extractMediaUrls(post),

          // Timestamps
          posted_at: post.created_at || post.posted_at || new Date().toISOString(),
          discovered_at: new Date().toISOString(),

          // Engagement
          likes_count: post.likes_count || post.reactions_count || 0,
          comments_count: post.comments_count || 0,
          shares_count: post.shares_count || post.reposts_count || 0,

          // Discovery context
          discovered_via_monitor_id: monitor.id,
          monitor_type: monitor.monitor_type,
          matched_keywords: extractMatchedKeywords(post, monitor),

          // Status
          status: 'pending',
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),

          // Metadata
          metadata: {
            raw_post: post,
            monitor_target: monitor.target_value
          }
        };

        // Check if post already exists
        const { data: existing } = await supabase
          .from('linkedin_posts_discovered')
          .select('id')
          .eq('post_linkedin_id', postData.post_linkedin_id)
          .single();

        if (existing) {
          skippedCount++;
          continue; // Already discovered
        }

        // Check engagement threshold
        if (monitor.min_engagement_threshold > 0) {
          const totalEngagement = postData.likes_count + postData.comments_count;
          if (totalEngagement < monitor.min_engagement_threshold) {
            skippedCount++;
            continue; // Below threshold
          }
        }

        // Check exclude keywords
        if (monitor.exclude_keywords && monitor.exclude_keywords.length > 0) {
          const postTextLower = postData.post_text.toLowerCase();
          const hasExcludedKeyword = monitor.exclude_keywords.some((keyword: string) =>
            postTextLower.includes(keyword.toLowerCase())
          );
          if (hasExcludedKeyword) {
            skippedCount++;
            continue; // Contains excluded keyword
          }
        }

        // Save post
        const { error: insertError } = await supabase
          .from('linkedin_posts_discovered')
          .insert(postData);

        if (insertError) {
          // If duplicate key error, skip silently
          if (insertError.code === '23505') {
            skippedCount++;
            continue;
          }
          errors.push(`Post ${postData.post_linkedin_id}: ${insertError.message}`);
        } else {
          savedCount++;
        }

      } catch (postError) {
        errors.push(`Error processing post: ${postError instanceof Error ? postError.message : 'Unknown'}`);
      }
    }

    // Update monitor last_checked_at and count
    await supabase
      .from('linkedin_post_monitors')
      .update({
        last_checked_at: new Date().toISOString(),
        posts_discovered_count: monitor.posts_discovered_count + savedCount
      })
      .eq('id', monitor.id);

    console.log('✅ Posts processed:', {
      monitor_id: monitor.id,
      saved: savedCount,
      skipped: skippedCount,
      errors: errors.length
    });

    return NextResponse.json({
      success: true,
      posts_saved: savedCount,
      posts_skipped: skippedCount,
      errors: errors.length > 0 ? errors : undefined,
      monitor_id: monitor.id,
      processed_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error saving discovered posts:', error);
    return NextResponse.json(
      {
        error: 'Failed to save posts',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Extract media URLs from post
 */
function extractMediaUrls(post: any): string[] {
  const urls: string[] = [];

  if (post.media) {
    if (Array.isArray(post.media)) {
      urls.push(...post.media.map((m: any) => m.url || m.image_url || m.video_url).filter(Boolean));
    } else if (typeof post.media === 'string') {
      urls.push(post.media);
    }
  }

  if (post.images && Array.isArray(post.images)) {
    urls.push(...post.images.filter(Boolean));
  }

  if (post.attachments && Array.isArray(post.attachments)) {
    urls.push(...post.attachments.map((a: any) => a.url).filter(Boolean));
  }

  return urls;
}

/**
 * Extract keywords that matched from post text
 */
function extractMatchedKeywords(post: any, monitor: any): string[] {
  if (monitor.monitor_type !== 'keyword') {
    return [];
  }

  const postText = (post.text || post.content || '').toLowerCase();
  const keywords = monitor.target_value.toLowerCase().split(/\s+/);

  return keywords.filter((keyword: string) => postText.includes(keyword));
}
