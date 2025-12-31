/**
 * Refresh engagement metrics for posted comments
 * POST /api/linkedin-commenting/refresh-engagement
 *
 * Can be called:
 * - Manually from the UI to refresh a specific comment
 * - By a cron job to update all posted comments
 */

import { verifyAuth, pool, AuthError } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120; // 2 minutes for batch updates

const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;

interface EngagementMetrics {
  likes_count: number;
  replies_count: number;
  last_checked: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { comment_id, workspace_id, batch_size = 10 } = body;

    // Authenticate user (unless called by cron)
    const cronSecret = request.headers.get('x-cron-secret');
    const isCronJob = cronSecret === process.env.CRON_SECRET;

    if (!isCronJob) {
      await verifyAuth(request);
    }

    // Build query based on parameters
    let queryText = `
      SELECT
        lpc.id,
        lpc.linkedin_comment_id,
        lpc.workspace_id,
        lpd.id as post_id,
        lpd.social_id as post_social_id
      FROM linkedin_post_comments lpc
      INNER JOIN linkedin_posts_discovered lpd ON lpc.post_id = lpd.id
      WHERE lpc.status = 'posted'
      AND lpc.linkedin_comment_id IS NOT NULL
    `;
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (comment_id) {
      queryText += ` AND lpc.id = $${paramIndex}`;
      queryParams.push(comment_id);
      paramIndex++;
    } else if (workspace_id) {
      queryText += ` AND lpc.workspace_id = $${paramIndex}`;
      queryParams.push(workspace_id);
      paramIndex++;
    }

    queryText += ` ORDER BY lpc.engagement_checked_at ASC NULLS FIRST LIMIT $${paramIndex}`;
    queryParams.push(batch_size);

    const commentsResult = await pool.query(queryText, queryParams);
    const comments = commentsResult.rows;

    if (comments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No comments to update',
        updated: 0
      });
    }

    console.log(`📊 Refreshing engagement for ${comments.length} comments`);

    // Get LinkedIn account for each workspace
    const workspaceIds = [...new Set(comments.map((c: any) => c.workspace_id))];
    const workspaceAccounts: Record<string, string> = {};

    for (const wsId of workspaceIds) {
      const accountResult = await pool.query(
        `SELECT unipile_account_id FROM workspace_accounts
         WHERE workspace_id = $1
         AND account_type = 'linkedin'
         AND connection_status = ANY($2)
         LIMIT 1`,
        [wsId, VALID_CONNECTION_STATUSES]
      );

      if (accountResult.rows.length > 0) {
        workspaceAccounts[wsId] = accountResult.rows[0].unipile_account_id;
      }
    }

    let updatedCount = 0;
    const results: Array<{ id: string; status: 'success' | 'error' | 'skipped'; engagement?: EngagementMetrics; error?: string }> = [];

    for (const comment of comments) {
      try {
        const accountId = workspaceAccounts[comment.workspace_id];
        if (!accountId) {
          results.push({ id: comment.id, status: 'skipped', error: 'No LinkedIn account' });
          continue;
        }

        // Fetch reactions for this comment from Unipile
        // Note: We need to get reactions on the post and filter by our comment
        // The comment reactions endpoint would be: /api/v1/posts/{post_id}/comments/{comment_id}/reactions
        // But Unipile may not support this - we'll try to get it from the post's comment list instead

        // First try to get comment info from the post's comments
        const postSocialId = comment.post_social_id;
        const commentsUrl = `${UNIPILE_BASE_URL}/api/v1/posts/${encodeURIComponent(postSocialId)}/comments?account_id=${accountId}`;

        const commentsResponse = await fetch(commentsUrl, {
          method: 'GET',
          headers: {
            'X-API-KEY': UNIPILE_API_KEY,
            'Accept': 'application/json'
          }
        });

        if (!commentsResponse.ok) {
          console.log(`⚠️ Could not fetch comments for post: ${commentsResponse.status}`);
          results.push({ id: comment.id, status: 'error', error: `API error: ${commentsResponse.status}` });
          continue;
        }

        const commentsData = await commentsResponse.json();
        const allComments = commentsData.items || commentsData || [];

        // Find our comment in the list
        const ourComment = allComments.find((c: any) =>
          c.id === comment.linkedin_comment_id ||
          c.comment_id === comment.linkedin_comment_id
        );

        let engagement: EngagementMetrics = {
          likes_count: 0,
          replies_count: 0,
          last_checked: new Date().toISOString()
        };

        if (ourComment) {
          engagement.likes_count = ourComment.likes_count || ourComment.num_likes || 0;
          engagement.replies_count = ourComment.replies_count || ourComment.num_comments || 0;
        }

        // Update the comment with engagement metrics
        await pool.query(
          `UPDATE linkedin_post_comments
           SET engagement_metrics = $1,
               engagement_checked_at = $2,
               updated_at = $3
           WHERE id = $4`,
          [
            JSON.stringify(engagement),
            new Date().toISOString(),
            new Date().toISOString(),
            comment.id
          ]
        );

        updatedCount++;
        results.push({ id: comment.id, status: 'success', engagement });

        // Rate limit: wait 1 second between API calls
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ Error updating engagement for comment ${comment.id}:`, error);
        results.push({
          id: comment.id,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`✅ Engagement refresh complete: ${updatedCount}/${comments.length} updated`);

    return NextResponse.json({
      success: true,
      total: comments.length,
      updated: updatedCount,
      results
    });

  } catch (error) {
    // Handle auth errors
    if (error && typeof error === 'object' && 'code' in error) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }

    console.error('❌ Engagement refresh error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
