/**
 * Reject a generated comment
 * POST /api/linkedin-commenting/reject-comment
 */

import { verifyAuth, pool, AuthError } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { comment_id } = body;

    if (!comment_id) {
      return NextResponse.json(
        { error: 'Missing comment_id' },
        { status: 400 }
      );
    }

    console.log('❌ Rejecting comment:', comment_id);

    // Authenticate user using Firebase auth
    await verifyAuth(request);

    // Update comment status to 'rejected' and return the updated comment
    const updateResult = await pool.query(
      `UPDATE linkedin_post_comments
       SET status = 'rejected',
           rejected_at = $1,
           updated_at = $2
       WHERE id = $3
       RETURNING *`,
      [new Date().toISOString(), new Date().toISOString(), comment_id]
    );

    if (updateResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    const comment = updateResult.rows[0];

    console.log('✅ Comment rejected successfully');

    // When a comment is rejected, reset the post to 'skipped' status
    // This marks it so we don't regenerate for same post
    if (comment.post_id) {
      await pool.query(
        `UPDATE linkedin_posts_discovered
         SET status = 'skipped',
             updated_at = $1
         WHERE id = $2`,
        [new Date().toISOString(), comment.post_id]
      );
    }

    // Count remaining pending comments for this workspace
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM linkedin_post_comments
       WHERE workspace_id = $1
       AND status = 'pending_approval'`,
      [comment.workspace_id]
    );

    const pendingCount = parseInt(countResult.rows[0]?.count || '0');

    // If we're running low on pending comments, trigger async discovery
    // This ensures the approval queue stays populated
    const LOW_THRESHOLD = 5;
    if (pendingCount < LOW_THRESHOLD) {
      console.log(`📬 Low pending count (${pendingCount}), triggering background discovery...`);

      // Fire and forget - don't wait for discovery to complete
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com';
      fetch(`${baseUrl}/api/linkedin-commenting/discover-posts-hashtag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': process.env.CRON_SECRET || ''
        }
      }).catch(err => console.warn('Background discovery failed:', err.message));
    }

    return NextResponse.json({
      success: true,
      comment,
      pending_remaining: pendingCount
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
