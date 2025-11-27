/**
 * Approve a generated comment and post it to LinkedIn
 * POST /api/linkedin-commenting/approve-comment
 */

import { createClient } from '@supabase/supabase-js';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;

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

    // Get LinkedIn account for this workspace
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

    // Use edited text if provided, otherwise use original from database
    const commentTextToPost = edited_text || comment.comment_text;

    // If edited, update the database with the new text
    if (edited_text && edited_text !== comment.comment_text) {
      await supabase
        .from('linkedin_post_comments')
        .update({ comment_text: edited_text, updated_at: new Date().toISOString() })
        .eq('id', comment_id);
    }

    // Post comment to LinkedIn via Unipile
    const postSocialId = comment.post.social_id;
    console.log('📤 Posting comment to LinkedIn post:', postSocialId);

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
          text: commentTextToPost
        })
      }
    );

    if (!unipileResponse.ok) {
      const errorText = await unipileResponse.text();
      console.error('❌ Unipile error:', unipileResponse.status, errorText);

      // Update comment as failed
      await supabase
        .from('linkedin_post_comments')
        .update({
          status: 'failed',
          failure_reason: `Unipile error: ${errorText}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', comment_id);

      return NextResponse.json(
        { error: 'Failed to post comment to LinkedIn', details: errorText },
        { status: 500 }
      );
    }

    const unipileData = await unipileResponse.json();
    console.log('✅ Comment posted to LinkedIn:', unipileData);

    // Extract the LinkedIn comment ID from Unipile response
    const linkedinCommentId = unipileData.id || unipileData.comment_id || unipileData.object_id || null;
    if (linkedinCommentId) {
      console.log('📋 LinkedIn comment ID:', linkedinCommentId);
    }

    // Update comment status to 'posted' with LinkedIn comment ID
    const { error: updateError } = await supabase
      .from('linkedin_post_comments')
      .update({
        status: 'posted',
        approved_at: new Date().toISOString(),
        posted_at: new Date().toISOString(),
        post_response: unipileData,
        linkedin_comment_id: linkedinCommentId,
        updated_at: new Date().toISOString()
      })
      .eq('id', comment_id);

    if (updateError) {
      console.error('❌ Error updating comment status:', updateError);
    }

    // Update post status to 'commented'
    await supabase
      .from('linkedin_posts_discovered')
      .update({ status: 'commented' })
      .eq('id', comment.post_id);

    console.log('✅ Comment approved and posted successfully');

    return NextResponse.json({
      success: true,
      message: 'Comment posted to LinkedIn',
      linkedin_response: unipileData
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
