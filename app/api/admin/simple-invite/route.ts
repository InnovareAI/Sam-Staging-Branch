
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/security/route-auth';

// Initialize Supabase client with service role for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ONLY super admin emails can invite users
const SUPER_ADMIN_EMAILS = ['tl@innovareai.com', 'cl@innovareai.com'];

export async function POST(request: NextRequest) {
  // Require authentication
  const { error: authError, user } = await requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { email, workspaceId, organizationId, role = 'member', firstName, lastName, company } = body;

    // Support both workspaceId and organizationId field names
    const targetWorkspaceId = workspaceId || organizationId;

    // ONLY super admins can invite users - no one else
    const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(user!.email || '');

    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: 'Only super admins can invite users' },
        { status: 403 }
      );
    }

    // Basic validation
    if (!email || !targetWorkspaceId) {
      return NextResponse.json(
        { error: 'Email and workspaceId/organizationId are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    console.log(`🔄 SIMPLE INVITE: Processing invitation for ${email} to workspace ${targetWorkspaceId} (company: ${company})`);

    // SAFETY PROTOCOL: Check if email is already used in ANY tenant
    console.log(`🛡️ SAFETY CHECK: Verifying email ${email} uniqueness across all tenants`);
    const { data: existingUsers, error: checkError } = await supabase.auth.admin.listUsers();
    if (checkError) {
      console.error('❌ Error checking existing users:', checkError);
      return NextResponse.json(
        { error: 'Failed to check existing users' },
        { status: 500 }
      );
    }

    const existingUser = existingUsers.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

    if (existingUser) {
      // Email already exists - check if they're in a different workspace
      const { data: existingMemberships, error: membershipError } = await supabase
        .from('workspace_members')
        .select(`
          id, 
          workspace_id, 
          role,
          workspaces!inner(id, name, slug)
        `)
        .eq('user_id', existingUser.id);

      if (membershipError) {
        console.error('❌ Error checking existing memberships:', membershipError);
        return NextResponse.json(
          { error: 'Failed to check user memberships' },
          { status: 500 }
        );
      }

      // Check if user is trying to join a different tenant
      const isInDifferentWorkspace = existingMemberships?.some((membership: any) =>
        membership.workspace_id !== targetWorkspaceId
      );

      if (isInDifferentWorkspace) {
        const existingWorkspaces = existingMemberships?.map((m: any) => m.workspaces?.name || 'Unknown').join(', ');
        console.log(`🚫 SAFETY PROTOCOL: ${email} already exists in different workspace(s): ${existingWorkspaces}`);
        return NextResponse.json(
          {
            error: `This email is already registered with another workspace (${existingWorkspaces}). Each email can only be used in one tenant. Please use a different email address.`,
            code: 'EMAIL_ALREADY_USED_IN_DIFFERENT_TENANT'
          },
          { status: 409 }
        );
      }

      // User exists and is in the same workspace - check if already a member
      const isAlreadyMember = existingMemberships?.some((membership: any) =>
        membership.workspace_id === targetWorkspaceId
      );

      if (isAlreadyMember) {
        console.log(`ℹ️ USER ALREADY MEMBER: ${email} already in workspace ${targetWorkspaceId}`);
        const existingRole = existingMemberships?.find((m: any) => m.workspace_id === targetWorkspaceId)?.role;
        return NextResponse.json({
          success: true,
          message: 'User already a member of this workspace',
          user: { id: existingUser.id, email, role: existingRole },
          alreadyMember: true
        });
      }
    }

    console.log(`✅ EMAIL SAFETY CHECK PASSED: ${email} is available for workspace ${targetWorkspaceId}`);

    // Determine user ID from safety check
    let userId: string;

    if (existingUser) {
      console.log(`✅ EXISTING USER: Found user ${existingUser.id} for ${email}`);
      userId = existingUser.id;
    } else {
      // Step 2: Create new user via Supabase Auth Admin API
      console.log(`🆕 NEW USER: Creating user for ${email}`);

      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: email,
        email_confirm: true, // Auto-confirm email to avoid Supabase's email templates
        user_metadata: {
          first_name: firstName || '',
          last_name: lastName || '',
          role: role
        }
      });

      if (createError) {
        console.error('❌ Error creating user:', createError);
        return NextResponse.json(
          { error: 'Failed to create user: ' + createError.message },
          { status: 500 }
        );
      }

      if (!newUser.user?.id) {
        console.error('❌ No user ID returned from Supabase');
        return NextResponse.json(
          { error: 'User creation failed - no ID returned' },
          { status: 500 }
        );
      }

      userId = newUser.user.id;
      console.log(`✅ NEW USER CREATED: ${userId} for ${email}`);
    }

    // Step 2.5: Ensure user exists in users table (required for workspace_members foreign key)
    console.log(`🔗 ENSURING USER IN USERS TABLE: ${userId}`);
    const { error: userInsertError } = await supabase
      .from('users')
      .upsert({
        id: userId,
        supabase_id: userId, // Supabase user ID
        email: email,
        first_name: firstName || '',
        last_name: lastName || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id',
        ignoreDuplicates: true
      });

    if (userInsertError) {
      console.error('❌ Error ensuring user in users table:', userInsertError);
      // Don't fail the whole process - log and continue
      console.warn('⚠️ Continuing without user in users table, may cause foreign key issues');
    }

    // Step 3: Check if already a member of workspace
    const { data: existingMember, error: memberCheckError } = await supabase
      .from('workspace_members')
      .select('id, role')
      .eq('workspace_id', targetWorkspaceId)
      .eq('user_id', userId)
      .maybeSingle();

    if (memberCheckError) {
      console.error('❌ Error checking workspace membership:', memberCheckError);
      return NextResponse.json(
        { error: 'Failed to check membership' },
        { status: 500 }
      );
    }

    if (existingMember) {
      console.log(`ℹ️ USER ALREADY MEMBER: ${userId} already in workspace ${targetWorkspaceId}`);
      return NextResponse.json({
        success: true,
        message: 'User already a member of this workspace',
        user: { id: userId, email, role: existingMember.role },
        alreadyMember: true
      });
    }

    // Step 4: Add user to workspace using UPSERT to handle race conditions
    console.log(`➕ ADDING MEMBER: Adding ${userId} to workspace ${targetWorkspaceId} as ${role}`);

    const { data: membershipData, error: membershipError } = await supabase
      .from('workspace_members')
      .upsert({
        workspace_id: targetWorkspaceId,
        user_id: userId,
        role: role,
        joined_at: new Date().toISOString()
      }, {
        onConflict: 'workspace_id,user_id',
        ignoreDuplicates: false
      })
      .select();

    if (membershipError) {
      console.error('❌ MEMBERSHIP ERROR:', membershipError);
      return NextResponse.json(
        {
          error: 'Failed to add user to workspace',
          details: membershipError.message
        },
        { status: 500 }
      );
    }

    console.log(`✅ SUCCESS: ${email} (${userId}) added to workspace ${targetWorkspaceId} as ${role}`);

    // Step 5: Send email notification and sync to ActiveCampaign
    try {
      await sendSimpleNotification(email, firstName, targetWorkspaceId, company);

      // Step 6: Sync to ActiveCampaign if available
      if (process.env.ACTIVECAMPAIGN_API_KEY && process.env.ACTIVECAMPAIGN_API_URL) {
        console.log(`🔄 Syncing ${email} to ActiveCampaign...`);
        try {
          const { activeCampaignService } = await import('../../../../lib/activecampaign');
          const acCompany = company === '3cubedai' || company === '3CubedAI' ? '3CubedAI' : 'InnovareAI';
          const acResult = await activeCampaignService.addSamUserToList(
            email,
            firstName || '',
            lastName || '',
            acCompany as 'InnovareAI' | '3CubedAI'
          );

          if (acResult.success) {
            console.log(`✅ ActiveCampaign sync successful for ${email}`);
          } else {
            console.warn(`⚠️ ActiveCampaign sync failed for ${email}:`, acResult.error);
          }
        } catch (acError) {
          console.warn(`⚠️ ActiveCampaign sync error for ${email}:`, acError);
        }
      }
    } catch (emailError) {
      console.warn('⚠️ Email notification failed:', emailError);
      // Don't fail the whole request if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'User successfully added to workspace',
      user: {
        id: userId,
        email: email,
        role: role,
        workspace: targetWorkspaceId
      }
    });

  } catch (error) {
    console.error('❌ UNEXPECTED ERROR:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Custom email notification using Postmark with company-specific sender
async function sendSimpleNotification(email: string, firstName?: string, workspaceId?: string, company?: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com';

  // Determine sender based on company
  const is3Cubed = company === '3cubedai' || company === '3CubedAI';
  const senderEmail = is3Cubed ? 'sophia@3cubed.ai' : 'sp@innovareai.com';
  const senderName = is3Cubed ? 'Sophia Caldwell' : 'Sarah Powell';
  const apiToken = is3Cubed ? process.env.POSTMARK_3CUBEDAI_API_KEY : process.env.POSTMARK_INNOVAREAI_API_KEY;

  console.log('📧 SENDING CUSTOM EMAIL NOTIFICATION:');
  console.log(`   To: ${email}`);
  console.log(`   From: ${senderEmail} (${senderName})`);
  console.log(`   Company: ${company || 'InnovareAI'}`);
  console.log(`   Name: ${firstName || 'New User'}`);
  console.log(`   Workspace: ${workspaceId}`);

  if (!apiToken) {
    console.warn(`⚠️ No Postmark API token configured for company: ${company || 'InnovareAI'}`);
    return;
  }

  try {
    // Use Postmark to send custom invitation email with company-specific sender
    const postmarkResponse = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': apiToken
      },
      body: JSON.stringify({
        From: senderEmail,
        To: email,
        Subject: 'Welcome to SAM AI - Your Account is Ready!',
        HtmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #6366f1;">Welcome to SAM AI Platform</h2>
            
            <p>Hi ${firstName || 'there'},</p>
            
            <p>You have been successfully invited to join the SAM AI Platform. Your account has been created and is ready to use!</p>
            
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #374151;">Get Started:</h3>
              <p><strong>1.</strong> Visit: <a href="${baseUrl}" style="color: #6366f1;">${baseUrl}</a></p>
              <p><strong>2.</strong> Sign in with your email: <strong>${email}</strong></p>
              <p><strong>3.</strong> Set up your password on first login</p>
            </div>
            
            <p>If you have any questions, feel free to reach out to our team.</p>
            
            <p>Best regards,<br>
            ${senderName}<br>
            SAM AI Team</p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 12px; color: #6b7280;">
              This email was sent from SAM AI Platform. If you didn't expect this invitation, please ignore this email.
            </p>
          </div>
        `,
        TextBody: `
Welcome to SAM AI Platform

Hi ${firstName || 'there'},

You have been successfully invited to join the SAM AI Platform. Your account has been created and is ready to use!

Get Started:
1. Visit: ${baseUrl}
2. Sign in with your email: ${email}  
3. Set up your password on first login

If you have any questions, feel free to reach out to our team.

Best regards,
${senderName}
SAM AI Team
        `,
        MessageStream: 'outbound'
      })
    });

    if (postmarkResponse.ok) {
      const result = await postmarkResponse.json();
      console.log('✅ EMAIL SENT SUCCESSFULLY:', result.MessageID);
      return result;
    } else {
      const errorResult = await postmarkResponse.json();
      console.error('❌ EMAIL FAILED:', errorResult);
      throw new Error(`Postmark error: ${errorResult.Message}`);
    }
  } catch (error) {
    console.error('❌ EMAIL NOTIFICATION ERROR:', error);
    throw error;
  }
}
