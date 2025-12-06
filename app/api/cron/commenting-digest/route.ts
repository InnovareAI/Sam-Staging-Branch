import { createServerSupabaseClient } from '@/app/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || '792e0c09eeee1a229b78a6341739613177fad24f401b1c82f2673bbb9ee806a0';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com';

interface DigestComment {
  id: string;
  comment_text: string;
  created_at: string;
  scheduled_post_time?: string;
  status: string;
  post: {
    id: string;
    share_url: string;
    post_content: string;
    author_name: string;
  };
}

interface WorkspaceSettings {
  workspace_id: string;
  digest_email: string;
  digest_timezone: string;
  auto_approve_enabled: boolean;
}

/**
 * POST /api/cron/commenting-digest
 * Send daily digest emails to all workspaces with digest enabled
 *
 * TWO MODES:
 * 1. APPROVAL MODE (auto_approve_enabled = false):
 *    - Sends pending_approval comments for user to approve/reject
 *
 * 2. PREVIEW MODE (auto_approve_enabled = true):
 *    - Sends preview of scheduled comments that will post today
 *    - No action needed from user, just informational
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

    // Get workspaces with digest enabled (include auto_approve_enabled for mode detection)
    let workspacesQuery = supabase
      .from('linkedin_brand_guidelines')
      .select('workspace_id, digest_email, digest_timezone, auto_approve_enabled')
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
    const results: { workspace_id: string; email: string; posts_count: number; mode: string; success: boolean; error?: string }[] = [];

    for (const ws of (workspaces || []) as WorkspaceSettings[]) {
      try {
        const isAutoApprove = ws.auto_approve_enabled === true;
        const mode = isAutoApprove ? 'preview' : 'approval';

        console.log(`\n📋 Processing workspace ${ws.workspace_id} (mode: ${mode})`);

        // Fetch comments based on mode
        let comments: DigestComment[] = [];

        if (isAutoApprove) {
          // PREVIEW MODE: Get scheduled comments that will post today
          // These are auto-approved and waiting to be posted during business hours
          const { data: scheduledComments, error: scheduledError } = await supabase
            .from('linkedin_post_comments')
            .select(`
              id,
              comment_text,
              created_at,
              scheduled_post_time,
              status,
              post:linkedin_posts_discovered!inner (
                id,
                share_url,
                post_content,
                author_name
              )
            `)
            .eq('workspace_id', ws.workspace_id)
            .eq('status', 'scheduled')
            .order('scheduled_post_time', { ascending: true })
            .limit(25);

          if (scheduledError) {
            console.error(`Error fetching scheduled comments for ${ws.workspace_id}:`, scheduledError);
            results.push({ workspace_id: ws.workspace_id, email: ws.digest_email, posts_count: 0, mode, success: false, error: scheduledError.message });
            continue;
          }

          comments = (scheduledComments || []) as DigestComment[];
          console.log(`📅 Found ${comments.length} scheduled comments for preview`);
        } else {
          // APPROVAL MODE: Get pending_approval comments that need user action
          const { data: pendingComments, error: pendingError } = await supabase
            .from('linkedin_post_comments')
            .select(`
              id,
              comment_text,
              created_at,
              status,
              post:linkedin_posts_discovered!inner (
                id,
                share_url,
                post_content,
                author_name
              )
            `)
            .eq('workspace_id', ws.workspace_id)
            .eq('status', 'pending_approval')
            .order('created_at', { ascending: false })
            .limit(25);

          if (pendingError) {
            console.error(`Error fetching pending comments for ${ws.workspace_id}:`, pendingError);
            results.push({ workspace_id: ws.workspace_id, email: ws.digest_email, posts_count: 0, mode, success: false, error: pendingError.message });
            continue;
          }

          comments = (pendingComments || []) as DigestComment[];
          console.log(`📝 Found ${comments.length} pending comments for approval`);
        }

        if (comments.length === 0) {
          console.log(`📭 No comments for workspace ${ws.workspace_id}`);
          continue;
        }

        // Build and send email based on mode
        const recipientEmail = testEmail || ws.digest_email;
        const emailHtml = isAutoApprove
          ? buildPreviewDigestEmail(comments, ws.workspace_id, ws.digest_timezone)
          : buildApprovalDigestEmail(comments, ws.workspace_id);

        const subject = isAutoApprove
          ? `📅 ${comments.length} LinkedIn Comment${comments.length > 1 ? 's' : ''} Scheduled for Today`
          : `🗨️ ${comments.length} LinkedIn Comment${comments.length > 1 ? 's' : ''} Ready for Review`;

        const sendResult = await sendPostmarkEmail(recipientEmail, subject, emailHtml);

        if (sendResult.success) {
          await supabase
            .from('linkedin_brand_guidelines')
            .update({ last_digest_sent_at: new Date().toISOString() })
            .eq('workspace_id', ws.workspace_id);

          totalSent++;
          results.push({ workspace_id: ws.workspace_id, email: recipientEmail, posts_count: comments.length, mode, success: true });
          console.log(`✅ Sent ${mode} digest to ${recipientEmail} with ${comments.length} comments`);
        } else {
          results.push({ workspace_id: ws.workspace_id, email: recipientEmail, posts_count: comments.length, mode, success: false, error: sendResult.error });
          console.error(`❌ Failed to send digest to ${recipientEmail}:`, sendResult.error);
        }

      } catch (error) {
        console.error(`Error processing workspace ${ws.workspace_id}:`, error);
        results.push({
          workspace_id: ws.workspace_id,
          email: ws.digest_email,
          posts_count: 0,
          mode: 'unknown',
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

/**
 * Build APPROVAL digest email - for users who need to approve/reject comments
 */
function buildApprovalDigestEmail(comments: DigestComment[], workspaceId: string): string {
  const commentsHtml = comments.map((comment, index) => {
    // Truncate post text for preview
    const postContent = comment.post?.post_content || '';
    const postPreview = postContent.length > 200
      ? postContent.substring(0, 200) + '...'
      : postContent;

    const approveUrl = `${APP_URL}/api/linkedin-commenting/comments/${comment.id}/approve`;
    const rejectUrl = `${APP_URL}/api/linkedin-commenting/comments/${comment.id}/reject`;
    const feedbackGoodUrl = `${APP_URL}/api/linkedin-commenting/comments/${comment.id}/feedback?rating=good`;
    const feedbackBadUrl = `${APP_URL}/api/linkedin-commenting/comments/${comment.id}/feedback?rating=bad`;

    return `
      <tr>
        <td style="padding: 24px; border-bottom: 1px solid #374151;">
          <!-- Post Header -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <span style="color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Comment ${index + 1} of ${comments.length}</span>
              </td>
              <td align="right">
                <a href="${comment.post?.share_url || '#'}" style="color: #ec4899; text-decoration: none; font-size: 12px;">View on LinkedIn →</a>
              </td>
            </tr>
          </table>

          <!-- Author -->
          <p style="margin: 12px 0 8px; color: #f3f4f6; font-weight: 600; font-size: 16px;">
            ${comment.post?.author_name || 'LinkedIn User'}
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
              "${comment.comment_text}"
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

          <!-- Feedback Buttons (Help SAM Learn) -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 12px;">
            <tr>
              <td align="center">
                <span style="color: #6b7280; font-size: 11px;">Help SAM improve: </span>
                <a href="${feedbackGoodUrl}" style="color: #10b981; text-decoration: none; font-size: 11px; margin-left: 8px;">👍 Good comment</a>
                <span style="color: #4b5563; margin: 0 8px;">|</span>
                <a href="${feedbackBadUrl}" style="color: #ef4444; text-decoration: none; font-size: 11px;">👎 Needs improvement</a>
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
                ${comments.length} AI-generated comment${comments.length > 1 ? 's' : ''} awaiting your approval
              </p>
            </td>
          </tr>

          <!-- Comments -->
          ${commentsHtml}

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

/**
 * Build PREVIEW digest email - for auto-approve users to see what will post today
 * No action buttons needed, just informational with optional cancel links
 */
function buildPreviewDigestEmail(comments: DigestComment[], workspaceId: string, timezone: string): string {
  const commentsHtml = comments.map((comment, index) => {
    // Truncate post text for preview
    const postContent = comment.post?.post_content || '';
    const postPreview = postContent.length > 200
      ? postContent.substring(0, 200) + '...'
      : postContent;

    // Format scheduled time
    const scheduledTime = comment.scheduled_post_time
      ? new Date(comment.scheduled_post_time).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: timezone || 'America/Los_Angeles'
        })
      : 'Soon';

    const cancelUrl = `${APP_URL}/api/linkedin-commenting/comments/${comment.id}/reject`;
    const feedbackGoodUrl = `${APP_URL}/api/linkedin-commenting/comments/${comment.id}/feedback?rating=good`;
    const feedbackBadUrl = `${APP_URL}/api/linkedin-commenting/comments/${comment.id}/feedback?rating=bad`;

    return `
      <tr>
        <td style="padding: 24px; border-bottom: 1px solid #374151;">
          <!-- Post Header -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <span style="color: #10b981; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
                  📅 Posting at ${scheduledTime}
                </span>
              </td>
              <td align="right">
                <a href="${comment.post?.share_url || '#'}" style="color: #ec4899; text-decoration: none; font-size: 12px;">View on LinkedIn →</a>
              </td>
            </tr>
          </table>

          <!-- Author -->
          <p style="margin: 12px 0 8px; color: #f3f4f6; font-weight: 600; font-size: 16px;">
            ${comment.post?.author_name || 'LinkedIn User'}
          </p>

          <!-- Post Preview -->
          <div style="background: #1f2937; border-radius: 8px; padding: 16px; margin: 12px 0;">
            <p style="margin: 0; color: #d1d5db; font-size: 14px; line-height: 1.6;">
              "${postPreview}"
            </p>
          </div>

          <!-- AI Comment -->
          <p style="margin: 16px 0 8px; color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
            Comment to be posted:
          </p>
          <div style="background: linear-gradient(135deg, #065f46 0%, #047857 100%); border-radius: 8px; padding: 16px; margin: 0 0 16px;">
            <p style="margin: 0; color: #d1fae5; font-size: 14px; line-height: 1.6; font-style: italic;">
              "${comment.comment_text}"
            </p>
          </div>

          <!-- Action Row - Cancel + Feedback -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="left">
                <a href="${cancelUrl}" style="color: #ef4444; text-decoration: none; font-size: 12px;">✗ Cancel this comment</a>
              </td>
              <td align="right">
                <span style="color: #6b7280; font-size: 11px;">Rate: </span>
                <a href="${feedbackGoodUrl}" style="color: #10b981; text-decoration: none; font-size: 11px; margin-left: 4px;">👍</a>
                <a href="${feedbackBadUrl}" style="color: #ef4444; text-decoration: none; font-size: 11px; margin-left: 8px;">👎</a>
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
  <title>Today's LinkedIn Comments Preview</title>
</head>
<body style="margin: 0; padding: 0; background: #111827; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #111827; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: #1f2937; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #047857 0%, #10b981 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 700;">
                📅 Today's LinkedIn Comments
              </h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">
                ${comments.length} comment${comments.length > 1 ? 's' : ''} scheduled to post during business hours
              </p>
            </td>
          </tr>

          <!-- Info Banner -->
          <tr>
            <td style="background: #065f46; padding: 16px 24px;">
              <p style="margin: 0; color: #d1fae5; font-size: 13px; text-align: center;">
                ✅ Auto-approve is ON — these comments will post automatically between 9 AM and 6 PM
              </p>
            </td>
          </tr>

          <!-- Comments -->
          ${commentsHtml}

          <!-- Footer -->
          <tr>
            <td style="padding: 24px; text-align: center; border-top: 1px solid #374151;">
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px;">
                Powered by SAM AI Commenting Agent
              </p>
              <p style="margin: 0; color: #4b5563; font-size: 11px;">
                To change to manual approval mode, update your settings in the SAM dashboard
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
