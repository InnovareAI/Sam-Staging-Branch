import { createClient } from '@supabase/supabase-js';
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

// Super admin emails
const SUPER_ADMIN_EMAILS = ['tl@innovareai.com', 'cl@innovareai.com'];

export async function POST(request: NextRequest) {
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

    const { email, firstName, lastName, organizationId, workspaceId, company = 'InnovareAI', role = 'member' } = await request.json();

    if (!email || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Email, first name, and last name are required' },
        { status: 400 }
      );
    }

    // Validate company
    if (!COMPANY_CONFIG[company as keyof typeof COMPANY_CONFIG]) {
      return NextResponse.json(
        { error: 'Invalid company' },
        { status: 400 }
      );
    }

    // Check if organization exists (if provided)
    if (organizationId) {
      const { data: org, error: orgError } = await adminSupabase
        .from('organizations')
        .select('id, name')
        .eq('id', organizationId)
        .single();

      if (orgError || !org) {
        return NextResponse.json(
          { error: 'Organization not found' },
          { status: 404 }
        );
      }
    }

    console.log('Sending invitation to:', email);

    // Send invitation via Supabase Admin API
    const { data: inviteData, error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
      data: {
        first_name: firstName,
        last_name: lastName,
        invited_by: user.id,
        organization_id: organizationId,
        role: role
      },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`
    });

    if (inviteError) {
      console.error('Invitation error:', inviteError);
      return NextResponse.json(
        { error: 'Failed to send invitation: ' + inviteError.message },
        { status: 500 }
      );
    }

    // Send custom welcome email using Postmark with company branding
    try {
      const companyConfig = COMPANY_CONFIG[company as keyof typeof COMPANY_CONFIG];
      if (companyConfig.postmarkApiKey) {
        const postmarkClient = new postmark.ServerClient(companyConfig.postmarkApiKey);
        
        const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com';
        
        await postmarkClient.sendEmail({
          From: companyConfig.fromEmail,
          To: email,
          Subject: `Welcome to SAM AI - Your Account is Ready!`,
          HtmlBody: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #7c3aed;">Welcome to SAM AI!</h1>
              <p>Hello ${firstName},</p>
              <p>You've been invited to join SAM AI by ${companyConfig.companyName}. Your intelligent sales assistant is ready to help you streamline your sales process and boost productivity.</p>
              <div style="margin: 30px 0; text-align: center;">
                <a href="${redirectUrl}/auth/callback" 
                   style="background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
                  Access SAM AI Platform
                </a>
              </div>
              <p><strong>What you can do with SAM AI:</strong></p>
              <ul>
                <li>Chat with your AI sales assistant for personalized guidance</li>
                <li>Access comprehensive knowledge base</li>
                <li>Manage your lead pipeline efficiently</li>
                <li>Track campaign performance and analytics</li>
                <li>Collaborate with your team in shared workspaces</li>
              </ul>
              <p style="color: #666; font-size: 14px;">
                If you have any questions, please contact ${companyConfig.contactName} at ${companyConfig.contactEmail} or our support team.
              </p>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px;">
                This invitation was sent by ${companyConfig.companyName}. 
                If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </div>
          `,
          TextBody: `
            Welcome to SAM AI!
            
            Hello ${firstName},
            
            You've been invited to join SAM AI by ${companyConfig.companyName}. Your intelligent sales assistant is ready to help you streamline your sales process and boost productivity.
            
            Access your account at: ${redirectUrl}/auth/callback
            
            What you can do with SAM AI:
            - Chat with your AI sales assistant for personalized guidance
            - Access comprehensive knowledge base  
            - Manage your lead pipeline efficiently
            - Track campaign performance and analytics
            - Collaborate with your team in shared workspaces
            
            If you have any questions, please contact ${companyConfig.contactName} at ${companyConfig.contactEmail} or our support team.
            
            This invitation was sent by ${companyConfig.companyName}.
          `
        });
        
        console.log(`Custom welcome email sent to ${email} from ${companyConfig.companyName}`);
      }
    } catch (emailError) {
      console.error('Failed to send custom welcome email:', emailError);
      // Don't fail the invitation if email fails, just log it
    }

    // Store workspace invitation with company tagging
    if (workspaceId || organizationId) {
      const companyConfig = COMPANY_CONFIG[company as keyof typeof COMPANY_CONFIG];
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 7); // 7 days expiration

      const { error: invitationError } = await adminSupabase
        .from('workspace_invitations')
        .insert({
          workspace_id: workspaceId || organizationId,
          email: email,
          role: role,
          company: company,
          expires_at: expirationDate.toISOString(),
          invited_by: user.id
        });

      if (invitationError) {
        console.error('Failed to store invitation:', invitationError);
        // Don't fail the request, just log the error
      } else {
        console.log(`User ${email} invited to ${workspaceId ? 'workspace' : 'organization'} ${workspaceId || organizationId} by ${companyConfig.companyName}`);
      }
    }

    const companyConfig = COMPANY_CONFIG[company as keyof typeof COMPANY_CONFIG];
    
    return NextResponse.json({
      message: 'Invitation sent successfully',
      company: companyConfig.companyName,
      user: {
        id: inviteData.user?.id,
        email: inviteData.user?.email,
        invited_at: inviteData.user?.invited_at
      }
    });

  } catch (error) {
    console.error('Server error sending invitation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}