import { createServerSupabaseClient } from '@/app/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || '792e0c09eeee1a229b78a6341739613177fad24f401b1c82f2673bbb9ee806a0';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com';

interface DiscoveredPost {
  id: string;
  post_url: string;
  post_text: string;
  author_name: string;
  ai_comment: string;
  approval_token: string;
  created_at: string;
}

/**
 * POST /api/cron/commenting-digest
 * Send daily digest emails to all workspaces with pending comments
 *
 * Query params:
 * - test_email: Send test digest to this email instead of workspace emails
 * - workspace_id: Only process this workspace (for testing)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const cronSecret = request.headers.get('x-cron-secret');
    if (cronSecret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const testEmail = request.nextUrl.searchParams.get('test_email');
    const testWorkspaceId = request.nextUrl.searchParams.get('workspace_id');

    console.log('📧 Starting commenting digest cron...');
    console.log(`🧪 Test mode: ${testEmail ? `sending to ${testEmail}` : 'OFF'}`);

    const supabase = await createServerSupabaseClient();

    // Get workspaces with pending comments and digest enabled
    let workspacesQuery = supabase
      .from('linkedin_brand_guidelines')
      .select('workspace_id, digest_email, digest_timezone')
      .eq('digest_enabled', true)
      .not('digest_email', 'is', null);

    if (testWorkspaceId) {
      workspacesQuery = workspacesQuery.eq('workspace_id', testWorkspaceId);
    }

    const { data: workspaces, error: wsError } = await workspacesQuery;

    if (wsError) {
      console.error('Error fetching workspaces:', wsError);
      return NextResponse.json({ error: wsError.message }, { status: 500 });
    }

    console.log(`📋 Found ${workspaces?.length || 0} workspaces with digest enabled`);

    let totalSent = 0;
    const results: { workspace_id: string; email: string; posts_count: number; success: boolean; error?: string }[] = [];

    for (const ws of workspaces || []) {
      try {
        // Get pending posts for this workspace
        const { data: posts, error: postsError } = await supabase
          .from('linkedin_posts_discovered')
          .select('id, post_url, post_text, author_name, ai_comment, approval_token, created_at')
          .eq('workspace_id', ws.workspace_id)
          .not('ai_comment', 'is', null)
          .eq('approval_status', 'pending')
          .is('digest_sent_at', null)
          .order('created_at', { ascending: false })
          .limit(25);

        if (postsError) {
          console.error(`Error fetching posts for ${ws.workspace_id}:`, postsError);
          results.push({ workspace_id: ws.workspace_id, email: ws.digest_email, posts_count: 0, success: false, error: postsError.message });
          continue;
        }

        if (!posts || posts.length === 0) {
          console.log(`📭 No pending posts for workspace ${ws.workspace_id}`);
          continue;
        }

        console.log(`📝 Found ${posts.length} pending posts for workspace ${ws.workspace_id}`);

        // Generate approval tokens for posts that don't have them
        for (const post of posts) {
          if (!post.approval_token) {
            const { data: token } = await supabase.rpc('generate_approval_token');
            if (token) {
              await supabase
                .from('linkedin_posts_discovered')
                .update({ approval_token: token })
                .eq('id', post.id);
              post.approval_token = token;
            }
          }
        }

        // Build and send email
        const recipientEmail = testEmail || ws.digest_email;
        const emailHtml = buildDigestEmail(posts as DiscoveredPost[], ws.workspace_id);

        const sendResult = await sendPostmarkEmail(
          recipientEmail,
          `🗨️ ${posts.length} LinkedIn Comment${posts.length > 1 ? 's' : ''} Ready for Review`,
          emailHtml
        );

        if (sendResult.success) {
          // Mark posts as digest sent
          const postIds = posts.map(p => p.id);
          await supabase
            .from('linkedin_posts_discovered')
            .update({ digest_sent_at: new Date().toISOString() })
            .in('id', postIds);

          // Update last_digest_sent_at
          await supabase
            .from('linkedin_brand_guidelines')
            .update({ last_digest_sent_at: new Date().toISOString() })
            .eq('workspace_id', ws.workspace_id);

          totalSent++;
          results.push({ workspace_id: ws.workspace_id, email: recipientEmail, posts_count: posts.length, success: true });
          console.log(`✅ Sent digest to ${recipientEmail} with ${posts.length} posts`);
        } else {
          results.push({ workspace_id: ws.workspace_id, email: recipientEmail, posts_count: posts.length, success: false, error: sendResult.error });
          console.error(`❌ Failed to send digest to ${recipientEmail}:`, sendResult.error);
        }

      } catch (error) {
        console.error(`Error processing workspace ${ws.workspace_id}:`, error);
        results.push({
          workspace_id: ws.workspace_id,
          email: ws.digest_email,
          posts_count: 0,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return NextResponse.json({
      success: true,
      digests_sent: totalSent,
      results
    });

  } catch (error) {
    console.error('Unexpected error in digest cron:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

function buildDigestEmail(posts: DiscoveredPost[], workspaceId: string): string {
  const postsHtml = posts.map((post, index) => {
    // Truncate post text for preview
    const postPreview = post.post_text.length > 200
      ? post.post_text.substring(0, 200) + '...'
      : post.post_text;

    const approveUrl = `${APP_URL}/api/linkedin-commenting/approve?token=${post.approval_token}`;
    const rejectUrl = `${APP_URL}/api/linkedin-commenting/reject?token=${post.approval_token}`;

    return `
      <tr>
        <td style="padding: 24px; border-bottom: 1px solid #374151;">
          <!-- Post Header -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <span style="color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Post ${index + 1} of ${posts.length}</span>
              </td>
              <td align="right">
                <a href="${post.post_url}" style="color: #ec4899; text-decoration: none; font-size: 12px;">View on LinkedIn →</a>
              </td>
            </tr>
          </table>

          <!-- Author -->
          <p style="margin: 12px 0 8px; color: #f3f4f6; font-weight: 600; font-size: 16px;">
            ${post.author_name || 'LinkedIn User'}
          </p>

          <!-- Post Preview -->
          <div style="background: #1f2937; border-radius: 8px; padding: 16px; margin: 12px 0;">
            <p style="margin: 0; color: #d1d5db; font-size: 14px; line-height: 1.6;">
              "${postPreview}"
            </p>
          </div>

          <!-- AI Comment -->
          <p style="margin: 16px 0 8px; color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
            Suggested Comment:
          </p>
          <div style="background: linear-gradient(135deg, #831843 0%, #6b21a8 100%); border-radius: 8px; padding: 16px; margin: 0 0 16px;">
            <p style="margin: 0; color: #fce7f3; font-size: 14px; line-height: 1.6; font-style: italic;">
              "${post.ai_comment}"
            </p>
          </div>

          <!-- Action Buttons -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="48%" align="center">
                <a href="${approveUrl}" style="display: inline-block; width: 100%; padding: 14px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; text-align: center; box-sizing: border-box;">
                  ✓ Approve & Post
                </a>
              </td>
              <td width="4%"></td>
              <td width="48%" align="center">
                <a href="${rejectUrl}" style="display: inline-block; width: 100%; padding: 14px 24px; background: #374151; color: #9ca3af; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; text-align: center; box-sizing: border-box; border: 1px solid #4b5563;">
                  ✗ Skip
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>LinkedIn Comments Ready for Review</title>
</head>
<body style="margin: 0; padding: 0; background: #111827; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #111827; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: #1f2937; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 700;">
                🗨️ Comments Ready for Review
              </h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">
                ${posts.length} AI-generated comment${posts.length > 1 ? 's' : ''} awaiting your approval
              </p>
            </td>
          </tr>

          <!-- Posts -->
          ${postsHtml}

          <!-- Footer -->
          <tr>
            <td style="padding: 24px; text-align: center; border-top: 1px solid #374151;">
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px;">
                Powered by SAM AI Commenting Agent
              </p>
              <p style="margin: 0; color: #4b5563; font-size: 11px;">
                To unsubscribe, update your settings in the SAM dashboard
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendPostmarkEmail(to: string, subject: string, htmlBody: string): Promise<{ success: boolean; error?: string }> {
  const POSTMARK_TOKEN = process.env.POSTMARK_SERVER_TOKEN || process.env.POSTMARK_INNOVAREAI_API_KEY;
  const FROM_EMAIL = process.env.POSTMARK_FROM_EMAIL || 'sp@innovareai.com';
  const FROM_NAME = process.env.POSTMARK_FROM_NAME || 'Sam';

  if (!POSTMARK_TOKEN) {
    return { success: false, error: 'POSTMARK_SERVER_TOKEN not configured' };
  }

  try {
    const response = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': POSTMARK_TOKEN
      },
      body: JSON.stringify({
        From: `${FROM_NAME} <${FROM_EMAIL}>`,
        To: to,
        Subject: subject,
        HtmlBody: htmlBody,
        MessageStream: 'outbound'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.Message || `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
