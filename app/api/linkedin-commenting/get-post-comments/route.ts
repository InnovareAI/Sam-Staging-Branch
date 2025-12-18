/**
 * Get comments from a LinkedIn post via Unipile
 * GET /api/linkedin-commenting/get-post-comments?post_id=...
 */

import { createClient } from '@supabase/supabase-js';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { NextRequest, NextResponse } from 'next/server';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;

export interface PostComment {
  id: string;
  author_name: string;
  author_profile_id: string;
  author_title?: string;
  author_profile_url?: string;
  author_avatar_url?: string;
  text: string;
  created_at: string;
  likes_count: number;
  replies_count: number;
  is_reply: boolean;
  parent_comment_id?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('post_id');

    if (!postId) {
      return NextResponse.json({ error: 'Missing post_id parameter' }, { status: 400 });
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
      .eq('id', postId)
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

    console.log(`📬 Fetching comments for post ${post.social_id}`);

    // Fetch comments from Unipile
    const unipileUrl = `${UNIPILE_BASE_URL}/api/v1/posts/${encodeURIComponent(post.social_id)}/comments?account_id=${linkedinAccount.unipile_account_id}`;

    const unipileResponse = await fetch(unipileUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!unipileResponse.ok) {
      const errorText = await unipileResponse.text();
      console.error('❌ Unipile error:', errorText);
      return NextResponse.json({
        error: 'Failed to fetch comments from LinkedIn',
        details: errorText
      }, { status: 500 });
    }

    const unipileData = await unipileResponse.json();

    // Transform Unipile response to our format
    const comments: PostComment[] = (unipileData.items || unipileData || []).map((item: any) => ({
      id: item.id || item.comment_id,
      author_name: item.author?.name || item.author_name || 'Unknown',
      author_profile_id: item.author?.id || item.author_profile_id || '',
      author_title: item.author?.headline || item.author_title,
      author_profile_url: item.author?.profile_url || item.author_public_url,
      author_avatar_url: item.author?.profile_picture_url || item.author_avatar_url,
      text: item.text || item.comment || '',
      created_at: item.created_at || item.date || new Date().toISOString(),
      likes_count: item.likes_count || item.num_likes || 0,
      replies_count: item.replies_count || item.num_comments || 0,
      is_reply: !!item.parent_comment_id,
      parent_comment_id: item.parent_comment_id
    }));

    console.log(`✅ Found ${comments.length} comments`);

    return NextResponse.json({
      success: true,
      post_id: postId,
      social_id: post.social_id,
      comments,
      total: comments.length
    });

  } catch (error) {
    console.error('❌ Error fetching comments:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
