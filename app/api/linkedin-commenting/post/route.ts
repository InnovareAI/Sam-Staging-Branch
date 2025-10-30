/**
 * LinkedIn Commenting Agent - Post Comment
 * Called by N8N to post comment to LinkedIn via Unipile
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Verify N8N internal trigger
    const triggerHeader = request.headers.get('x-internal-trigger');
    if (triggerHeader !== 'n8n-commenting-agent') {
      return NextResponse.json(
        { error: 'Unauthorized - N8N trigger required' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.comment_queue_id) {
      return NextResponse.json(
        { error: 'Missing required field: comment_queue_id' },
        { status: 400 }
      );
    }

    console.log('📤 Posting LinkedIn comment:', {
      comment_queue_id: body.comment_queue_id
    });

    const supabase = await createClient();

    // Get comment from queue
    const { data: comment, error: commentError } = await supabase
      .from('linkedin_comment_queue')
      .select('*')
      .eq('id', body.comment_queue_id)
      .single();

    if (commentError || !comment) {
      return NextResponse.json(
        { error: 'Comment not found', details: commentError?.message },
        { status: 404 }
      );
    }

    // Verify comment is ready to post
    if (comment.status !== 'queued') {
      return NextResponse.json(
        { error: `Comment not queued (status: ${comment.status})` },
        { status: 400 }
      );
    }

    // If requires approval, check it's approved
    if (comment.requires_approval && comment.approval_status !== 'approved') {
      return NextResponse.json(
        { error: 'Comment requires approval but not yet approved' },
        { status: 400 }
      );
    }

    // Get workspace LinkedIn account
    const { data: workspaceAccount, error: accountError } = await supabase
      .from('workspace_accounts')
      .select('unipile_account_id, unipile_dsn, unipile_api_key')
      .eq('workspace_id', comment.workspace_id)
      .eq('provider', 'linkedin')
      .eq('status', 'active')
      .single();

    if (accountError || !workspaceAccount) {
      console.error('❌ No active LinkedIn account for workspace:', comment.workspace_id);

      // Update comment status
      await supabase
        .from('linkedin_comment_queue')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          failure_reason: 'No active LinkedIn account'
        })
        .eq('id', comment.id);

      return NextResponse.json(
        { error: 'No active LinkedIn account for workspace' },
        { status: 400 }
      );
    }

    // Update status to posting
    await supabase
      .from('linkedin_comment_queue')
      .update({ status: 'posting' })
      .eq('id', comment.id);

    // Post comment via Unipile
    const unipileUrl = `https://${workspaceAccount.unipile_dsn}/api/v1/posts/${comment.post_social_id}/comments`;

    console.log('📤 Posting to Unipile:', {
      url: unipileUrl,
      post_id: comment.post_social_id
    });

    const unipileResponse = await fetch(unipileUrl, {
      method: 'POST',
      headers: {
        'X-API-KEY': workspaceAccount.unipile_api_key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        account_id: workspaceAccount.unipile_account_id,
        text: comment.comment_text
      })
    });

    if (!unipileResponse.ok) {
      const errorText = await unipileResponse.text();
      console.error('❌ Unipile API error:', {
        status: unipileResponse.status,
        error: errorText
      });

      // Update comment status
      await supabase
        .from('linkedin_comment_queue')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          failure_reason: `Unipile API error: ${errorText}`
        })
        .eq('id', comment.id);

      return NextResponse.json(
        { error: 'Failed to post comment to LinkedIn', details: errorText },
        { status: 500 }
      );
    }

    const unipileData = await unipileResponse.json();

    console.log('✅ Comment posted to LinkedIn:', {
      comment_id: unipileData.id || unipileData.object?.id,
      post_id: comment.post_social_id
    });

    // Extract comment ID from Unipile response
    const commentLinkedInId = unipileData.id ||
                               unipileData.object?.id ||
                               unipileData.comment_id ||
                               `comment_${Date.now()}`;

    // Update comment queue status
    await supabase
      .from('linkedin_comment_queue')
      .update({
        status: 'posted',
        posted_at: new Date().toISOString(),
        unipile_comment_id: commentLinkedInId,
        unipile_response: unipileData
      })
      .eq('id', comment.id);

    // Save to posted comments tracking
    await supabase
      .from('linkedin_comments_posted')
      .insert({
        workspace_id: comment.workspace_id,
        comment_queue_id: comment.id,
        post_id: comment.post_id,
        post_linkedin_id: comment.post_linkedin_id,
        comment_linkedin_id: commentLinkedInId,
        comment_text: comment.comment_text,
        posted_by_account_id: workspaceAccount.unipile_account_id,
        metadata: {
          confidence_score: comment.confidence_score,
          approval_status: comment.approval_status,
          generation_metadata: comment.generation_metadata
        }
      });

    // Update post status
    await supabase
      .from('linkedin_posts_discovered')
      .update({ status: 'commented' })
      .eq('id', comment.post_id);

    console.log('✅ Comment posted successfully:', {
      comment_queue_id: comment.id,
      linkedin_comment_id: commentLinkedInId
    });

    return NextResponse.json({
      success: true,
      comment_id: commentLinkedInId,
      posted_at: new Date().toISOString(),
      unipile_response: unipileData
    });

  } catch (error) {
    console.error('❌ Error posting comment:', error);
    return NextResponse.json(
      {
        error: 'Failed to post comment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
