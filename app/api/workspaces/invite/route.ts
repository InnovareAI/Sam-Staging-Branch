import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ServerClient } from 'postmark';

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
        .from('workspace_invites')
        .insert({
          email: email,
          workspace_id: workspaceId,
          role: role,
          token: inviteToken,
          invited_by: workspace.owner_id,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
        });
    }

    // Send email via Postmark
    const inviterData = Array.isArray(workspace.users) ? workspace.users[0] : workspace.users;
    const inviterName = `${inviterData?.first_name || ''} ${inviterData?.last_name || ''}`.trim() || inviterData?.email;
    
    const emailTemplate = isNewUser ? {
      To: email,
      From: 'noreply@meet-sam.com',
      Subject: `You're invited to join ${workspace.name} on SAM AI`,
      HtmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
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
            This invitation was sent to ${email}. If you didn't expect this email, you can safely ignore it.
          </p>
        </div>
      `,
      MessageStream: 'outbound'
    } : {
      To: email,
      From: 'noreply@meet-sam.com',
      Subject: `You've been added to ${workspace.name} on SAM AI`,
      HtmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #7C3AED; margin: 0;">SAM AI</h1>
            <p style="color: #6B7280; margin: 5px 0;">AI-Powered Sales Assistant Platform</p>
          </div>
          
          <div style="background: #F0FDF4; padding: 30px; border-radius: 12px; margin-bottom: 30px;">
            <h2 style="color: #1F2937; margin-top: 0;">Welcome to the team! 🎉</h2>
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
            This email was sent to ${email} because you've been added to a SAM AI workspace.
          </p>
        </div>
      `,
      MessageStream: 'outbound'
    };

    await postmarkClient.sendEmail(emailTemplate);

    return NextResponse.json({ 
      success: true, 
      message: isNewUser ? 'Invitation sent successfully' : 'User added to workspace and notified' 
    });

  } catch (error) {
    console.error('Workspace invite error:', error);
    return NextResponse.json({ error: 'Failed to send invitation' }, { status: 500 });
  }
}