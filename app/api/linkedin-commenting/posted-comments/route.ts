/**
 * Fetch posted comments history
 * GET /api/linkedin-commenting/posted-comments
 */

import { verifyAuth, pool, AuthError } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Authenticate user using Firebase auth
    const { workspaceId } = await verifyAuth(request);

    console.log('📜 Fetching posted comments history for workspace:', workspaceId);

    // Get total count for pagination
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM linkedin_post_comments
       WHERE workspace_id = $1 AND status = 'posted'`,
      [workspaceId]
    );
    const total = parseInt(countResult.rows[0]?.count || '0');

    // Fetch posted comments with engagement metrics
    const commentsResult = await pool.query(
      `SELECT
        lpc.id,
        lpc.comment_text,
        lpc.posted_at,
        lpc.linkedin_comment_id,
        lpc.engagement_metrics,
        lpc.engagement_checked_at,
        lpd.id as post_id,
        lpd.author_name as post_author_name,
        lpd.author_profile_id as post_author_profile_id,
        lpd.author_title as post_author_title,
        lpd.post_content,
        lpd.share_url as post_share_url,
        lpd.post_date,
        lpd.engagement_metrics as post_engagement_metrics
       FROM linkedin_post_comments lpc
       INNER JOIN linkedin_posts_discovered lpd ON lpc.post_id = lpd.id
       WHERE lpc.workspace_id = $1
       AND lpc.status = 'posted'
       ORDER BY lpc.posted_at DESC
       LIMIT $2 OFFSET $3`,
      [workspaceId, limit, offset]
    );

    // Transform the flat rows into nested structure
    const comments = commentsResult.rows.map(row => ({
      id: row.id,
      comment_text: row.comment_text,
      posted_at: row.posted_at,
      linkedin_comment_id: row.linkedin_comment_id,
      engagement_metrics: row.engagement_metrics,
      engagement_checked_at: row.engagement_checked_at,
      post: {
        id: row.post_id,
        author_name: row.post_author_name,
        author_profile_id: row.post_author_profile_id,
        author_title: row.post_author_title,
        post_content: row.post_content,
        share_url: row.post_share_url,
        post_date: row.post_date,
        engagement_metrics: row.post_engagement_metrics
      }
    }));

    console.log(`✅ Found ${comments.length} posted comments (total: ${total})`);

    return NextResponse.json({
      success: true,
      comments: comments,
      count: comments.length,
      total: total,
      hasMore: (offset + limit) < total
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
