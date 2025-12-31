/**
 * Approve a generated comment and schedule it for posting
 * POST /api/linkedin-commenting/approve-comment
 *
 * Comments are queued and spread throughout the day (6 AM - 6 PM PT)
 * A separate cron job processes the queue every 30 minutes
 */

import { verifyAuth, pool, AuthError } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';

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

    // Authenticate user using Firebase auth
    await verifyAuth(request);

    // Get comment with post details
    const commentResult = await pool.query(
      `SELECT lpc.*, lpd.id as post_db_id, lpd.social_id as post_social_id, lpd.share_url, lpd.workspace_id as post_workspace_id
       FROM linkedin_post_comments lpc
       INNER JOIN linkedin_posts_discovered lpd ON lpc.post_id = lpd.id
       WHERE lpc.id = $1`,
      [comment_id]
    );

    if (commentResult.rows.length === 0) {
      console.error('❌ Error fetching comment: not found');
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    const comment = commentResult.rows[0];

    // Get LinkedIn account for this workspace (validate it exists)
    const accountResult = await pool.query(
      `SELECT unipile_account_id FROM workspace_accounts
       WHERE workspace_id = $1
       AND account_type = 'linkedin'
       AND connection_status = ANY($2)
       LIMIT 1`,
      [comment.workspace_id, VALID_CONNECTION_STATUSES]
    );

    if (accountResult.rows.length === 0) {
      console.error('❌ No LinkedIn account found');
      return NextResponse.json(
        { error: 'No connected LinkedIn account found for this workspace' },
        { status: 400 }
      );
    }

    // Get workspace timezone from brand guidelines
    const brandResult = await pool.query(
      `SELECT timezone FROM linkedin_brand_guidelines WHERE workspace_id = $1`,
      [comment.workspace_id]
    );

    const workspaceTimezone = brandResult.rows[0]?.timezone || TIMEZONE;

    // Count existing scheduled comments for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM linkedin_post_comments
       WHERE workspace_id = $1
       AND status = 'scheduled'
       AND scheduled_post_time >= $2
       AND scheduled_post_time < $3`,
      [comment.workspace_id, today.toISOString(), tomorrow.toISOString()]
    );

    const scheduledToday = parseInt(countResult.rows[0]?.count || '0');

    // Check daily limit
    if (scheduledToday >= MAX_COMMENTS_PER_DAY) {
      console.log(`⚠️ Daily limit reached (${MAX_COMMENTS_PER_DAY}), scheduling for next day`);
    }

    // Calculate scheduled time
    const scheduledPostTime = calculateScheduledTime(scheduledToday, workspaceTimezone);

    console.log(`📅 Scheduling comment for: ${scheduledPostTime.toISOString()}`);
    console.log(`   Queue position: ${scheduledToday + 1} of ${MAX_COMMENTS_PER_DAY} daily max`);

    // Use edited text if provided, otherwise use original from database
    const commentTextToPost = edited_text || comment.comment_text;

    // Update comment: set status to 'scheduled' and scheduled_post_time
    await pool.query(
      `UPDATE linkedin_post_comments
       SET status = 'scheduled',
           comment_text = $1,
           approved_at = $2,
           scheduled_post_time = $3,
           updated_at = $4
       WHERE id = $5`,
      [
        commentTextToPost,
        new Date().toISOString(),
        scheduledPostTime.toISOString(),
        new Date().toISOString(),
        comment_id
      ]
    );

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
      queue_position: scheduledToday + 1
    });

  } catch (error) {
    // Handle auth errors
    if (error && typeof error === 'object' && 'code' in error) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }

    console.error('❌ Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
