import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Client } from 'postmark';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: cookies });
    
    const { userEmail, company } = await request.json();
    
    if (!userEmail || !company) {
      return NextResponse.json(
        { error: 'userEmail and company are required' },
        { status: 400 }
      );
    }

    console.log('🧪 TEST: Sending invitation email to:', userEmail, 'from company:', company);

    // Determine which Postmark API key to use based on company
    const postmarkApiKey = company === '3cubedai' 
      ? process.env.POSTMARK_3CUBEDAI_API_KEY 
      : process.env.POSTMARK_INNOVAREAI_API_KEY;
    
    if (!postmarkApiKey) {
      return NextResponse.json(
        { error: `Postmark API key not configured for company: ${company}` },
        { status: 500 }
      );
    }

    const postmarkClient = new Client(postmarkApiKey);

    // Determine sender details based on company
    const senderInfo = company === '3cubedai' 
      ? {
          from: 'sophia@3cubed.ai',
          fromName: 'Sophia - 3CubedAI',
          companyName: '3CubedAI'
        }
      : {
          from: 'sp@innovareai.com',
          fromName: 'Sarah Powell - InnovareAI',
          companyName: 'InnovareAI'
        };

    // Generate a secure invitation token (simplified for testing)
    const invitationToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    // Create invitation link (simplified)
    const invitationLink = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com'}/accept-invitation?token=${invitationToken}`;

    const emailTemplate = {
      From: `${senderInfo.fromName} <${senderInfo.from}>`,
      To: userEmail,
      Subject: `Welcome to SAM AI - ${senderInfo.companyName}`,
      HtmlBody: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to SAM AI</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa; }
            .card { background: white; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 32px; }
            .logo { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin: 0 auto 16px; display: block; }
            .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 24px 0; }
            .footer { text-align: center; margin-top: 32px; font-size: 14px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="card">
              <div class="header">
                <img src="https://app.meet-sam.com/SAM.jpg" alt="SAM AI" class="logo">
                <h1>Welcome to SAM AI!</h1>
                <p>You've been invited to join ${senderInfo.companyName}'s Sales Assistant Platform</p>
              </div>
              
              <div class="content">
                <h2>🎉 Your SAM AI Account is Ready!</h2>
                <p>Hi there!</p>
                <p>You've been invited to join <strong>${senderInfo.companyName}</strong> on the SAM AI platform. SAM is your intelligent sales assistant that helps streamline your sales processes and boost productivity.</p>
                
                <p><strong>What you can do with SAM AI:</strong></p>
                <ul>
                  <li>💬 Chat with SAM for sales insights and recommendations</li>
                  <li>📊 Access your personalized sales dashboard</li>
                  <li>🎯 Manage leads and track your sales pipeline</li>
                  <li>📚 Build and access your team's knowledge base</li>
                  <li>🚀 Launch targeted sales campaigns</li>
                </ul>
                
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${invitationLink}" class="button">Accept Invitation & Get Started</a>
                </div>
                
                <p><small>This invitation link will expire in 7 days. If you have any questions, please contact your team administrator.</small></p>
              </div>
              
              <div class="footer">
                <p>Best regards,<br>
                <strong>${senderInfo.fromName}</strong><br>
                ${senderInfo.companyName}</p>
                <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
                <p><small>This email was sent from SAM AI Platform. If you believe this was sent in error, please ignore this email.</small></p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      TextBody: `
Welcome to SAM AI - ${senderInfo.companyName}!

You've been invited to join ${senderInfo.companyName} on the SAM AI platform.

Accept your invitation: ${invitationLink}

What you can do with SAM AI:
- Chat with SAM for sales insights and recommendations
- Access your personalized sales dashboard  
- Manage leads and track your sales pipeline
- Build and access your team's knowledge base
- Launch targeted sales campaigns

This invitation link will expire in 7 days.

Best regards,
${senderInfo.fromName}
${senderInfo.companyName}
      `,
      MessageStream: 'outbound',
      Tag: 'sam-ai-invitation'
    };

    console.log('📧 Sending test invitation email via Postmark...');
    console.log('📧 Email details:', {
      from: emailTemplate.From,
      to: emailTemplate.To,
      subject: emailTemplate.Subject,
      company: company,
      apiKey: postmarkApiKey ? 'configured' : 'missing'
    });

    const emailResult = await postmarkClient.sendEmail(emailTemplate);
    
    console.log('✅ Test invitation email sent successfully!', emailResult);

    return NextResponse.json({
      success: true,
      message: 'Test invitation email sent successfully',
      emailResult: {
        messageId: emailResult.MessageID,
        to: emailResult.To,
        submittedAt: emailResult.SubmittedAt
      }
    });

  } catch (error: any) {
    console.error('❌ Test email send error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send test invitation email',
        details: error.message,
        code: error.code || 'UNKNOWN_ERROR'
      },
      { status: 500 }
    );
  }
}

// Handle GET requests with a simple form for testing
export async function GET() {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Invitation Email Sender</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-900 min-h-screen flex items-center justify-center">
    <div class="max-w-md w-full mx-auto bg-gray-800 rounded-lg shadow-xl p-8">
        <div class="text-center mb-8">
            <h1 class="text-2xl font-bold text-white mb-2">🧪 Test Invitation Email</h1>
            <p class="text-gray-400">Send invitation email to already created users</p>
        </div>
        
        <form id="email-form" class="space-y-6">
            <div>
                <label for="userEmail" class="block text-sm font-medium text-gray-300 mb-2">User Email</label>
                <input 
                    type="email" 
                    id="userEmail" 
                    name="userEmail"
                    required
                    value="tl@3cubed.ai"
                    class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="user@company.com"
                >
            </div>
            
            <div>
                <label for="company" class="block text-sm font-medium text-gray-300 mb-2">Company</label>
                <select 
                    id="company" 
                    name="company"
                    required
                    class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                    <option value="">Select Company</option>
                    <option value="InnovareAI">InnovareAI</option>
                    <option value="3cubedai" selected>3CubedAI</option>
                </select>
            </div>
            
            <button 
                type="submit"
                class="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
                Send Test Email
            </button>
        </form>
        
        <div id="result" class="mt-6 hidden"></div>
    </div>
    
    <script>
        document.getElementById('email-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const userEmail = document.getElementById('userEmail').value;
            const company = document.getElementById('company').value;
            const resultDiv = document.getElementById('result');
            
            try {
                const response = await fetch('/api/test/send-invitation-email', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ userEmail, company })
                });
                
                const data = await response.json();
                
                resultDiv.className = 'mt-6 p-4 rounded-lg';
                
                if (response.ok) {
                    resultDiv.className += ' bg-green-600 text-white';
                    resultDiv.innerHTML = \`
                        <h3 class="font-bold">✅ Success!</h3>
                        <p>\${data.message}</p>
                        <p class="text-sm mt-2">Message ID: \${data.emailResult?.messageId}</p>
                    \`;
                } else {
                    resultDiv.className += ' bg-red-600 text-white';
                    resultDiv.innerHTML = \`
                        <h3 class="font-bold">❌ Error</h3>
                        <p>\${data.error}</p>
                        \${data.details ? \`<p class="text-sm mt-2">Details: \${data.details}</p>\` : ''}
                    \`;
                }
                
                resultDiv.classList.remove('hidden');
                
            } catch (error) {
                resultDiv.className = 'mt-6 p-4 bg-red-600 text-white rounded-lg';
                resultDiv.innerHTML = \`
                    <h3 class="font-bold">❌ Network Error</h3>
                    <p>Failed to send request: \${error.message}</p>
                \`;
                resultDiv.classList.remove('hidden');
            }
        });
    </script>
</body>
</html>
  `;
  
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}