
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security/route-auth';

// Super admin emails
const SUPER_ADMIN_EMAILS = ['tl@innovareai.com', 'cl@innovareai.com'];

// Function to determine sender based on user affiliation
function getSenderByAffiliation(userEmail: string): string {
  // Debug logging
  console.log('🔍 ADMIN ROUTE - Checking sender affiliation for:', userEmail);
  
  // Check if user belongs to 3cubed or sendingcell.com
  if (userEmail.includes('3cubed') || userEmail.includes('cubedcapital') || userEmail.includes('sendingcell.com')) {
    console.log('✅ ADMIN ROUTE - 3cubed affiliation detected, using Sophia Caldwell');
    return 'Sophia Caldwell <sophia@3cubed.ai>';
  }
  
  // Default to Sarah Powell for InnovareAI and other users
  console.log('✅ ADMIN ROUTE - InnovareAI affiliation, using Sarah Powell');
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

  // Require admin authentication
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;
  try {
    // Get auth header for admin verification
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    // Create Supabase client with service role for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

    // Also create client with user context for verification
    const userSupabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the requesting user is authenticated and has admin rights
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is super admin
    if (!SUPER_ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) {
      return NextResponse.json(
        { error: 'Forbidden - Super admin access required' },
        { status: 403 }
      );
    }

    const { email } = await request.json();

    // Validate input
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    console.log('Admin sending password reset to:', email, 'by:', user.email);

    // Check if user exists first
    const { data: users, error: userError } = await adminSupabase.auth.admin.listUsers();
    
    if (userError) {
      console.error('Error checking users:', userError);
      return NextResponse.json(
        { error: 'Failed to verify user exists' },
        { status: 500 }
      );
    }
    
    const userExists = users?.users?.find((u: any) => u.email === email);
    
    if (!userExists) {
      return NextResponse.json(
        { error: 'User not found in system' },
        { status: 404 }
      );
    }

    // Use Postmark for reliable email delivery
    if (process.env.POSTMARK_SERVER_TOKEN) {
      const currentSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com';
      
      // Generate a password reset token using Supabase admin
      const { data, error: linkError } = await adminSupabase.auth.admin.generateLink({
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

      // Create our own reset page link
      const resetUrl = `${currentSiteUrl}/reset-password?email=${encodeURIComponent(email)}&recovery=true`;
      
      const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Password Reset - SAM AI</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .button { display: inline-block; padding: 12px 24px; background: #7c3aed; color: white; text-decoration: none; border-radius: 6px; }
                .footer { margin-top: 30px; font-size: 14px; color: #666; }
                .admin-notice { background: #f0f0f0; padding: 15px; border-left: 4px solid #7c3aed; margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔑 Password Reset - SAM AI</h1>
                </div>
                
                <div class="admin-notice">
                    <strong>Admin-Initiated Password Reset</strong><br>
                    This password reset was requested by a system administrator for your SAM AI account.
                </div>
                
                <p>Hi there,</p>
                
                <p>A system administrator has initiated a password reset for your SAM AI account (<strong>${email}</strong>).</p>
                
                <p>Click the button below to reset your password and sign in to SAM AI:</p>
                
                <p style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}" class="button">Reset Password</a>
                </p>
                
                <p><small>If the button doesn't work, copy and paste this link:</small></p>
                <p style="word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px;">
                    ${resetUrl}
                </p>
                
                <p><em>This link will expire in 24 hours for security.</em></p>
                
                <p>If you didn't expect this password reset, please contact your system administrator.</p>
                
                <div class="footer">
                    <p>Best regards,<br><strong>The SAM AI Team</strong></p>
                    <p style="color: #999; font-size: 12px;">SAM AI - Your AI-powered Sales Assistant Platform</p>
                </div>
            </div>
        </body>
        </html>
      `;

      await sendEmail(email, '🔑 Password Reset - SAM AI (Admin Initiated)', htmlBody);
      
      console.log('✅ Admin password reset email sent via Postmark successfully to:', email);
      return NextResponse.json({
        success: true,
        message: `Password reset email sent to ${email}. The user will receive instructions to reset their password.`
      });
    }

    // If Postmark is not configured
    return NextResponse.json(
      { error: 'Email service not configured. Please try again later.' },
      { status: 503 }
    );

  } catch (error) {
    console.error('Admin password reset API error:', error);
    return NextResponse.json(
      { error: 'Internal server error during password reset' },
      { status: 500 }
    );
  }
}
