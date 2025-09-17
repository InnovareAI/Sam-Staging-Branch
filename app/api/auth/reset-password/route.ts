import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase admin client for generating reset tokens
const supabaseAdmin = createClient(
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
    return 'Sophia Caldwell <sophia@innovareai.com>';
  }
  
  // Default to Sarah Powell for InnovareAI and other users
  console.log('✅ GENERAL ROUTE - InnovareAI affiliation, using Sarah Powell');
  return 'Sarah Powell <sarah@innovareai.com>';
}

// Postmark email service
async function sendEmail(to: string, subject: string, htmlBody: string) {
  if (!process.env.POSTMARK_SERVER_TOKEN) {
    throw new Error('Postmark not configured');
  }

  // Determine sender based on user affiliation
  const fromAddress = getSenderByAffiliation(to);

  const response = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Postmark-Server-Token': process.env.POSTMARK_SERVER_TOKEN,
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
    if (process.env.POSTMARK_SERVER_TOKEN) {
      const currentSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com';
      
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

      // Don't use Supabase links - create our own reset page link
      const resetUrl = `${currentSiteUrl}/reset-password?email=${encodeURIComponent(email)}&recovery=true`;
      
      const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Your SAM AI Magic Link</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .button { display: inline-block; padding: 12px 24px; background: #7c3aed; color: white; text-decoration: none; border-radius: 6px; }
                .footer { margin-top: 30px; font-size: 14px; color: #666; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>✨ Your SAM AI Magic Link</h1>
                </div>
                
                <p>Hi there,</p>
                
                <p>We received a request to reset your password for your SAM AI account (<strong>${email}</strong>).</p>
                
                <p>Click the button below to reset your password and sign in to SAM AI:</p>
                
                <p style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}" class="button">Reset Password</a>
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

// Handle GET requests - show password reset form
export async function GET() {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Password - SAM AI</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-900 min-h-screen flex items-center justify-center">
    <div class="max-w-md w-full mx-auto bg-gray-800 rounded-lg shadow-xl p-8">
        <div class="text-center mb-8">
            <img src="/SAM.jpg" alt="SAM AI" class="w-16 h-16 rounded-full object-cover mx-auto mb-4" style="object-position: center 30%;">
            <h1 class="text-2xl font-bold text-white">Get Magic Link</h1>
            <p class="text-gray-400">Enter your email address and we'll send you a magic link to instantly sign in to SAM AI.</p>
        </div>
        
        <form id="reset-form" class="space-y-6">
            <div>
                <label for="email" class="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                <input 
                    type="email" 
                    id="email" 
                    name="email"
                    required
                    class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter your email"
                >
            </div>
            
            <button 
                type="submit"
                class="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
                Send Magic Link
            </button>
            
            <div class="text-center">
                <p class="text-gray-400 text-sm">
                    Remember your password? 
                    <a href="/api/auth/signin" class="text-purple-400 hover:text-purple-300">Sign in</a>
                </p>
            </div>
        </form>
        
        <div id="error-message" class="hidden mt-4 p-4 bg-red-600 text-white rounded-lg"></div>
        <div id="success-message" class="hidden mt-4 p-4 bg-green-600 text-white rounded-lg"></div>
    </div>
    
    <script>
        document.getElementById('reset-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const errorDiv = document.getElementById('error-message');
            const successDiv = document.getElementById('success-message');
            
            // Clear previous messages
            errorDiv.classList.add('hidden');
            successDiv.classList.add('hidden');
            
            try {
                const response = await fetch('/api/auth/reset-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    successDiv.textContent = 'Magic link sent! Check your email and click the link to instantly sign in to SAM AI.';
                    successDiv.classList.remove('hidden');
                    document.getElementById('email').value = '';
                } else {
                    errorDiv.textContent = data.error || 'Failed to send magic link. Please try again.';
                    errorDiv.classList.remove('hidden');
                }
            } catch (error) {
                errorDiv.textContent = 'Network error. Please try again.';
                errorDiv.classList.remove('hidden');
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