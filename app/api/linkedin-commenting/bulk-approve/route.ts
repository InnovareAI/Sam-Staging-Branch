/**
 * Bulk approve comments and post to LinkedIn
 * POST /api/linkedin-commenting/bulk-approve
 */

import { verifyAuth, pool, AuthError } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for bulk operations

const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { comment_ids } = body;

    if (!comment_ids || !Array.isArray(comment_ids) || comment_ids.length === 0) {
      return NextResponse.json({ error: 'Missing comment_ids array' }, { status: 400 });
    }

    console.log(`✅ Bulk approving ${comment_ids.length} comments`);

    // Authenticate user using Firebase auth
    await verifyAuth(request);

    const results: Array<{ id: string; status: 'success' | 'error'; error?: string }> = [];

    for (const comment_id of comment_ids) {
      try {
        // Get comment with post details
        const commentResult = await pool.query(
          `SELECT lpc.*, lpd.id as post_db_id, lpd.social_id as post_social_id, lpd.share_url, lpd.workspace_id as post_workspace_id
           FROM linkedin_post_comments lpc
           INNER JOIN linkedin_posts_discovered lpd ON lpc.post_id = lpd.id
           WHERE lpc.id = $1`,
          [comment_id]
        );

        if (commentResult.rows.length === 0) {
          results.push({ id: comment_id, status: 'error', error: 'Comment not found' });
          continue;
        }

        const comment = commentResult.rows[0];

        // Get LinkedIn account
        const accountResult = await pool.query(
          `SELECT unipile_account_id FROM workspace_accounts
           WHERE workspace_id = $1
           AND account_type = 'linkedin'
           AND connection_status = ANY($2)
           LIMIT 1`,
          [comment.workspace_id, VALID_CONNECTION_STATUSES]
        );

        if (accountResult.rows.length === 0) {
          results.push({ id: comment_id, status: 'error', error: 'No LinkedIn account' });
          continue;
        }

        const linkedinAccount = accountResult.rows[0];

        // Post to LinkedIn
        const unipileResponse = await fetch(
          `${UNIPILE_BASE_URL}/api/v1/posts/${encodeURIComponent(comment.post_social_id)}/comments`,
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
          await pool.query(
            `UPDATE linkedin_post_comments SET status = 'failed', failure_reason = $1 WHERE id = $2`,
            [errorText, comment_id]
          );
          results.push({ id: comment_id, status: 'error', error: 'LinkedIn API error' });
          continue;
        }

        const unipileData = await unipileResponse.json();

        // Extract LinkedIn comment ID
        const linkedinCommentId = unipileData.id || unipileData.comment_id || unipileData.object_id || null;

        // Update status with LinkedIn comment ID
        await pool.query(
          `UPDATE linkedin_post_comments
           SET status = 'posted',
               approved_at = $1,
               posted_at = $2,
               post_response = $3,
               linkedin_comment_id = $4
           WHERE id = $5`,
          [
            new Date().toISOString(),
            new Date().toISOString(),
            JSON.stringify(unipileData),
            linkedinCommentId,
            comment_id
          ]
        );

        await pool.query(
          `UPDATE linkedin_posts_discovered SET status = 'commented' WHERE id = $1`,
          [comment.post_id]
        );

        results.push({ id: comment_id, status: 'success' });

        // Rate limit: 3 seconds between posts
        await new Promise(resolve => setTimeout(resolve, 3000));

      } catch (error) {
        results.push({ id: comment_id, status: 'error', error: String(error) });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    console.log(`✅ Bulk approve complete: ${successCount} success, ${errorCount} errors`);

    return NextResponse.json({
      success: true,
      total: comment_ids.length,
      success_count: successCount,
      error_count: errorCount,
      results
    });

  } catch (error) {
    // Handle auth errors
    if (error && typeof error === 'object' && 'code' in error) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }

    console.error('❌ Bulk approve error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
