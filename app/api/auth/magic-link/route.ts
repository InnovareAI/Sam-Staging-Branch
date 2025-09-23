import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase admin client for generating magic links
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Create regular client for fallback
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Function to determine sender based on user affiliation
function getSenderByAffiliation(userEmail: string): string {
  console.log('🔍 MAGIC LINK - Checking sender affiliation for:', userEmail);
  
  // Check if user belongs to 3cubed or sendingcell.com
  if (userEmail.includes('3cubed') || userEmail.includes('cubedcapital') || userEmail.includes('sendingcell.com')) {
    console.log('✅ MAGIC LINK - 3cubed affiliation detected, using Sophia Caldwell');
    return 'Sophia Caldwell <sophia@innovareai.com>';
  }
  
  // Default to Sarah Powell for InnovareAI and other users
  console.log('✅ MAGIC LINK - InnovareAI affiliation, using Sarah Powell');
  return 'Sarah Powell <sarah@innovareai.com>';
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

    console.log('Sending magic link to:', email);

    // Check if user exists first
    const { data: users, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userError) {
      console.error('Error checking users:', userError);
    }
    
    const userExists = users?.users?.find((user: any) => user.email === email);
    
    if (!userExists) {
      // Still return success for security (don't reveal if email exists)
      return NextResponse.json({
        message: 'If this email exists in our system, you will receive a magic link.'
      });
    }

    // Use Postmark for reliable email delivery
    const is3Cubed = email.includes('3cubed') || email.includes('cubedcapital') || email.includes('sendingcell.com');
    const postmarkApiKey = is3Cubed 
      ? process.env.POSTMARK_3CUBEDAI_API_KEY 
      : process.env.POSTMARK_INNOVAREAI_API_KEY;

    if (postmarkApiKey) {
      const currentSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://sam.innovareai.com';
      
      // Generate a magic link token using Supabase admin
      const { data, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: email,
        options: {
          redirectTo: `${currentSiteUrl}/auth/callback`
        }
      });

      if (linkError) {
        console.error('Magic link generation error:', linkError);
        return NextResponse.json(
          { error: 'Unable to generate magic link. Please try again later.' },
          { status: 503 }
        );
      }

      // Use the generated magic link
      const magicLinkUrl = data.properties?.action_link || `${currentSiteUrl}/auth/callback?token=${data.properties?.hashed_token}`;
      
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
                
                <p>We received a request to sign in to your SAM AI account (<strong>${email}</strong>).</p>
                
                <p>Click the button below to instantly sign in to SAM AI:</p>
                
                <p style="text-align: center; margin: 30px 0;">
                    <a href="${magicLinkUrl}" class="button">Sign In to SAM AI</a>
                </p>
                
                <p><small>If the button doesn't work, copy and paste this link:</small></p>
                <p style="word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px;">
                    ${magicLinkUrl}
                </p>
                
                <p><em>This link will expire in 1 hour for security.</em></p>
                
                <p>If you didn't request this magic link, you can safely ignore this email.</p>
                
                <div class="footer">
                    <p>Best regards,<br><strong>The SAM AI Team</strong></p>
                    <p style="color: #999; font-size: 12px;">SAM AI - Your AI-powered Sales Agent Platform</p>
                </div>
            </div>
        </body>
        </html>
      `;

      await sendEmail(email, '🪄 Your SAM AI Magic Link', htmlBody);
      
      console.log('✅ Magic link email sent via Postmark successfully');
      return NextResponse.json({
        message: 'Magic link sent! Check your email and click the link to instantly sign in to SAM AI.'
      });
    }

    // Fallback to Supabase if Postmark is not configured
    console.log('⚠️ Postmark not configured, falling back to Supabase');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
      }
    });

    if (error) {
      console.error('Magic link error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'Magic link sent successfully'
    });

  } catch (error) {
    console.error('Magic link API error:', error);
    return NextResponse.json(
      { error: 'Internal server error during magic link generation' },
      { status: 500 }
    );
  }
}