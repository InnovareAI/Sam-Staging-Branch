/**
 * Bulk approve comments and post to LinkedIn
 * POST /api/linkedin-commenting/bulk-approve
 */

import { createClient } from '@supabase/supabase-js';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { NextRequest, NextResponse } from 'next/server';

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

    const authClient = await createSupabaseRouteClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const results: Array<{ id: string; status: 'success' | 'error'; error?: string }> = [];

    for (const comment_id of comment_ids) {
      try {
        // Get comment with post details
        const { data: comment, error: fetchError } = await supabase
          .from('linkedin_post_comments')
          .select(`
            *,
            post:linkedin_posts_discovered!inner (
              id, social_id, share_url, workspace_id
            )
          `)
          .eq('id', comment_id)
          .single();

        if (fetchError || !comment) {
          results.push({ id: comment_id, status: 'error', error: 'Comment not found' });
          continue;
        }

        // Get LinkedIn account
        const { data: linkedinAccount } = await supabase
          .from('workspace_accounts')
          .select('unipile_account_id')
          .eq('workspace_id', comment.workspace_id)
          .eq('account_type', 'linkedin')
          .eq('connection_status', 'connected')
          .limit(1)
          .single();

        if (!linkedinAccount) {
          results.push({ id: comment_id, status: 'error', error: 'No LinkedIn account' });
          continue;
        }

        // Post to LinkedIn
        const unipileResponse = await fetch(
          `${UNIPILE_BASE_URL}/api/v1/posts/${encodeURIComponent(comment.post.social_id)}/comments`,
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
          await supabase.from('linkedin_post_comments').update({
            status: 'failed', failure_reason: errorText
          }).eq('id', comment_id);
          results.push({ id: comment_id, status: 'error', error: 'LinkedIn API error' });
          continue;
        }

        const unipileData = await unipileResponse.json();

        // Extract LinkedIn comment ID
        const linkedinCommentId = unipileData.id || unipileData.comment_id || unipileData.object_id || null;

        // Update status with LinkedIn comment ID
        await supabase.from('linkedin_post_comments').update({
          status: 'posted',
          approved_at: new Date().toISOString(),
          posted_at: new Date().toISOString(),
          post_response: unipileData,
          linkedin_comment_id: linkedinCommentId
        }).eq('id', comment_id);

        await supabase.from('linkedin_posts_discovered')
          .update({ status: 'commented' })
          .eq('id', comment.post_id);

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
    console.error('❌ Bulk approve error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
