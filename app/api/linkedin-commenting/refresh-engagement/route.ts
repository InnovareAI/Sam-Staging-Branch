/**
 * Refresh engagement metrics for posted comments
 * POST /api/linkedin-commenting/refresh-engagement
 *
 * Can be called:
 * - Manually from the UI to refresh a specific comment
 * - By a cron job to update all posted comments
 */

import { createClient } from '@supabase/supabase-js';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { NextRequest, NextResponse } from 'next/server';

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
      const authClient = await createSupabaseRouteClient();
      const { data: { user }, error: authError } = await authClient.auth.getUser();

      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Build query based on parameters
    let query = supabase
      .from('linkedin_post_comments')
      .select(`
        id,
        linkedin_comment_id,
        workspace_id,
        post:linkedin_posts_discovered!inner (
          id, social_id
        )
      `)
      .eq('status', 'posted')
      .not('linkedin_comment_id', 'is', null);

    if (comment_id) {
      // Refresh specific comment
      query = query.eq('id', comment_id);
    } else if (workspace_id) {
      // Refresh all comments for a workspace
      query = query.eq('workspace_id', workspace_id);
    }

    // Order by oldest engagement check first, limit batch size
    query = query
      .order('engagement_checked_at', { ascending: true, nullsFirst: true })
      .limit(batch_size);

    const { data: comments, error: fetchError } = await query;

    if (fetchError || !comments || comments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No comments to update',
        updated: 0
      });
    }

    console.log(`📊 Refreshing engagement for ${comments.length} comments`);

    // Get LinkedIn account for each workspace
    const workspaceIds = [...new Set(comments.map(c => c.workspace_id))];
    const workspaceAccounts: Record<string, string> = {};

    for (const wsId of workspaceIds) {
      const { data: account } = await supabase
        .from('workspace_accounts')
        .select('unipile_account_id')
        .eq('workspace_id', wsId)
        .eq('account_type', 'linkedin')
        .eq('connection_status', 'connected')
        .single();

      if (account) {
        workspaceAccounts[wsId] = account.unipile_account_id;
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
        const postSocialId = (comment.post as any).social_id;
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
        await supabase
          .from('linkedin_post_comments')
          .update({
            engagement_metrics: engagement,
            engagement_checked_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', comment.id);

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
    console.error('❌ Engagement refresh error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
