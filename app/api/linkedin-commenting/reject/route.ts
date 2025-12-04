import { createServerSupabaseClient } from '@/app/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/linkedin-commenting/reject?token=xxx
 * Reject a comment via email link (token-based auth, no login required)
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');

    if (!token) {
      return new NextResponse(renderHTML('error', 'Missing rejection token'), {
        status: 400,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    const supabase = await createServerSupabaseClient();

    // Call the reject function
    const { data, error } = await supabase.rpc('reject_comment_by_token', {
      p_token: token
    });

    if (error) {
      console.error('Error rejecting comment:', error);
      return new NextResponse(renderHTML('error', error.message), {
        status: 500,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    if (!data?.success) {
      return new NextResponse(renderHTML('error', data?.error || 'Unknown error'), {
        status: 400,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Return success page
    return new NextResponse(renderHTML('rejected'), {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new NextResponse(renderHTML('error', 'Internal server error'), {
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

function renderHTML(status: 'rejected' | 'error', message?: string): string {
  const colors = {
    rejected: { bg: '#ef4444', text: 'Comment Rejected' },
    error: { bg: '#f59e0b', text: 'Error' }
  };

  const config = colors[status];

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${config.text} - SAM Commenting Agent</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      padding: 20px;
    }
    .card {
      background: #1f2937;
      border-radius: 16px;
      padding: 40px;
      max-width: 500px;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      border: 1px solid #374151;
    }
    .icon {
      width: 80px;
      height: 80px;
      background: ${config.bg};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 40px;
    }
    h1 {
      color: white;
      margin: 0 0 16px;
      font-size: 28px;
    }
    p {
      color: #9ca3af;
      margin: 0;
      font-size: 16px;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${status === 'rejected' ? '✗' : '⚠'}</div>
    <h1>${config.text}</h1>
    ${status === 'rejected' ? `
      <p>This comment has been rejected and will not be posted to LinkedIn.</p>
    ` : `
      <p>${message || 'Something went wrong'}</p>
    `}
  </div>
</body>
</html>`;
}
