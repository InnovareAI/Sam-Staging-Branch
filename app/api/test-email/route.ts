import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/postmark';

// POST /api/test-email - Test Postmark email sending functionality
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to } = body;

    if (!to) {
      return NextResponse.json({ error: 'Email address required' }, { status: 400 });
    }

    // Test email
    const emailResult = await sendEmail({
      to,
      subject: 'SAM AI - Test Email from Postmark',
      htmlBody: `
        <h2>🎉 Test Email Success!</h2>
        <p>This email was sent successfully from SAM AI using Postmark.</p>
        <p><strong>Configuration verified:</strong></p>
        <ul>
          <li>✅ Postmark API token is working</li>
          <li>✅ Email service is properly configured</li>
          <li>✅ SMTP delivery is functional</li>
        </ul>
        <p style="color: #6d28d9; font-weight: bold;">Your email system is ready! 🚀</p>
      `,
      textBody: `
SAM AI - Test Email Success!

This email was sent successfully from SAM AI using Postmark.

Configuration verified:
✅ Postmark API token is working
✅ Email service is properly configured  
✅ SMTP delivery is functional

Your email system is ready! 🚀
      `
    });

    return NextResponse.json({
      success: emailResult.success,
      messageId: emailResult.messageId,
      error: emailResult.error
    });

  } catch (error) {
    console.error('Test email error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}