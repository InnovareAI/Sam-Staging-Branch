/**
 * Self-Post Monitors API
 * GET /api/linkedin-commenting/self-post-monitors - List monitors
 * POST /api/linkedin-commenting/self-post-monitors - Create monitor
 *
 * Monitor your own LinkedIn posts for comments and auto-reply with custom prompts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createCleanRouteHandlerClient } from '@/lib/supabase-server';

const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;

/**
 * Extract activity ID from LinkedIn post URL
 * Supports: linkedin.com/feed/update/urn:li:activity:123
 *           linkedin.com/posts/username_activity-123
 */
function extractActivityId(postUrl: string): string | null {
  // Format 1: /feed/update/urn:li:activity:123
  const feedMatch = postUrl.match(/activity[:%](\d+)/i);
  if (feedMatch) {
    return `urn:li:activity:${feedMatch[1]}`;
  }

  // Format 2: /posts/username_activity-123-xyz
  const postsMatch = postUrl.match(/activity-(\d+)/i);
  if (postsMatch) {
    return `urn:li:activity:${postsMatch[1]}`;
  }

  return null;
}

/**
 * Fetch post details from LinkedIn via Unipile
 */
async function fetchPostDetails(activityId: string, accountId: string): Promise<{
  ugcId?: string;
  content?: string;
  authorName?: string;
  postedAt?: string;
} | null> {
  try {
    const response = await fetch(
      `${UNIPILE_BASE_URL}/api/v1/posts/${encodeURIComponent(activityId)}?account_id=${accountId}`,
      {
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error(`Failed to fetch post: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return {
      ugcId: data.social_id?.startsWith('urn:li:ugcPost:') ? data.social_id : undefined,
      content: data.text || data.content,
      authorName: data.author?.name || data.author?.first_name,
      postedAt: data.date || data.created_at
    };
  } catch (error) {
    console.error('Error fetching post details:', error);
    return null;
  }
}

/**
 * GET - List self-post monitors for workspace
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createCleanRouteHandlerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
    }

    // Verify workspace membership
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Not a workspace member' }, { status: 403 });
    }

    // Fetch monitors with reply stats
    const { data: monitors, error } = await supabase
      .from('linkedin_self_post_monitors')
      .select(`
        *,
        replies:linkedin_self_post_comment_replies(count)
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching monitors:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      monitors: monitors || []
    });

  } catch (error) {
    console.error('Self-post monitors GET error:', error);
    return NextResponse.json({
      error: 'Failed to fetch monitors',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * POST - Create new self-post monitor
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createCleanRouteHandlerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      workspace_id,
      post_url,
      post_title,
      reply_prompt,
      reply_context,
      auto_approve_replies,
      max_replies_per_day,
      check_frequency_minutes,
      reply_to_questions_only,
      skip_single_word_comments
    } = body;

    // Validate required fields
    if (!workspace_id || !post_url || !reply_prompt) {
      return NextResponse.json({
        error: 'Missing required fields',
        required: ['workspace_id', 'post_url', 'reply_prompt']
      }, { status: 400 });
    }

    // Verify workspace membership
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Not a workspace member' }, { status: 403 });
    }

    // Extract activity ID from URL
    const activityId = extractActivityId(post_url);
    if (!activityId) {
      return NextResponse.json({
        error: 'Invalid LinkedIn post URL',
        hint: 'URL should contain activity ID (e.g., linkedin.com/feed/update/urn:li:activity:123)'
      }, { status: 400 });
    }

    // Get LinkedIn account for this workspace
    const { data: linkedinAccount } = await supabase
      .from('workspace_accounts')
      .select('unipile_account_id')
      .eq('workspace_id', workspace_id)
      .eq('account_type', 'linkedin')
      .eq('connection_status', 'connected')
      .limit(1)
      .single();

    if (!linkedinAccount) {
      return NextResponse.json({
        error: 'No connected LinkedIn account',
        hint: 'Connect your LinkedIn account in Settings → Integrations'
      }, { status: 400 });
    }

    // Fetch post details from LinkedIn
    const postDetails = await fetchPostDetails(activityId, linkedinAccount.unipile_account_id);

    // Create the monitor
    const { data: monitor, error: insertError } = await supabase
      .from('linkedin_self_post_monitors')
      .insert({
        workspace_id,
        post_url,
        post_social_id: activityId,
        post_ugc_id: postDetails?.ugcId,
        post_title: post_title || postDetails?.content?.substring(0, 100) || 'Untitled Post',
        post_content: postDetails?.content,
        post_author_name: postDetails?.authorName,
        posted_at: postDetails?.postedAt,
        reply_prompt,
        reply_context: reply_context || {},
        auto_approve_replies: auto_approve_replies ?? false,
        max_replies_per_day: max_replies_per_day ?? 20,
        check_frequency_minutes: check_frequency_minutes ?? 30,
        reply_to_questions_only: reply_to_questions_only ?? false,
        skip_single_word_comments: skip_single_word_comments ?? true,
        is_active: true
      })
      .select()
      .single();

    if (insertError) {
      // Handle duplicate
      if (insertError.code === '23505') {
        return NextResponse.json({
          error: 'Monitor already exists for this post',
          hint: 'You can edit the existing monitor instead'
        }, { status: 409 });
      }
      console.error('Error creating monitor:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    console.log(`✅ Created self-post monitor: ${monitor.id} for post ${activityId}`);

    return NextResponse.json({
      success: true,
      monitor,
      message: 'Self-post monitor created successfully'
    });

  } catch (error) {
    console.error('Self-post monitors POST error:', error);
    return NextResponse.json({
      error: 'Failed to create monitor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
