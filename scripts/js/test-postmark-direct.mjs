/**
 * Test Postmark Email Sending Directly
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const POSTMARK_TOKEN = process.env.POSTMARK_SERVER_TOKEN || process.env.POSTMARK_INNOVAREAI_API_KEY;

console.log('🔧 Postmark Token:', POSTMARK_TOKEN ? '✅ SET' : '❌ NOT SET');

if (!POSTMARK_TOKEN) {
  console.error('No Postmark token found!');
  process.exit(1);
}

// Dynamic import for postmark
const { ServerClient } = await import('postmark');
const postmark = new ServerClient(POSTMARK_TOKEN);

const testReplyId = 'test-' + Date.now();

try {
  console.log('\n📧 Sending test email to tl@innovareai.com...');

  const result = await postmark.sendEmail({
    From: 'Sam <hello@sam.innovareai.com>',
    To: 'tl@innovareai.com',
    ReplyTo: `draft+${testReplyId}@sam.innovareai.com`,
    Subject: `🟢 TEST: Stan Bounev replied on LinkedIn - interested`,
    HtmlBody: `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#0077B5;color:white;padding:20px;border-radius:8px 8px 0 0;">
          <h2 style="margin:0;">💼 LinkedIn Reply - INTERESTED</h2>
        </div>

        <div style="background:#f9f9f9;padding:20px;border:1px solid #e0e0e0;border-top:none;">
          <p style="font-size:16px;margin:0 0 10px 0;">Hi Thorsten,</p>

          <p style="font-size:14px;margin:10px 0;">
            <strong>Stan Bounev</strong> from <strong>BlueLabel</strong> replied on LinkedIn:
          </p>

          <blockquote style="border-left:4px solid #0077B5;padding:15px;margin:20px 0;background:white;border-radius:4px;color:#333;">
            This looks interesting! We've been evaluating different outbound tools. How does SAM compare to Apollo and Outreach in terms of personalization?
          </blockquote>

          <div style="background:#fff;padding:15px;border-radius:4px;margin:20px 0;border-left:4px solid #22c55e;">
            <p style="margin:0 0 5px 0;font-size:12px;color:#666;">Detected Intent:</p>
            <p style="margin:0;font-size:14px;font-weight:600;">
              🟢 INTERESTED
              <span style="font-weight:normal;color:#666;"> (95% confidence)</span>
            </p>
          </div>

          <hr style="border:none;border-top:2px solid #0077B5;margin:30px 0;">

          <p style="font-size:16px;margin:20px 0 10px 0;font-weight:600;">My suggested reply:</p>

          <div style="background:white;padding:20px;border-radius:4px;border:1px solid #ddd;margin:20px 0;font-family:inherit;">
            Hey Stan,<br><br>
            SAM's personalization is fundamentally different. While Apollo and Outreach use merge fields and templates, we use AI to write unique messages for each prospect based on their LinkedIn profile, company website, and recent activity.<br><br>
            Want to see how it works on your ICP? I can show you in 15 minutes.<br><br>
            -Sam
          </div>

          <div style="background:#fff3cd;padding:15px;border-radius:4px;border-left:4px solid #ffc107;margin:20px 0;">
            <p style="margin:0 0 10px 0;font-weight:600;">Reply to this email to respond:</p>
            <ul style="margin:0;padding-left:20px;">
              <li><strong>Type "APPROVE"</strong> - Send my draft via LinkedIn</li>
              <li><strong>Edit the message</strong> - Send your version</li>
              <li><strong>Type "REFUSE"</strong> - Don't send anything</li>
            </ul>
          </div>

          <p style="font-size:12px;color:#666;margin-top:30px;padding-top:20px;border-top:1px solid #e0e0e0;">
            <a href="https://app.meet-sam.com/replies/${testReplyId}">View in dashboard</a>
          </p>

          <p style="font-size:14px;margin-top:20px;">Sam</p>
        </div>
      </div>
    `,
    TextBody: `Hi Thorsten,

Stan Bounev from BlueLabel replied on LinkedIn:

"This looks interesting! We've been evaluating different outbound tools. How does SAM compare to Apollo and Outreach in terms of personalization?"

Intent: INTERESTED (95% confidence)

---
My suggested reply:

Hey Stan,

SAM's personalization is fundamentally different. While Apollo and Outreach use merge fields and templates, we use AI to write unique messages for each prospect based on their LinkedIn profile, company website, and recent activity.

Want to see how it works on your ICP? I can show you in 15 minutes.

-Sam

---
Reply to this email:
- Type "APPROVE" to send my draft via LinkedIn
- Edit the message to send your version
- Type "REFUSE" to not send anything

Sam`,
    MessageStream: 'outbound',
    Tag: 'linkedin-reply-notification-test',
    Metadata: {
      replyId: testReplyId,
      channel: 'linkedin',
      intent: 'interested',
      test: 'true'
    }
  });

  console.log('✅ Email sent successfully!');
  console.log(`   Message ID: ${result.MessageID}`);
  console.log(`   To: ${result.To}`);
  console.log(`   Submitted At: ${result.SubmittedAt}`);
  console.log('\n📬 Check your inbox at tl@innovareai.com!');

} catch (error) {
  console.error('❌ Failed to send email:', error.message);
  if (error.code) console.error('   Error code:', error.code);
  if (error.statusCode) console.error('   Status code:', error.statusCode);
}
