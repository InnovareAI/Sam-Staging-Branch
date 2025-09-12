import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import * as postmark from 'postmark';
import { activeCampaignService } from '@/lib/activecampaign';

// Company configurations
const COMPANY_CONFIG = {
  InnovareAI: {
    postmarkApiKey: process.env.POSTMARK_INNOVAREAI_API_KEY,
    fromEmail: 'sp@innovareai.com', // Sarah Powell
    companyName: 'InnovareAI',
    contactEmail: 'sp@innovareai.com',
    contactName: 'Sarah Powell',
    activeCampaignListId: '1' // Default list ID - will be updated after testing
  },
  '3cubedai': {
    postmarkApiKey: process.env.POSTMARK_3CUBEDAI_API_KEY,
    fromEmail: 'sophia@3cubed.ai', // Sophia Caldwell
    companyName: '3CubedAI',
    contactEmail: 'sophia@3cubed.ai',
    contactName: 'Sophia Caldwell',
    activeCampaignListId: '1' // Default list ID - will be updated after testing
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

    // Check if user already exists in auth.users
    const { data: existingUsers, error: checkError } = await adminSupabase.auth.admin.listUsers();
    if (checkError) {
      console.error('Error checking existing users:', checkError);
      return NextResponse.json(
        { error: 'Failed to check existing users: ' + checkError.message },
        { status: 500 }
      );
    }

    const existingUser = existingUsers.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
    let inviteData;

    if (existingUser) {
      // User already exists - don't try to invite via auth, just use existing user
      console.log(`User ${email} already exists, using existing user ID: ${existingUser.id}`);
      inviteData = { user: existingUser };
    } else {
      // User doesn't exist - send invitation via Supabase Admin API
      const { data: newInviteData, error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
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

      inviteData = newInviteData;
    }

    // Send custom welcome email using Postmark with company branding
    try {
      const companyConfig = COMPANY_CONFIG[company as keyof typeof COMPANY_CONFIG];
      if (companyConfig.postmarkApiKey) {
        const postmarkClient = new postmark.ServerClient(companyConfig.postmarkApiKey);
        
        const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com';
        const isNewUser = !existingUser;
        
        const emailSubject = isNewUser 
          ? `Welcome to SAM AI - Your Account is Ready!`
          : `You've been added to SAM AI by ${companyConfig.companyName}`;
          
        const emailHtmlBody = isNewUser ? `
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
        ` : `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #7c3aed;">You've been added to SAM AI!</h1>
            <p>Hello ${firstName},</p>
            <p>Good news! ${companyConfig.companyName} has added you to their SAM AI workspace. You can now access the platform with your existing account.</p>
            <div style="margin: 30px 0; text-align: center;">
              <a href="${redirectUrl}" 
                 style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
                Access Your Workspace
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
              You received this email because ${companyConfig.companyName} added you to their SAM AI workspace.
            </p>
          </div>
        `;
        
        await postmarkClient.sendEmail({
          From: companyConfig.fromEmail,
          To: email,
          Subject: emailSubject,
          HtmlBody: emailHtmlBody,
          TextBody: isNewUser ? `
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
          ` : `
            You've been added to SAM AI!
            
            Hello ${firstName},
            
            Good news! ${companyConfig.companyName} has added you to their SAM AI workspace. You can now access the platform with your existing account.
            
            Access your workspace at: ${redirectUrl}
            
            What you can do with SAM AI:
            - Chat with your AI sales assistant for personalized guidance
            - Access comprehensive knowledge base  
            - Manage your lead pipeline efficiently
            - Track campaign performance and analytics
            - Collaborate with your team in shared workspaces
            
            If you have any questions, please contact ${companyConfig.contactName} at ${companyConfig.contactEmail} or our support team.
            
            You received this email because ${companyConfig.companyName} added you to their SAM AI workspace.
          `
        });
        
        console.log(`Custom ${isNewUser ? 'welcome' : 'notification'} email sent to ${email} from ${companyConfig.companyName}`);
      }
    } catch (emailError) {
      console.error('Failed to send custom welcome email:', emailError);
      // Don't fail the invitation if email fails, just log it
    }

    // Add user to ActiveCampaign list
    try {
      const companyConfig = COMPANY_CONFIG[company as keyof typeof COMPANY_CONFIG];
      if (companyConfig.activeCampaignListId && process.env.ACTIVECAMPAIGN_API_KEY) {
        console.log(`📧 Adding ${email} to ActiveCampaign list ${companyConfig.activeCampaignListId}...`);
        
        const acResult = await activeCampaignService.addNewMemberToList(
          email,
          firstName,
          lastName,
          companyConfig.activeCampaignListId,
          {
            fieldValues: [
              { field: 'company', value: companyConfig.companyName },
              { field: 'source', value: 'SAM AI Invitation' },
              { field: 'role', value: role },
              { field: 'invited_by', value: user.email || 'Unknown' }
            ]
          }
        );

        if (acResult.success) {
          console.log(`✅ Successfully added ${email} to ActiveCampaign list ${companyConfig.activeCampaignListId}`);
        } else {
          console.error(`❌ Failed to add ${email} to ActiveCampaign:`, acResult.error);
        }
      } else {
        console.log('⚠️ ActiveCampaign not configured - skipping list addition');
      }
    } catch (acError) {
      console.error('Failed to add user to ActiveCampaign:', acError);
      // Don't fail the invitation if ActiveCampaign fails, just log it
    }

    // CRITICAL: ENSURE membership assignment BEFORE storing invitation record
    if (workspaceId || organizationId) {
      const targetWorkspaceId = workspaceId || organizationId;
      const companyConfig = COMPANY_CONFIG[company as keyof typeof COMPANY_CONFIG];
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 7); // 7 days expiration

      // Step 1: FIRST check if user exists and get their ID (critical for membership)
      if (!inviteData.user?.id) {
        console.error('CRITICAL: No user ID available for workspace assignment');
        return NextResponse.json(
          { error: 'User ID required for workspace assignment but not available' },
          { status: 500 }
        );
      }

      // Step 2: Check existing membership BEFORE making any database changes
      const { data: existingMembership, error: membershipCheckError } = await adminSupabase
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', targetWorkspaceId)
        .eq('user_id', inviteData.user.id)
        .maybeSingle();

      // Check for errors in membership check
      if (membershipCheckError) {
        console.error('ERROR: Failed to check existing membership:', membershipCheckError);
        return NextResponse.json(
          { error: 'Failed to check existing membership', details: membershipCheckError.message },
          { status: 500 }
        );
      }

      // Step 3: Add to workspace_members FIRST (if not already a member)
      if (!existingMembership) {
        console.log(`👥 Adding user ${email} to workspace ${targetWorkspaceId} as ${role}`);
        const { error: membershipError } = await adminSupabase
          .from('workspace_members')
          .insert({
            workspace_id: targetWorkspaceId,
            user_id: inviteData.user.id,
            role: role,
            invited_by: user.id,
            joined_at: new Date().toISOString()
          });

        if (membershipError) {
          console.error('CRITICAL: Failed to add user to workspace_members:', membershipError);
          // CRITICAL: If we can't add them to the workspace, don't create the invitation record
          return NextResponse.json(
            { error: 'Failed to assign user to workspace', details: membershipError.message },
            { status: 500 }
          );
        }
        
        console.log(`✅ SUCCESS: User ${email} ASSIGNED to workspace ${targetWorkspaceId} with role ${role}`);
      } else {
        console.log(`✅ INFO: User ${email} already a member of workspace ${targetWorkspaceId}`);
      }

      // Step 4: ONLY store invitation record AFTER successful membership assignment
      const { error: invitationError } = await adminSupabase
        .from('workspace_invitations')
        .insert({
          workspace_id: targetWorkspaceId,
          email: email,
          role: role,
          company: company,
          expires_at: expirationDate.toISOString(),
          invited_by: user.id
        });

      if (invitationError) {
        console.error('WARNING: Failed to store workspace invitation record (but membership succeeded):', invitationError);
        // NOTE: Don't fail the entire operation since membership succeeded
        // Just log the warning - the user is already in the workspace
        console.log(`⚠️ User ${email} added to workspace but invitation record not stored`);
      } else {
        console.log(`✅ COMPLETE: User ${email} invited and invitation record stored by ${companyConfig.companyName}`);
      }
    }

    const companyConfig = COMPANY_CONFIG[company as keyof typeof COMPANY_CONFIG];
    
    return NextResponse.json({
      message: existingUser ? 'User added to workspace successfully' : 'Invitation sent successfully',
      company: companyConfig.companyName,
      isNewUser: !existingUser,
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