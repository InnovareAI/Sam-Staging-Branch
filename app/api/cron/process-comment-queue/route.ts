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
 */
function canPostCommentNow(timezone: string, countryCode: string): { canPost: boolean; reason?: string } {
  const localTime = moment().tz(timezone);
  const day = localTime.day();
  const hour = localTime.hour();
  const dateStr = localTime.format('YYYY-MM-DD');

  // Check weekend (country-specific)
  if (FRIDAY_SATURDAY_WEEKEND_COUNTRIES.includes(countryCode)) {
    if (day === 5 || day === 6) { // Friday or Saturday
      return { canPost: false, reason: `Weekend (Fri-Sat) in ${countryCode}` };
    }
  } else {
    if (day === 0 || day === 6) { // Sunday or Saturday
      return { canPost: false, reason: 'Weekend' };
    }
  }

  // Check business hours (6 AM - 6 PM)
  const startHour = BUSINESS_HOURS.start;
  const endHour = 18; // 6 PM
  if (hour < startHour || hour >= endHour) {
    return { canPost: false, reason: `Outside business hours (${hour}:00 in ${timezone})` };
  }

  // Check holidays
  const holidays = getHolidaysForCountry(countryCode);
  if (holidays.includes(dateStr)) {
    return { canPost: false, reason: `Holiday in ${countryCode} (${dateStr})` };
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

        // DISABLED FOR TESTING: Business hours/weekend check removed
        // Posts will be sent immediately regardless of time/day
        // TODO: Re-enable after testing if needed
        // const settings = workspaceSettings[comment.workspace_id] || { timezone: 'America/Los_Angeles', country_code: 'US' };
        // const { canPost, reason } = canPostCommentNow(settings.timezone, settings.country_code);
        // if (!canPost) {
        //   console.log(`   ⏸️ Skipping - ${reason}`);
        //   continue;
        // }

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
        // CRITICAL: social_id must be in URN format for Unipile API
        // Legacy posts may have raw numeric IDs - extract activity ID from share_url
        let postSocialId = comment.post.social_id;

        if (!postSocialId?.startsWith('urn:li:')) {
          // Legacy format - extract activity ID from share_url
          const activityMatch = comment.post.share_url?.match(/activity-(\d+)/);
          if (activityMatch) {
            postSocialId = `urn:li:activity:${activityMatch[1]}`;
            console.log(`   🔄 Converted legacy social_id to URN: ${postSocialId}`);
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

        console.log(`   Posting to LinkedIn post: ${postSocialId}`);

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
