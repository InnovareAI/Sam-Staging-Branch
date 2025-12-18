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
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';
import {
  isHoliday,
  getTypingDelayMs,
  shouldLikeBeforeComment,
  getLikeToCommentDelayMs,
  shouldViewProfileFirst,
  getProfileViewDelayMs,
  getAntiDetectionContext,
  HARD_LIMITS,
  shouldStopActivity,
  isLinkedInWarning
} from '@/lib/anti-detection/comment-variance';

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
 * If skip_business_hours is true, always returns canPost: true
 * Otherwise respects business hours (9 AM - 6 PM)
 */
function canPostCommentNow(timezone: string, countryCode: string, skipBusinessHours: boolean = false): { canPost: boolean; reason?: string } {
  // If business hours check is disabled, always allow posting
  if (skipBusinessHours) {
    return { canPost: true, reason: 'Business hours check disabled' };
  }

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

  // ============================================
  // ANTI-DETECTION: Holiday check
  // Skip all posting on major holidays
  // ============================================
  const holidayCheck = isHoliday();
  if (holidayCheck.isHoliday) {
    console.log(`🎄 HOLIDAY SKIP: ${holidayCheck.holidayName} - no comments today`);
    return NextResponse.json({
      success: true,
      processed: 0,
      message: `Holiday skip: ${holidayCheck.holidayName}`,
      skipped_reason: 'holiday'
    });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date();
  let processed = 0;
  let failed = 0;
  const errors: string[] = [];

  try {
    // Get ONE scheduled comment that is due
    // IMPORTANT: Process only 1 comment per cron run to respect rate limits
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
      .limit(1); // Process exactly 1 comment per cron run

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

    // ============================================
    // HARD LIMIT CHECK - Protect client accounts
    // Query activity stats and check against limits
    // ============================================
    const comment = dueComments[0];
    const workspaceId = comment.workspace_id;

    // Get today's comment count for this workspace
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count: commentsToday } = await supabase
      .from('linkedin_post_comments')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'posted')
      .gte('posted_at', todayStart.toISOString());

    // Get this week's comment count
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const { count: commentsThisWeek } = await supabase
      .from('linkedin_post_comments')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'posted')
      .gte('posted_at', weekStart.toISOString());

    // Get this hour's comment count
    const hourStart = new Date();
    hourStart.setMinutes(0, 0, 0);

    const { count: commentsThisHour } = await supabase
      .from('linkedin_post_comments')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'posted')
      .gte('posted_at', hourStart.toISOString());

    // Check hard limits
    const limitCheck = shouldStopActivity({
      commentsToday: commentsToday || 0,
      commentsThisWeek: commentsThisWeek || 0,
      commentsThisHour: commentsThisHour || 0,
      likesToday: 0, // Would need separate tracking
      consecutiveErrors: 0 // Would need separate tracking
    });

    if (limitCheck.stop) {
      console.log(`🛑 HARD LIMIT REACHED: ${limitCheck.reason}`);
      // Reset comment to scheduled for later
      await supabase
        .from('linkedin_post_comments')
        .update({
          status: 'scheduled',
          scheduled_post_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // Retry in 1 hour
          updated_at: new Date().toISOString()
        })
        .eq('id', comment.id);

      return NextResponse.json({
        success: true,
        processed: 0,
        message: `Hard limit reached: ${limitCheck.reason}`,
        skipped_reason: 'hard_limit'
      });
    }

    console.log(`   📊 Activity stats: ${commentsToday || 0} today, ${commentsThisWeek || 0} this week, ${commentsThisHour || 0} this hour`);

    // CRITICAL: Claim comments immediately to prevent race conditions
    // Change status to 'posting' so other concurrent runs skip them
    const commentIds = dueComments.map(c => c.id);
    const { error: claimError } = await supabase
      .from('linkedin_post_comments')
      .update({
        status: 'posting',
        updated_at: new Date().toISOString()
      })
      .in('id', commentIds)
      .eq('status', 'scheduled'); // Only claim if still scheduled (not claimed by another run)

    if (claimError) {
      console.error('❌ Error claiming comments:', claimError);
      return NextResponse.json({
        error: 'Failed to claim comments',
        details: claimError.message
      }, { status: 500 });
    }

    console.log(`✅ Claimed ${commentIds.length} comments for processing`);

    // Group comments by workspace for timezone check
    const workspaceIds = [...new Set(dueComments.map(c => c.workspace_id))];

    // Fetch workspace brand guidelines for timezone/country settings
    const { data: brandGuidelines } = await supabase
      .from('linkedin_brand_guidelines')
      .select('workspace_id, timezone, country_code')
      .in('workspace_id', workspaceIds);

    // Workspaces that bypass business hours (configured via code until DB column is added)
    // InnovareAI workspace: babdcab8-1a78-4b2f-913e-6e9fd9821009
    const SKIP_BUSINESS_HOURS_WORKSPACES = new Set([
      'babdcab8-1a78-4b2f-913e-6e9fd9821009' // InnovareAI - Thorsten's workspace
    ]);

    const workspaceSettings: Record<string, { timezone: string; country_code: string; skip_business_hours: boolean }> = {};
    for (const bg of brandGuidelines || []) {
      workspaceSettings[bg.workspace_id] = {
        timezone: bg.timezone || 'America/Los_Angeles',
        country_code: bg.country_code || 'US',
        skip_business_hours: SKIP_BUSINESS_HOURS_WORKSPACES.has(bg.workspace_id)
      };
    }

    // Process each comment
    for (const comment of dueComments) {
      try {
        console.log(`\n📤 Posting comment ${comment.id}...`);

        // Business hours check: 9 AM - 6 PM (weekends allowed)
        // Can be bypassed with skip_business_hours setting in brand guidelines
        const settings = workspaceSettings[comment.workspace_id] || { timezone: 'America/Los_Angeles', country_code: 'US', skip_business_hours: false };
        const { canPost, reason } = canPostCommentNow(settings.timezone, settings.country_code, settings.skip_business_hours);
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
          .in('connection_status', VALID_CONNECTION_STATUSES)
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

        // CRITICAL: Final check - verify this post hasn't already been commented on
        // Catches race conditions where another run posted while we were resolving IDs
        const { data: existingPostedComment } = await supabase
          .from('linkedin_post_comments')
          .select('id')
          .eq('post_id', comment.post_id)
          .eq('status', 'posted')
          .limit(1)
          .single();

        if (existingPostedComment) {
          console.log(`   🛑 DUPLICATE PREVENTED: Post already has a posted comment`);
          await supabase
            .from('linkedin_post_comments')
            .update({
              status: 'skipped',
              failure_reason: 'Duplicate prevented - post already has comment',
              updated_at: new Date().toISOString()
            })
            .eq('id', comment.id);
          continue;
        }

        // ============================================
        // ANTI-DETECTION: Full human behavior simulation
        // ============================================
        const antiDetection = getAntiDetectionContext();
        let didLikeBefore = false;

        // 1. View author profile first (40% chance)
        if (antiDetection.shouldViewProfile) {
          console.log(`   👤 Viewing author profile first (anti-detection)...`);
          // Note: Would need author profile URL from post data
          // For now, just simulate the delay
          await new Promise(resolve => setTimeout(resolve, antiDetection.profileViewDelayMs));
          console.log(`   ⏳ Profile view delay: ${Math.round(antiDetection.profileViewDelayMs / 1000)}s`);
        }

        // 2. Like post BEFORE commenting (50% chance)
        if (antiDetection.shouldLikeFirst) {
          console.log(`   👍 Liking post BEFORE comment (anti-detection)...`);
          try {
            const likeResponse = await fetch(
              `${UNIPILE_BASE_URL}/api/v1/posts/reaction`,
              {
                method: 'POST',
                headers: {
                  'X-API-KEY': UNIPILE_API_KEY,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  account_id: linkedinAccount.unipile_account_id,
                  post_id: activitySocialId,
                  reaction_type: 'like'
                })
              }
            );

            if (likeResponse.ok) {
              console.log('   ✅ Post liked (before comment)');
              didLikeBefore = true;
              // Delay after liking, before commenting
              await new Promise(resolve => setTimeout(resolve, antiDetection.likeToCommentDelayMs));
              console.log(`   ⏳ Like-to-comment delay: ${Math.round(antiDetection.likeToCommentDelayMs / 1000)}s`);
            }
          } catch (likeError) {
            console.log(`   ⚠️ Pre-comment like failed: ${likeError}`);
          }
        }

        // 3. Typing delay (simulates reading post + typing comment)
        console.log(`   ⌨️ Typing delay: ${Math.round(antiDetection.typingDelayMs / 1000)}s`);
        await new Promise(resolve => setTimeout(resolve, antiDetection.typingDelayMs));

        // 4. Post the comment
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

          // ============================================
          // LINKEDIN WARNING DETECTION
          // Check if error indicates LinkedIn restriction
          // If so, pause ALL commenting for this workspace
          // ============================================
          const warningCheck = isLinkedInWarning(errorText);
          if (warningCheck.isWarning) {
            console.error(`🚨 LINKEDIN WARNING DETECTED: "${warningCheck.pattern}"`);
            console.error(`🛑 PAUSING ALL COMMENTING FOR WORKSPACE ${comment.workspace_id} FOR 24 HOURS`);

            // Pause the monitor for this workspace
            await supabase
              .from('linkedin_post_monitors')
              .update({
                status: 'paused',
                metadata: {
                  paused_reason: `LinkedIn warning: ${warningCheck.pattern}`,
                  paused_at: new Date().toISOString(),
                  auto_resume_at: new Date(Date.now() + HARD_LIMITS.PAUSE_DURATION_HOURS * 60 * 60 * 1000).toISOString()
                }
              })
              .eq('workspace_id', comment.workspace_id);

            // Reschedule all pending comments for tomorrow
            await supabase
              .from('linkedin_post_comments')
              .update({
                status: 'scheduled',
                scheduled_post_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('workspace_id', comment.workspace_id)
              .in('status', ['scheduled', 'posting']);

            return NextResponse.json({
              success: false,
              processed: 0,
              failed: 1,
              error: `LinkedIn warning detected: ${warningCheck.pattern}. Auto-paused for 24 hours.`,
              warning_detected: true
            }, { status: 503 });
          }

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

        // Auto-like the post after commenting (if we didn't already like before)
        // Use the original activity ID for reactions (not ugcPost)
        if (!didLikeBefore) {
          console.log(`   👍 Liking post AFTER comment...`);
          try {
            const likeResponse = await fetch(
              `${UNIPILE_BASE_URL}/api/v1/posts/reaction`,
              {
                method: 'POST',
                headers: {
                  'X-API-KEY': UNIPILE_API_KEY,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  account_id: linkedinAccount.unipile_account_id,
                  post_id: activitySocialId,
                  reaction_type: 'like'
                })
              }
            );

            if (likeResponse.ok) {
              console.log('   ✅ Post liked (after comment)');
            } else {
              const likeError = await likeResponse.text();
              console.log(`   ⚠️ Could not like post: ${likeError}`);
            }
          } catch (likeError) {
            console.log(`   ⚠️ Like failed: ${likeError}`);
          }
        } else {
          console.log('   ✅ Post already liked before comment - skipping');
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

        // ANTI-DETECTION: Random delay between actions (45-180 seconds)
        // This mimics human behavior - nobody posts comments at exactly 3-second intervals
        if (dueComments.indexOf(comment) < dueComments.length - 1) {
          const minDelayMs = 45 * 1000;  // 45 seconds minimum
          const maxDelayMs = 180 * 1000; // 3 minutes maximum
          const randomDelayMs = minDelayMs + Math.floor(Math.random() * (maxDelayMs - minDelayMs));
          console.log(`   ⏳ Anti-detection delay: ${Math.round(randomDelayMs / 1000)}s before next action`);
          await new Promise(resolve => setTimeout(resolve, randomDelayMs));
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
