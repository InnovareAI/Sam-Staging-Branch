import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com';

/**
 * POST /api/linkedin-commenting/test-digest
 * Send a test digest email with sample data
 *
 * Body: { email: "test@example.com" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const testEmail = body.email;

    if (!testEmail) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    console.log(`📧 Sending test digest to ${testEmail}...`);

    // Sample posts for testing
    const samplePosts = [
      {
        id: 'test-1',
        post_url: 'https://www.linkedin.com/posts/example-1',
        post_text: 'Just deployed our new AI-powered Bitcoin mining optimization system. Seeing 15% efficiency gains by using waste heat for local greenhouses. The future of sustainable mining is here! 🌱⚡ #Bitcoin #Sustainability',
        author_name: 'Michael Chen',
        ai_comment: 'The heat reuse angle is genius - turning a perceived weakness (energy consumption) into a strength. Curious how the greenhouse operators view the partnership. Are they seeing cost savings on their end too?',
        approval_token: 'test-token-abc123'
      },
      {
        id: 'test-2',
        post_url: 'https://www.linkedin.com/posts/example-2',
        post_text: 'Proof of Work gets a bad rap, but here\'s what critics miss: it\'s the only consensus mechanism that converts real-world energy into immutable security. No amount of capital can rewrite Bitcoin\'s history.',
        author_name: 'Sarah Williams',
        ai_comment: 'This is exactly the framing shift we need. Energy isn\'t "wasted" - it\'s converted into the most secure settlement layer ever built. The thermodynamic argument for PoW is underrated.',
        approval_token: 'test-token-def456'
      },
      {
        id: 'test-3',
        post_url: 'https://www.linkedin.com/posts/example-3',
        post_text: 'Our hash rate just crossed 50 EH/s for the first time. What a journey from our first 10 ASIC operation in 2019. Team effort all the way.',
        author_name: 'David Park',
        ai_comment: 'Congrats on the milestone! That\'s 5000x growth in what, 5 years? Would love to hear about the infrastructure scaling challenges - especially on the cooling side.',
        approval_token: 'test-token-ghi789'
      }
    ];

    const emailHtml = buildTestDigestEmail(samplePosts);

    const result = await sendPostmarkEmail(
      testEmail,
      `🧪 [TEST] 3 LinkedIn Comments Ready for Review`,
      emailHtml
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Test digest sent to ${testEmail}`,
      posts_count: samplePosts.length
    });

  } catch (error) {
    console.error('Error sending test digest:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

function buildTestDigestEmail(posts: any[]): string {
  const postsHtml = posts.map((post, index) => {
    const postPreview = post.post_text.length > 200
      ? post.post_text.substring(0, 200) + '...'
      : post.post_text;

    // For test, use placeholder URLs
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
        <!-- Test Banner -->
        <table width="600" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
          <tr>
            <td style="background: #fbbf24; color: #78350f; padding: 12px; text-align: center; border-radius: 8px; font-weight: 600;">
              🧪 TEST EMAIL - This is a preview of the digest format
            </td>
          </tr>
        </table>

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
