/**
 * Reply to a specific comment on a LinkedIn post
 * POST /api/linkedin-commenting/reply-to-comment
 */

import { createClient } from '@supabase/supabase-js';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { NextRequest, NextResponse } from 'next/server';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { post_id, comment_id, reply_text, mention_author } = body;

    if (!post_id) {
      return NextResponse.json({ error: 'Missing post_id' }, { status: 400 });
    }

    if (!comment_id) {
      return NextResponse.json({ error: 'Missing comment_id' }, { status: 400 });
    }

    if (!reply_text || reply_text.trim().length === 0) {
      return NextResponse.json({ error: 'Missing reply_text' }, { status: 400 });
    }

    // Authenticate user
    const authClient = await createSupabaseRouteClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get post details
    const { data: post, error: postError } = await supabase
      .from('linkedin_posts_discovered')
      .select('id, social_id, workspace_id')
      .eq('id', post_id)
      .single();

    if (postError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Get LinkedIn account for this workspace
    const { data: linkedinAccount, error: accountError } = await supabase
      .from('workspace_accounts')
      .select('unipile_account_id')
      .eq('workspace_id', post.workspace_id)
      .eq('account_type', 'linkedin')
      .in('connection_status', VALID_CONNECTION_STATUSES)
      .limit(1)
      .single();

    if (accountError || !linkedinAccount) {
      return NextResponse.json({ error: 'No connected LinkedIn account' }, { status: 400 });
    }

    console.log(`💬 Replying to comment ${comment_id} on post ${post.social_id}`);

    // Build request body
    const requestBody: any = {
      account_id: linkedinAccount.unipile_account_id,
      text: reply_text.trim(),
      comment_id: comment_id  // This makes it a reply to that specific comment
    };

    // Add mention if requested
    if (mention_author && mention_author.name && mention_author.profile_id) {
      requestBody.mentions = [{
        name: mention_author.name,
        profile_id: mention_author.profile_id
      }];
    }

    // Post reply via Unipile
    const unipileResponse = await fetch(
      `${UNIPILE_BASE_URL}/api/v1/posts/${encodeURIComponent(post.social_id)}/comments`,
      {
        method: 'POST',
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      }
    );

    if (!unipileResponse.ok) {
      const errorText = await unipileResponse.text();
      console.error('❌ Unipile error:', errorText);
      return NextResponse.json({
        error: 'Failed to post reply to LinkedIn',
        details: errorText
      }, { status: 500 });
    }

    const unipileData = await unipileResponse.json();

    // Log the reply in our database
    await supabase.from('linkedin_comment_replies').insert({
      workspace_id: post.workspace_id,
      post_id: post.id,
      original_comment_id: comment_id,
      original_comment_text: body.original_comment_text || null,
      original_comment_author_name: body.original_comment_author_name || (mention_author?.name) || null,
      original_comment_author_profile_id: body.original_comment_author_profile_id || (mention_author?.profile_id) || null,
      reply_text: reply_text.trim(),
      replied_at: new Date().toISOString(),
      unipile_response: unipileData,
      replied_by: user.id
    }).select().single();

    console.log(`✅ Reply posted successfully`);

    return NextResponse.json({
      success: true,
      message: 'Reply posted to LinkedIn',
      unipile_response: unipileData
    });

  } catch (error) {
    console.error('❌ Error posting reply:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
