import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

// Create Supabase admin client for generating reset tokens
const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Function to determine sender based on user affiliation
function getSenderByAffiliation(userEmail: string): string {
  // Debug logging
  console.log('🔍 GENERAL ROUTE - Checking sender affiliation for:', userEmail);
  
  // Check if user belongs to 3cubed or sendingcell.com
  if (userEmail.includes('3cubed') || userEmail.includes('cubedcapital') || userEmail.includes('sendingcell.com')) {
    console.log('✅ GENERAL ROUTE - 3cubed affiliation detected, using Sophia Caldwell');
    return 'Sophia Caldwell <sophia@3cubed.ai>';
  }
  
  // Default to Sarah Powell for InnovareAI and other users
  console.log('✅ GENERAL ROUTE - InnovareAI affiliation, using Sarah Powell');
  return 'Sarah Powell <sp@innovareai.com>';
}

// Postmark email service
async function sendEmail(to: string, subject: string, htmlBody: string) {
  // Use the correct Postmark API key based on user affiliation
  const is3Cubed = to.includes('3cubed') || to.includes('cubedcapital') || to.includes('sendingcell.com');
  const postmarkApiKey = is3Cubed 
    ? process.env.POSTMARK_3CUBEDAI_API_KEY 
    : process.env.POSTMARK_INNOVAREAI_API_KEY;

  if (!postmarkApiKey) {
    throw new Error('Postmark not configured for this domain');
  }

  // Determine sender based on user affiliation
  const fromAddress = getSenderByAffiliation(to);

  const response = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': postmarkApiKey,
    },
    body: JSON.stringify({
      From: fromAddress,
      To: to,
      Subject: subject,
      HtmlBody: htmlBody,
      MessageStream: 'outbound'
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Email send failed: ${error}`);
  }

  return await response.json();
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    // Validate input
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    console.log('Sending password reset to:', email);

    // Check if user exists first
    const { data: users, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userError) {
      console.error('Error checking users:', userError);
    }
    
    const userExists = users?.users?.find((user: any) => user.email === email);
    
    if (!userExists) {
      // Still return success for security (don't reveal if email exists)
      return NextResponse.json({
        success: true,
        message: 'If this email exists in our system, you will receive a password reset link.'
      });
    }

    // Use Postmark for reliable email delivery
    const is3Cubed = email.includes('3cubed') || email.includes('cubedcapital') || email.includes('sendingcell.com');
    const postmarkApiKey = is3Cubed 
      ? process.env.POSTMARK_3CUBEDAI_API_KEY 
      : process.env.POSTMARK_INNOVAREAI_API_KEY;

    if (postmarkApiKey) {
      const currentSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://sam.innovareai.com';
      
      // Generate a password reset token using Supabase admin
      const { data, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: email,
        options: {
          redirectTo: `${currentSiteUrl}/reset-password`
        }
      });

      if (linkError) {
        console.error('Password reset generation error:', linkError);
        return NextResponse.json(
          { error: 'Unable to generate password reset. Please try again later.' },
          { status: 503 }
        );
      }

      // Use the Supabase-generated recovery link (contains actual token)
      const resetUrl = data.properties.action_link;
      
      const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Reset Your SAM AI Password</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .button { display: inline-block; padding: 12px 24px; background: #dc2626; color: white; text-decoration: none; border-radius: 6px; }
                .footer { margin-top: 30px; font-size: 14px; color: #666; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔑 Reset Your SAM AI Password</h1>
                </div>

                <p>Hi there,</p>

                <p>We received a request to <strong>reset your password</strong> for your SAM AI account (<strong>${email}</strong>).</p>

                <p>Click the button below to reset your password:</p>

                <p style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}" class="button">Reset My Password</a>
                </p>

                <p><small>If the button doesn't work, copy and paste this link:</small></p>
                <p style="word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px;">
                    ${resetUrl}
                </p>

                <p><em>This link will expire in 24 hours for security.</em></p>

                <p>If you didn't request this password reset, you can safely ignore this email.</p>

                <div class="footer">
                    <p>Best regards,<br><strong>The SAM AI Team</strong></p>
                    <p style="color: #999; font-size: 12px;">SAM AI - Your AI-powered Sales Agent Platform</p>
                </div>
            </div>
        </body>
        </html>
      `;

      await sendEmail(email, '🔑 Reset Your SAM AI Password', htmlBody);
      
      console.log('✅ Password reset email sent via Postmark successfully');
      return NextResponse.json({
        success: true,
        message: 'Password reset email sent! Check your email and click the link to reset your password.'
      });
    }

    // If Postmark is not configured
    return NextResponse.json(
      { error: 'Email service not configured. Please try again later.' },
      { status: 503 }
    );


  } catch (error) {
    console.error('Reset password API error:', error);
    return NextResponse.json(
      { error: 'Internal server error during password reset' },
      { status: 500 }
    );
  }
}

// Handle GET requests - redirect to main page
// Password reset is now handled via AuthModal on main page
export async function GET(request: NextRequest) {
  // Redirect to main page where AuthModal will handle password reset
  return NextResponse.redirect(new URL('/', request.url));
}