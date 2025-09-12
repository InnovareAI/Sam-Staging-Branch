import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ServerClient } from 'postmark';
import { createPostmarkHelper, EMAIL_BYPASS_MODE, shouldBypassEmail, getSafeTestEmail } from '../../../../lib/postmark-helper';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const postmarkClient = new ServerClient(process.env.POSTMARK_SERVER_TOKEN!);

export async function POST(req: NextRequest) {
  try {
    const { email, workspaceId, role = 'member' } = await req.json();

    if (!email || !workspaceId) {
      return NextResponse.json({ error: 'Email and workspace ID required' }, { status: 400 });
    }

    // Get workspace details
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('name, owner_id, users!workspaces_owner_id_fkey(first_name, last_name, email)')
      .eq('id', workspaceId)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    let inviteToken = null;
    let isNewUser = !existingUser;

    if (existingUser) {
      // Check if already a member
      const { data: existingMember } = await supabase
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('user_id', existingUser.id)
        .single();

      if (existingMember) {
        return NextResponse.json({ error: 'User already a member' }, { status: 400 });
      }

      // Add existing user to workspace
      await supabase
        .from('workspace_members')
        .insert({
          workspace_id: workspaceId,
          user_id: existingUser.id,
          role: role
        });
    } else {
      // Generate invite token for new users
      inviteToken = `invite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store pending invite
      await supabase
        .from('workspace_invitations')
        .insert({
          email: email,
          workspace_id: workspaceId,
          role: role,
          invite_token: inviteToken,
          invited_by: workspace.owner_id,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
          company: 'InnovareAI' // Default company
        });
    }

    // Send email via enhanced Postmark helper with suppression handling
    const inviterData = Array.isArray(workspace.users) ? workspace.users[0] : workspace.users;
    const inviterName = `${inviterData?.first_name || ''} ${inviterData?.last_name || ''}`.trim() || inviterData?.email;
    
    // Use InnovareAI as default company for workspace invites
    const postmarkHelper = createPostmarkHelper('InnovareAI');
    
    if (postmarkHelper) {
      // Handle email bypass mode for testing
      let targetEmail = email;
      let emailNote = '';
      
      if (shouldBypassEmail(email)) {
        targetEmail = getSafeTestEmail();
        emailNote = ` (BYPASS MODE: Original recipient was ${email})`;
        console.warn(`EMAIL_BYPASS_MODE: Redirecting workspace invite from ${email} to ${targetEmail}`);
      }
      
      const subject = isNewUser 
        ? `You're invited to join ${workspace.name} on SAM AI${emailNote}`
        : `You've been added to ${workspace.name} on SAM AI${emailNote}`;
        
      const htmlBody = isNewUser ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${emailNote ? `<div style="background: #fff3cd; padding: 10px; border-radius: 4px; margin-bottom: 20px; color: #856404;"><strong>TEST MODE:</strong> This email was originally intended for ${email}</div>` : ''}
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #7C3AED; margin: 0;">SAM AI</h1>
            <p style="color: #6B7280; margin: 5px 0;">AI-Powered Sales Assistant Platform</p>
          </div>
          
          <div style="background: #F9FAFB; padding: 30px; border-radius: 12px; margin-bottom: 30px;">
            <h2 style="color: #1F2937; margin-top: 0;">You're invited to collaborate!</h2>
            <p style="color: #4B5563; line-height: 1.6;">
              <strong>${inviterName}</strong> has invited you to join the workspace 
              <strong>"${workspace.name}"</strong> on SAM AI as a <strong>${role}</strong>.
            </p>
            <p style="color: #4B5563; line-height: 1.6;">
              SAM AI is an intelligent sales assistant platform that helps teams automate 
              prospecting, lead generation, and customer engagement.
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com'}/invite/${inviteToken}" 
               style="background: #7C3AED; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
              Accept Invitation & Join Workspace
            </a>
          </div>
          
          <div style="background: #FEF3C7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #92400E; margin: 0; font-size: 14px;">
              <strong>⏰ This invitation expires in 7 days.</strong><br>
              Click the button above to create your account and join the workspace.
            </p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
          
          <p style="color: #6B7280; font-size: 14px; text-align: center;">
            This invitation was sent to ${emailNote ? email + ' (redirected for testing)' : targetEmail}. If you didn't expect this email, you can safely ignore it.
          </p>
        </div>
      ` : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${emailNote ? `<div style="background: #fff3cd; padding: 10px; border-radius: 4px; margin-bottom: 20px; color: #856404;"><strong>TEST MODE:</strong> This email was originally intended for ${email}</div>` : ''}
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #7C3AED; margin: 0;">SAM AI</h1>
            <p style="color: #6B7280; margin: 5px 0;">AI-Powered Sales Assistant Platform</p>
          </div>
          
          <div style="background: #F0FDF4; padding: 30px; border-radius: 12px; margin-bottom: 30px;">
            <h2 style="color: #1F2937; margin-top: 0;">Welcome to the team!</h2>
            <p style="color: #4B5563; line-height: 1.6;">
              <strong>${inviterName}</strong> has added you to the workspace 
              <strong>"${workspace.name}"</strong> as a <strong>${role}</strong>.
            </p>
            <p style="color: #4B5563; line-height: 1.6;">
              You can now access the workspace and collaborate with your team using SAM AI.
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com'}" 
               style="background: #10B981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
              Access Your Workspace
            </a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
          
          <p style="color: #6B7280; font-size: 14px; text-align: center;">
            This email was sent to ${emailNote ? email + ' (redirected for testing)' : targetEmail} because you've been added to a SAM AI workspace.
          </p>
        </div>
      `;
      
      const textBody = isNewUser ? `
        You're invited to join ${workspace.name} on SAM AI
        ${emailNote}
        
        ${inviterName} has invited you to join the workspace "${workspace.name}" as a ${role}.
        
        SAM AI is an intelligent sales assistant platform that helps teams automate prospecting, lead generation, and customer engagement.
        
        Accept your invitation: ${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com'}/invite/${inviteToken}
        
        This invitation expires in 7 days.
        
        If you didn't expect this email, you can safely ignore it.
      ` : `
        You've been added to ${workspace.name} on SAM AI
        ${emailNote}
        
        Welcome to the team!
        
        ${inviterName} has added you to the workspace "${workspace.name}" as a ${role}.
        
        Access your workspace: ${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com'}
        
        You can now collaborate with your team using SAM AI.
      `;
      
      const emailResult = await postmarkHelper.sendEmailSafely({
        To: targetEmail,
        Subject: subject,
        HtmlBody: htmlBody,
        TextBody: textBody
      });
      
      if (!emailResult.success) {
        console.error('Workspace invite email failed:', {
          error: emailResult.error,
          targetEmail,
          originalEmail: email,
          suppressionInfo: emailResult.suppressionInfo,
          canRetryAfterReactivation: emailResult.canRetryAfterReactivation
        });
        
        // If email failed due to suppression, log detailed info but don't fail the invitation
        if (emailResult.suppressionInfo) {
          console.warn(`Email suppression detected for workspace invite to ${email}:`, {
            reason: emailResult.suppressionInfo.SuppressionReason,
            origin: emailResult.suppressionInfo.Origin,
            createdAt: emailResult.suppressionInfo.CreatedAt
          });
        }
      } else {
        console.log(`Workspace invite email sent successfully to ${targetEmail} (MessageID: ${emailResult.messageId})`);
      }
    } else {
      console.warn('Postmark helper not available for workspace invite');
      // Fallback to original Postmark client if helper fails
      const emailTemplate = isNewUser ? {
        To: email,
        From: 'noreply@meet-sam.com',
        Subject: `You're invited to join ${workspace.name} on SAM AI`,
        HtmlBody: `<div>Fallback email content for ${inviterName} inviting you to ${workspace.name}</div>`,
        MessageStream: 'outbound'
      } : {
        To: email,
        From: 'noreply@meet-sam.com', 
        Subject: `You've been added to ${workspace.name} on SAM AI`,
        HtmlBody: `<div>Fallback email content - you've been added to ${workspace.name}</div>`,
        MessageStream: 'outbound'
      };
      
      await postmarkClient.sendEmail(emailTemplate);
    }

    return NextResponse.json({ 
      success: true, 
      message: isNewUser ? 'Invitation sent successfully' : 'User added to workspace and notified' 
    });

  } catch (error) {
    console.error('Workspace invite error:', error);
    return NextResponse.json({ error: 'Failed to send invitation' }, { status: 500 });
  }
}