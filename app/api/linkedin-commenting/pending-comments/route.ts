/**
 * Fetch pending comments for approval workflow
 * GET /api/linkedin-commenting/pending-comments
 */

import { verifyAuth, pool, AuthError } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user using Firebase auth
    const { userId, workspaceId } = await verifyAuth(request);

    console.log('📋 Fetching pending comments for workspace:', workspaceId);

    // Fetch comments that need review:
    // - pending_approval: awaiting manual approval
    // - scheduled: auto-approved, but can still be reviewed/edited before posting
    // Join with posts and monitors to get full context
    const commentsResult = await pool.query(
      `SELECT
        lpc.id,
        lpc.comment_text,
        lpc.status,
        lpc.generated_at,
        lpc.scheduled_post_time,
        lpc.created_at,
        lpd.id as post_id,
        lpd.author_name as post_author_name,
        lpd.author_profile_id as post_author_profile_id,
        lpd.author_headline as post_author_headline,
        lpd.post_content,
        lpd.share_url as post_share_url,
        lpd.post_date,
        lpd.engagement_metrics as post_engagement_metrics,
        lpd.monitor_id,
        lpm.id as monitor_id,
        lpm.name as monitor_name
       FROM linkedin_post_comments lpc
       INNER JOIN linkedin_posts_discovered lpd ON lpc.post_id = lpd.id
       LEFT JOIN linkedin_post_monitors lpm ON lpc.monitor_id = lpm.id
       WHERE lpc.workspace_id = $1
       AND lpc.status IN ('pending_approval', 'scheduled')
       ORDER BY lpc.created_at DESC`,
      [workspaceId]
    );

    // Transform the flat rows into nested structure
    const comments = commentsResult.rows.map(row => ({
      id: row.id,
      comment_text: row.comment_text,
      status: row.status,
      generated_at: row.generated_at,
      scheduled_post_time: row.scheduled_post_time,
      created_at: row.created_at,
      post: {
        id: row.post_id,
        author_name: row.post_author_name,
        author_profile_id: row.post_author_profile_id,
        author_headline: row.post_author_headline,
        post_content: row.post_content,
        share_url: row.post_share_url,
        post_date: row.post_date,
        engagement_metrics: row.post_engagement_metrics,
        monitor_id: row.monitor_id
      },
      monitor: row.monitor_id ? {
        id: row.monitor_id,
        name: row.monitor_name
      } : null
    }));

    console.log(`✅ Found ${comments.length} pending comments`);

    return NextResponse.json({
      success: true,
      comments: comments,
      count: comments.length
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
