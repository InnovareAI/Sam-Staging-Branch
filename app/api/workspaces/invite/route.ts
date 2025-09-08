import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendEmail, createWorkspaceInvitationEmail } from '@/lib/postmark';

// POST /api/workspaces/invite - Create workspace invitation
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { workspace_id, email, role } = body;

    if (!workspace_id || !email || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: workspace_id, email, role' }, 
        { status: 400 }
      );
    }

    if (!['admin', 'member', 'viewer'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be admin, member, or viewer' }, 
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();
    
    // Use the stored function to create invitation
    const { data, error } = await supabase.rpc('create_workspace_invitation', {
      p_workspace_id: workspace_id,
      p_email: email,
      p_role: role,
      p_invited_by_clerk_id: userId
    });

    if (error) {
      console.error('Error creating invitation:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data.success) {
      return NextResponse.json({ error: data.error }, { status: 400 });
    }

    const inviteUrl = `${req.nextUrl.origin}/invite/${data.invite_token}`;

    // Get workspace and inviter details for email
    const { data: workspaceData } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', workspace_id)
      .single();

    const { data: inviterData } = await supabase
      .from('users')
      .select('first_name, last_name, email')
      .eq('clerk_id', userId)
      .single();

    // Send invitation email
    const inviterName = inviterData?.first_name && inviterData?.last_name 
      ? `${inviterData.first_name} ${inviterData.last_name}`
      : inviterData?.email || 'A team member';

    const emailData = createWorkspaceInvitationEmail({
      inviterName,
      workspaceName: workspaceData?.name || 'SAM AI Workspace',
      inviteUrl,
      role,
      expiresAt: data.expires_at
    });

    const emailResult = await sendEmail({
      to: email,
      subject: `You're invited to join ${workspaceData?.name || 'SAM AI'} workspace`,
      htmlBody: emailData.htmlBody,
      textBody: emailData.textBody
    });

    if (!emailResult.success) {
      console.error('Failed to send invitation email:', emailResult.error);
      // Still return success for invitation creation even if email fails
    }

    return NextResponse.json({ 
      success: true, 
      invitation: data,
      invite_url: inviteUrl,
      email_sent: emailResult.success
    });

  } catch (error) {
    console.error('Invitation creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

// GET /api/workspaces/invite?workspace_id=... - List workspace invitations
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Missing workspace_id parameter' }, 
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();
    
    // Check if user has permission to view invitations
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', (
        await supabase
          .from('users')
          .select('id')
          .eq('clerk_id', userId)
          .single()
      ).data?.id)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get pending invitations
    const { data: invitations, error } = await supabase
      .from('workspace_invitations')
      .select(`
        id,
        email,
        role,
        expires_at,
        created_at,
        accepted_at,
        invited_by:users!workspace_invitations_invited_by_fkey(first_name, last_name, email)
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invitations:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ invitations });

  } catch (error) {
    console.error('Error fetching invitations:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}