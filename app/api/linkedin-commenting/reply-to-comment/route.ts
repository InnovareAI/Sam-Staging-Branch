/**
 * Reply to a specific comment on a LinkedIn post
 * POST /api/linkedin-commenting/reply-to-comment
 */

import { verifyAuth, pool, AuthError } from '@/lib/auth';
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

    // Authenticate user using Firebase auth
    const { userId } = await verifyAuth(request);

    // Get post details
    const postResult = await pool.query(
      `SELECT id, social_id, workspace_id FROM linkedin_posts_discovered WHERE id = $1`,
      [post_id]
    );

    if (postResult.rows.length === 0) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const post = postResult.rows[0];

    // Get LinkedIn account for this workspace
    const accountResult = await pool.query(
      `SELECT unipile_account_id FROM workspace_accounts
       WHERE workspace_id = $1
       AND account_type = 'linkedin'
       AND connection_status = ANY($2)
       LIMIT 1`,
      [post.workspace_id, VALID_CONNECTION_STATUSES]
    );

    if (accountResult.rows.length === 0) {
      return NextResponse.json({ error: 'No connected LinkedIn account' }, { status: 400 });
    }

    const linkedinAccount = accountResult.rows[0];

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
    await pool.query(
      `INSERT INTO linkedin_comment_replies
       (workspace_id, post_id, original_comment_id, original_comment_text,
        original_comment_author_name, original_comment_author_profile_id,
        reply_text, replied_at, unipile_response, replied_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        post.workspace_id,
        post.id,
        comment_id,
        body.original_comment_text || null,
        body.original_comment_author_name || (mention_author?.name) || null,
        body.original_comment_author_profile_id || (mention_author?.profile_id) || null,
        reply_text.trim(),
        new Date().toISOString(),
        JSON.stringify(unipileData),
        userId
      ]
    );

    console.log(`✅ Reply posted successfully`);

    return NextResponse.json({
      success: true,
      message: 'Reply posted to LinkedIn',
      unipile_response: unipileData
    });

  } catch (error) {
    // Handle auth errors
    if (error && typeof error === 'object' && 'code' in error) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }

    console.error('❌ Error posting reply:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
