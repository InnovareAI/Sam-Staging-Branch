import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    // Get invite details
    const { data: invite, error: inviteError } = await supabase
      .from('workspace_invitations')
      .select('*')
      .eq('invite_token', token)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json({ error: 'Invalid invitation' }, { status: 404 });
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invitation expired' }, { status: 400 });
    }

    // Check if already accepted
    if (invite.accepted_at) {
      return NextResponse.json({ error: 'Invitation already accepted' }, { status: 400 });
    }

    // Get current user from request
    const authHeader = req.headers.get('Authorization');
    let currentUserId = null;
    
    if (authHeader) {
      const userClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      const token = authHeader.replace('Bearer ', '');
      await userClient.auth.setSession({ access_token: token, refresh_token: '' });
      
      const { data: { user } } = await userClient.auth.getUser();
      currentUserId = user?.id;
    }

    if (!currentUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check if user email matches invite
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('email')
      .eq('id', currentUserId)
      .single();

    if (userError || !user || user.email !== invite.email) {
      return NextResponse.json({ 
        error: 'User email does not match invitation' 
      }, { status: 403 });
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', invite.workspace_id)
      .eq('user_id', currentUserId)
      .single();

    if (existingMember) {
      return NextResponse.json({ error: 'Already a member of this workspace' }, { status: 400 });
    }

    // Add user to workspace
    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: invite.workspace_id,
        user_id: currentUserId,
        role: invite.role
      });

    if (memberError) {
      throw memberError;
    }

    // Mark invitation as accepted
    const { error: updateError } = await supabase
      .from('workspace_invitations')
      .update({ 
        accepted_at: new Date().toISOString(),
        accepted_by: currentUserId
      })
      .eq('id', invite.id);

    if (updateError) {
      console.error('Failed to mark invitation as accepted:', updateError);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Successfully joined workspace' 
    });

  } catch (error) {
    console.error('Invite acceptance error:', error);
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
  }
}