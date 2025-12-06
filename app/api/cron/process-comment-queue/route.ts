/**
 * Process Scheduled Comments Queue
 * POST /api/cron/process-comment-queue
 *
 * Called by Netlify scheduled function every 30 minutes
 * Posts comments where scheduled_post_time <= now
 * Respects workspace timezone and business hours
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import moment from 'moment-timezone';
import { getHolidaysForCountry, BUSINESS_HOURS } from '@/lib/scheduling-config';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;
const UNIPILE_ACCOUNT_ID = process.env.UNIPILE_ACCOUNT_ID || 'ymtTx4xVQ6OVUFk83ctwtA';

/**
 * CRITICAL: Resolve the correct social_id for posting comments
 *
 * LinkedIn has TWO different IDs:
 * 1. Activity ID (from URL): urn:li:activity:7401968594147758080
 * 2. UgcPost ID (for API): urn:li:ugcPost:7401174173764722688
 *
 * These are DIFFERENT! We store activity ID from URLs, but Unipile's
 * comment endpoint requires the ugcPost ID.
 *
 * Solution: Fetch post via activity ID → get ugcPost ID from response
 */
async function resolvePostSocialId(activitySocialId: string, accountId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${UNIPILE_BASE_URL}/api/v1/posts/${encodeURIComponent(activitySocialId)}?account_id=${accountId}`,
      {
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.log(`   ⚠️ Could not resolve post ID: ${response.status}`);
      return null;
    }

    const data = await response.json();
    // Unipile returns the correct social_id (ugcPost format) in the response
    if (data.social_id && data.social_id.startsWith('urn:li:ugcPost:')) {
      console.log(`   🔄 Resolved activity ID to ugcPost: ${data.social_id}`);
      return data.social_id;
    }

    // If no ugcPost, return original
    return activitySocialId;
  } catch (error) {
    console.log(`   ⚠️ Error resolving post ID:`, error);
    return null;
  }
}

// Countries with Friday-Saturday weekends (Middle East)
const FRIDAY_SATURDAY_WEEKEND_COUNTRIES = ['AE', 'SA', 'KW', 'QA', 'BH', 'OM', 'JO', 'EG'];

// Timezone presets by country
const COUNTRY_TIMEZONES: Record<string, string> = {
  US: 'America/Los_Angeles',
  DE: 'Europe/Berlin',
  FR: 'Europe/Paris',
  GB: 'Europe/London',
  ZA: 'Africa/Johannesburg',
  AE: 'Asia/Dubai',
};

/**
 * Check if we can post a comment now based on workspace settings
 * WEEKENDS ALLOWED - only respects business hours (9 AM - 6 PM)
 */
function canPostCommentNow(timezone: string, countryCode: string): { canPost: boolean; reason?: string } {
  const localTime = moment().tz(timezone);
  const hour = localTime.hour();

  // Business hours: 9 AM - 6 PM (weekends allowed)
  const startHour = 9;  // 9 AM
  const endHour = 18;   // 6 PM
  if (hour < startHour || hour >= endHour) {
    return { canPost: false, reason: `Outside business hours (${hour}:00 in ${timezone}, allowed 9-18)` };
  }

  return { canPost: true };
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  // Verify cron secret
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('📤 Processing scheduled comments queue...');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date();
  let processed = 0;
  let failed = 0;
  const errors: string[] = [];

  try {
    // Get all scheduled comments that are due
    const { data: dueComments, error: fetchError } = await supabase
      .from('linkedin_post_comments')
      .select(`
        *,
        post:linkedin_posts_discovered!inner (
          id,
          social_id,
          share_url,
          workspace_id
        )
      `)
      .eq('status', 'scheduled')
      .lte('scheduled_post_time', now.toISOString())
      .order('scheduled_post_time', { ascending: true })
      .limit(5); // Process up to 5 at a time to avoid timeout

    if (fetchError) {
      console.error('❌ Error fetching scheduled comments:', fetchError);
      return NextResponse.json({
        error: 'Failed to fetch scheduled comments',
        details: fetchError.message
      }, { status: 500 });
    }

    if (!dueComments || dueComments.length === 0) {
      console.log('✅ No scheduled comments due');
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No scheduled comments due'
      });
    }

    console.log(`📋 Found ${dueComments.length} scheduled comments to post`);

    // Group comments by workspace for timezone check
    const workspaceIds = [...new Set(dueComments.map(c => c.workspace_id))];

    // Fetch workspace brand guidelines for timezone/country settings
    const { data: brandGuidelines } = await supabase
      .from('linkedin_brand_guidelines')
      .select('workspace_id, timezone, country_code')
      .in('workspace_id', workspaceIds);

    const workspaceSettings: Record<string, { timezone: string; country_code: string }> = {};
    for (const bg of brandGuidelines || []) {
      workspaceSettings[bg.workspace_id] = {
        timezone: bg.timezone || 'America/Los_Angeles',
        country_code: bg.country_code || 'US'
      };
    }

    // Process each comment
    for (const comment of dueComments) {
      try {
        console.log(`\n📤 Posting comment ${comment.id}...`);

        // Business hours check: 9 AM - 6 PM (weekends allowed)
        const settings = workspaceSettings[comment.workspace_id] || { timezone: 'America/Los_Angeles', country_code: 'US' };
        const { canPost, reason } = canPostCommentNow(settings.timezone, settings.country_code);
        if (!canPost) {
          console.log(`   ⏸️ Skipping - ${reason}`);
          continue;
        }

        // Get LinkedIn account for this workspace
        const { data: linkedinAccount } = await supabase
          .from('workspace_accounts')
          .select('unipile_account_id')
          .eq('workspace_id', comment.workspace_id)
          .eq('account_type', 'linkedin')
          .eq('connection_status', 'connected')
          .limit(1)
          .single();

        if (!linkedinAccount) {
          console.error(`❌ No LinkedIn account for workspace ${comment.workspace_id}`);
          await supabase
            .from('linkedin_post_comments')
            .update({
              status: 'failed',
              failure_reason: 'No connected LinkedIn account',
              updated_at: new Date().toISOString()
            })
            .eq('id', comment.id);
          failed++;
          errors.push(`Comment ${comment.id}: No LinkedIn account`);
          continue;
        }

        // Post comment to LinkedIn via Unipile
        // CRITICAL: LinkedIn has TWO different ID formats:
        // - Activity ID (from URLs): urn:li:activity:xxx
        // - UgcPost ID (for API): urn:li:ugcPost:xxx
        // We need to resolve the ugcPost ID from the activity ID

        let activitySocialId = comment.post.social_id;

        // First, ensure we have a proper URN format for the activity
        if (!activitySocialId?.startsWith('urn:li:')) {
          // Legacy format - extract activity ID from share_url
          const activityMatch = comment.post.share_url?.match(/activity-(\d+)/);
          if (activityMatch) {
            activitySocialId = `urn:li:activity:${activityMatch[1]}`;
            console.log(`   🔄 Converted legacy social_id to URN: ${activitySocialId}`);
          } else {
            console.error(`   ❌ Cannot determine activity ID from share_url: ${comment.post.share_url}`);
            await supabase
              .from('linkedin_post_comments')
              .update({
                status: 'failed',
                failure_reason: 'Cannot determine LinkedIn post ID',
                updated_at: new Date().toISOString()
              })
              .eq('id', comment.id);
            failed++;
            errors.push(`Comment ${comment.id}: Cannot determine LinkedIn post ID`);
            continue;
          }
        }

        // CRITICAL: Resolve activity ID to ugcPost ID (required for comment API)
        console.log(`   🔍 Resolving post ID: ${activitySocialId}`);
        const postSocialId = await resolvePostSocialId(activitySocialId, linkedinAccount.unipile_account_id);

        if (!postSocialId) {
          console.error(`   ❌ Could not resolve post social_id`);
          await supabase
            .from('linkedin_post_comments')
            .update({
              status: 'failed',
              failure_reason: 'Could not resolve LinkedIn post ID - post may be deleted or inaccessible',
              updated_at: new Date().toISOString()
            })
            .eq('id', comment.id);
          failed++;
          errors.push(`Comment ${comment.id}: Could not resolve post ID`);
          continue;
        }

        console.log(`   📤 Posting to LinkedIn post: ${postSocialId}`);

        const unipileResponse = await fetch(
          `${UNIPILE_BASE_URL}/api/v1/posts/${encodeURIComponent(postSocialId)}/comments`,
          {
            method: 'POST',
            headers: {
              'X-API-KEY': UNIPILE_API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              account_id: linkedinAccount.unipile_account_id,
              text: comment.comment_text
            })
          }
        );

        if (!unipileResponse.ok) {
          const errorText = await unipileResponse.text();
          console.error(`❌ Unipile error: ${unipileResponse.status} ${errorText}`);

          await supabase
            .from('linkedin_post_comments')
            .update({
              status: 'failed',
              failure_reason: `Unipile error: ${errorText}`,
              updated_at: new Date().toISOString()
            })
            .eq('id', comment.id);

          failed++;
          errors.push(`Comment ${comment.id}: ${errorText}`);
          continue;
        }

        const unipileData = await unipileResponse.json();
        console.log('   ✅ Comment posted to LinkedIn');

        // Extract LinkedIn comment ID
        const linkedinCommentId = unipileData.id || unipileData.comment_id || unipileData.object_id || null;

        // Auto-like the post after commenting
        console.log(`   👍 Liking post ${postSocialId}...`);
        try {
          const likeResponse = await fetch(
            `${UNIPILE_BASE_URL}/api/v1/posts/${encodeURIComponent(postSocialId)}/reactions`,
            {
              method: 'POST',
              headers: {
                'X-API-KEY': UNIPILE_API_KEY,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                account_id: linkedinAccount.unipile_account_id,
                reaction_type: 'LIKE'
              })
            }
          );

          if (likeResponse.ok) {
            console.log('   ✅ Post liked');
          } else {
            const likeError = await likeResponse.text();
            console.log(`   ⚠️ Could not like post: ${likeError}`);
          }
        } catch (likeError) {
          console.log(`   ⚠️ Like failed: ${likeError}`);
        }

        // Update comment status to 'posted'
        await supabase
          .from('linkedin_post_comments')
          .update({
            status: 'posted',
            posted_at: new Date().toISOString(),
            post_response: unipileData,
            linkedin_comment_id: linkedinCommentId,
            updated_at: new Date().toISOString()
          })
          .eq('id', comment.id);

        // Update post status to 'commented'
        await supabase
          .from('linkedin_posts_discovered')
          .update({ status: 'commented' })
          .eq('id', comment.post_id);

        processed++;

        // Rate limit: wait 3 seconds between posts
        if (dueComments.indexOf(comment) < dueComments.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }

      } catch (commentError) {
        console.error(`❌ Error processing comment ${comment.id}:`, commentError);
        failed++;
        errors.push(`Comment ${comment.id}: ${commentError instanceof Error ? commentError.message : 'Unknown error'}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`\n✅ Comment queue processing complete`);
    console.log(`   Processed: ${processed}, Failed: ${failed}, Duration: ${duration}ms`);

    return NextResponse.json({
      success: true,
      processed,
      failed,
      errors: errors.length > 0 ? errors : undefined,
      duration_ms: duration
    });

  } catch (error) {
    console.error('❌ Comment queue processor error:', error);
    return NextResponse.json({
      error: 'Failed to process comment queue',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET for manual testing
export async function GET(req: NextRequest) {
  const testReq = new NextRequest(req.url, {
    method: 'POST',
    headers: {
      'x-cron-secret': process.env.CRON_SECRET || ''
    }
  });
  return POST(testReq);
}
