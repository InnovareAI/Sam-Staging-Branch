import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// HTML response template for email clicks
function htmlResponse(title: string, message: string, success: boolean): Response {
  const bgColor = success ? '#6b7280' : '#ef4444';
  const icon = success ? '✓' : '✗';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 40px 20px;
      background: #111827;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #1f2937;
      border-radius: 16px;
      padding: 40px;
      max-width: 400px;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .icon {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: ${bgColor};
      color: white;
      font-size: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }
    h1 {
      color: #f3f4f6;
      font-size: 24px;
      margin: 0 0 12px;
    }
    p {
      color: #9ca3af;
      font-size: 16px;
      margin: 0 0 24px;
      line-height: 1.5;
    }
    .close-link {
      color: #ec4899;
      text-decoration: none;
      font-size: 14px;
    }
    .close-link:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="https://app.meet-sam.com" class="close-link">Go to SAM Dashboard →</a>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: success ? 200 : 400,
    headers: { 'Content-Type': 'text/html' }
  });
}

// GET handler for email link clicks
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: commentId } = await params;
    // Update the comment status in linkedin_post_comments table
    const { data, error } = await supabase
      .from('linkedin_post_comments')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString()
      })
      .eq('id', commentId)
      .select('id, post_id, workspace_id')
      .single();

    if (error) {
      console.error('Error rejecting comment:', error);
      return htmlResponse(
        'Action Failed',
        'We couldn\'t find this comment or it may have already been processed.',
        false
      );
    }

    // Mark the post as skipped so we don't regenerate for same post
    if (data?.post_id) {
      await supabase
        .from('linkedin_posts_discovered')
        .update({ status: 'skipped', updated_at: new Date().toISOString() })
        .eq('id', data.post_id);
    }

    // If pending count is low, trigger background discovery
    if (data?.workspace_id) {
      const { count: pendingCount } = await supabase
        .from('linkedin_post_comments')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', data.workspace_id)
        .eq('status', 'pending_approval');

      if ((pendingCount || 0) < 5) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com';
        fetch(`${baseUrl}/api/linkedin-commenting/discover-posts-hashtag`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-cron-secret': process.env.CRON_SECRET || ''
          }
        }).catch(() => {});
      }
    }

    return htmlResponse(
      'Comment Skipped',
      'This comment has been skipped and won\'t be posted.',
      true
    );

  } catch (error) {
    console.error('Error in reject endpoint:', error);
    return htmlResponse(
      'Something Went Wrong',
      'Please try again or contact support.',
      false
    );
  }
}

// POST handler for API calls
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: commentId } = await params;

    const { data, error } = await supabase
      .from('linkedin_post_comments')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString()
      })
      .eq('id', commentId)
      .select()
      .single();

    if (error) {
      console.error('Error rejecting comment:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      comment: data,
      message: 'Comment rejected'
    });

  } catch (error) {
    console.error('Error in reject endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to reject comment' },
      { status: 500 }
    );
  }
}
