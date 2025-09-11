import { NextRequest, NextResponse } from 'next/server';
import * as postmark from 'postmark';

// Company configurations
const COMPANY_CONFIG = {
  InnovareAI: {
    postmarkApiKey: process.env.POSTMARK_INNOVAREAI_API_KEY,
    fromEmail: 'sp@innovareai.com', // Sarah Powell
    companyName: 'InnovareAI',
    contactEmail: 'sp@innovareai.com',
    contactName: 'Sarah Powell'
  },
  '3cubedai': {
    postmarkApiKey: process.env.POSTMARK_3CUBEDAI_API_KEY,
    fromEmail: 'sophia@3cubed.ai', // Sophia
    companyName: '3CubedAI',
    contactEmail: 'sophia@3cubed.ai',
    contactName: 'Sophia'
  }
};

export async function POST(request: NextRequest) {
  try {
    const { testEmail = 'tl@innovareai.com' } = await request.json();
    
    const results = [];
    
    // Test both company email configurations
    for (const [companyKey, config] of Object.entries(COMPANY_CONFIG)) {
      try {
        if (!config.postmarkApiKey) {
          results.push({
            company: config.companyName,
            status: 'error',
            message: 'Missing Postmark API key'
          });
          continue;
        }

        const postmarkClient = new postmark.ServerClient(config.postmarkApiKey);
        
        const testResult = await postmarkClient.sendEmail({
          From: config.fromEmail,
          To: testEmail,
          Subject: `🧪 Test Email from ${config.companyName} - SAM AI Platform`,
          HtmlBody: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #7c3aed; text-align: center;">✅ Email Test Successful!</h1>
              
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h2 style="color: #1f2937; margin-top: 0;">Company Configuration</h2>
                <ul style="color: #374151;">
                  <li><strong>Company:</strong> ${config.companyName}</li>
                  <li><strong>From Email:</strong> ${config.fromEmail}</li>
                  <li><strong>Contact Person:</strong> ${config.contactName}</li>
                  <li><strong>Contact Email:</strong> ${config.contactEmail}</li>
                  <li><strong>Test Time:</strong> ${new Date().toISOString()}</li>
                </ul>
              </div>
              
              <div style="background-color: #ecfdf5; border: 1px solid #10b981; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="color: #065f46; margin: 0;">
                  <strong>✅ Success:</strong> This email was successfully sent using the ${config.companyName} Postmark configuration.
                </p>
              </div>
              
              <h3 style="color: #1f2937;">What this test verifies:</h3>
              <ul style="color: #374151;">
                <li>Postmark API key is valid and active</li>
                <li>Sender email domain is verified</li>
                <li>Email delivery is working</li>
                <li>Company-specific branding is configured correctly</li>
              </ul>
              
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
              
              <p style="color: #6b7280; font-size: 14px; text-align: center;">
                This is an automated test email from the SAM AI Platform.<br>
                Company: ${config.companyName} | Time: ${new Date().toLocaleString()}
              </p>
            </div>
          `,
          TextBody: `
🧪 Test Email from ${config.companyName} - SAM AI Platform

✅ Email Test Successful!

Company Configuration:
- Company: ${config.companyName}
- From Email: ${config.fromEmail}
- Contact Person: ${config.contactName}
- Contact Email: ${config.contactEmail}
- Test Time: ${new Date().toISOString()}

✅ Success: This email was successfully sent using the ${config.companyName} Postmark configuration.

What this test verifies:
- Postmark API key is valid and active
- Sender email domain is verified
- Email delivery is working
- Company-specific branding is configured correctly

This is an automated test email from the SAM AI Platform.
Company: ${config.companyName} | Time: ${new Date().toLocaleString()}
          `
        });

        results.push({
          company: config.companyName,
          status: 'success',
          messageId: testResult.MessageID,
          message: `Test email sent successfully from ${config.fromEmail}`
        });

      } catch (error: any) {
        results.push({
          company: config.companyName,
          status: 'error',
          message: error.message || 'Failed to send test email'
        });
      }
    }

    // Summary result
    const successCount = results.filter(r => r.status === 'success').length;
    const totalCount = results.length;

    return NextResponse.json({
      success: successCount === totalCount,
      message: `Test completed: ${successCount}/${totalCount} emails sent successfully`,
      testEmail,
      timestamp: new Date().toISOString(),
      results
    });

  } catch (error) {
    console.error('Test email error:', error);
    return NextResponse.json(
      { error: 'Failed to send test emails' },
      { status: 500 }
    );
  }
}