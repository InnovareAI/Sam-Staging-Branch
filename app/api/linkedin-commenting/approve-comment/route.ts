/**
 * Approve a generated comment and schedule it for posting
 * POST /api/linkedin-commenting/approve-comment
 *
 * Comments are queued and spread throughout the day (6 AM - 6 PM PT)
 * A separate cron job processes the queue every 30 minutes
 */

import { createClient } from '@supabase/supabase-js';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Posting window: 6 AM - 6 PM PT (12 hours)
const POSTING_START_HOUR = 6;
const POSTING_END_HOUR = 18;
const MAX_COMMENTS_PER_DAY = 20;
const TIMEZONE = 'America/Los_Angeles';

/**
 * Calculate the next available posting slot
 * Spreads comments evenly throughout the day (36 min apart for 20 comments/day)
 */
function calculateScheduledTime(existingScheduledCount: number, workspaceTimezone: string = TIMEZONE): Date {
  const tz = workspaceTimezone || TIMEZONE;
  const now = new Date();

  // Get current time in workspace timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    hour12: false
  });
  const currentHour = parseInt(formatter.format(now));

  // Calculate minutes between each comment (12 hours / 20 comments = 36 min)
  const minutesBetweenComments = Math.floor((POSTING_END_HOUR - POSTING_START_HOUR) * 60 / MAX_COMMENTS_PER_DAY);

  // Find next available slot
  let scheduledTime = new Date(now);

  // If outside posting hours, schedule for next day's start
  if (currentHour < POSTING_START_HOUR || currentHour >= POSTING_END_HOUR) {
    // Set to next day 6 AM
    scheduledTime.setDate(scheduledTime.getDate() + (currentHour >= POSTING_END_HOUR ? 1 : 0));
    scheduledTime.setHours(POSTING_START_HOUR, 0, 0, 0);
  }

  // Add offset based on queue position
  const offsetMinutes = existingScheduledCount * minutesBetweenComments;
  scheduledTime = new Date(scheduledTime.getTime() + offsetMinutes * 60 * 1000);

  // If scheduled time is past today's window, roll to next day
  const scheduledHour = parseInt(new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    hour12: false
  }).format(scheduledTime));

  if (scheduledHour >= POSTING_END_HOUR) {
    scheduledTime.setDate(scheduledTime.getDate() + 1);
    scheduledTime.setHours(POSTING_START_HOUR, 0, 0, 0);
  }

  return scheduledTime;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { comment_id, edited_text } = body;

    if (!comment_id) {
      return NextResponse.json(
        { error: 'Missing comment_id' },
        { status: 400 }
      );
    }

    console.log('✅ Approving comment:', comment_id);
    if (edited_text) {
      console.log('📝 Using edited text:', edited_text.substring(0, 50) + '...');
    }

    // Verify user is authenticated
    const authClient = await createSupabaseRouteClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      console.error('❌ Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service role to bypass RLS for admin operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get comment with post details
    const { data: comment, error: fetchError } = await supabase
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
      .eq('id', comment_id)
      .single();

    if (fetchError || !comment) {
      console.error('❌ Error fetching comment:', fetchError);
      return NextResponse.json(
        { error: 'Comment not found', details: fetchError?.message },
        { status: 404 }
      );
    }

    // Get LinkedIn account for this workspace (validate it exists)
    const { data: linkedinAccount, error: accountError } = await supabase
      .from('workspace_accounts')
      .select('unipile_account_id')
      .eq('workspace_id', comment.workspace_id)
      .eq('account_type', 'linkedin')
      .eq('connection_status', 'connected')
      .limit(1)
      .single();

    if (accountError || !linkedinAccount) {
      console.error('❌ No LinkedIn account found:', accountError);
      return NextResponse.json(
        { error: 'No connected LinkedIn account found for this workspace' },
        { status: 400 }
      );
    }

    // Get workspace timezone from brand guidelines
    const { data: brandSettings } = await supabase
      .from('linkedin_brand_guidelines')
      .select('timezone')
      .eq('workspace_id', comment.workspace_id)
      .single();

    const workspaceTimezone = brandSettings?.timezone || TIMEZONE;

    // Count existing scheduled comments for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { count: scheduledToday } = await supabase
      .from('linkedin_post_comments')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', comment.workspace_id)
      .eq('status', 'scheduled')
      .gte('scheduled_post_time', today.toISOString())
      .lt('scheduled_post_time', tomorrow.toISOString());

    // Check daily limit
    if ((scheduledToday || 0) >= MAX_COMMENTS_PER_DAY) {
      console.log(`⚠️ Daily limit reached (${MAX_COMMENTS_PER_DAY}), scheduling for next day`);
    }

    // Calculate scheduled time
    const scheduledPostTime = calculateScheduledTime(scheduledToday || 0, workspaceTimezone);

    console.log(`📅 Scheduling comment for: ${scheduledPostTime.toISOString()}`);
    console.log(`   Queue position: ${(scheduledToday || 0) + 1} of ${MAX_COMMENTS_PER_DAY} daily max`);

    // Use edited text if provided, otherwise use original from database
    const commentTextToPost = edited_text || comment.comment_text;

    // Update comment: set status to 'scheduled' and scheduled_post_time
    const { error: updateError } = await supabase
      .from('linkedin_post_comments')
      .update({
        status: 'scheduled',
        comment_text: commentTextToPost,
        approved_at: new Date().toISOString(),
        scheduled_post_time: scheduledPostTime.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', comment_id);

    if (updateError) {
      console.error('❌ Error scheduling comment:', updateError);
      return NextResponse.json(
        { error: 'Failed to schedule comment', details: updateError.message },
        { status: 500 }
      );
    }

    // Format time for user display
    const displayTime = scheduledPostTime.toLocaleString('en-US', {
      timeZone: workspaceTimezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    console.log('✅ Comment approved and scheduled successfully');

    return NextResponse.json({
      success: true,
      message: `Comment scheduled for ${displayTime}`,
      scheduled_for: scheduledPostTime.toISOString(),
      queue_position: (scheduledToday || 0) + 1
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
