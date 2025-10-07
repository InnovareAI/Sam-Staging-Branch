
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security/route-auth';

// Super admin emails
const SUPER_ADMIN_EMAILS = ['tl@innovareai.com', 'cl@innovareai.com'];

export async function GET(request: NextRequest) {

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

    // Fetch all users from auth.users (only super admin can see this)
    const { data: users, error: usersError } = await adminSupabase.auth.admin.listUsers();

    if (usersError) {
      console.error('Failed to fetch users:', usersError);
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    }

    // Get workspace memberships for each user
    const { data: memberships } = await adminSupabase
      .from('workspace_members')
      .select(`
        user_id,
        role,
        workspace_id,
        joined_at,
        workspaces (
          name,
          slug
        )
      `);

    // Get workspace invitations
    const { data: invitations } = await adminSupabase
      .from('workspace_invitations')
      .select(`
        email,
        role,
        expires_at,
        accepted_at,
        created_at,
        workspaces (
          name
        )
      `)
      .is('accepted_at', null);

    // Create membership map
    const membershipMap = new Map();
    memberships?.forEach(membership => {
      if (!membershipMap.has(membership.user_id)) {
        membershipMap.set(membership.user_id, []);
      }
      membershipMap.get(membership.user_id).push(membership);
    });

    // Create invitation map by email
    const invitationMap = new Map();
    invitations?.forEach(invitation => {
      if (!invitationMap.has(invitation.email)) {
        invitationMap.set(invitation.email, []);
      }
      invitationMap.get(invitation.email).push(invitation);
    });

    // Enrich users with membership and invitation data
    const enrichedUsers = users.users.map(u => ({
      id: u.id,
      email: u.email,
      phone: u.phone,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      email_confirmed_at: u.email_confirmed_at,
      user_metadata: u.user_metadata,
      memberships: membershipMap.get(u.id) || [],
      pending_invitations: invitationMap.get(u.email) || [],
      is_super_admin: SUPER_ADMIN_EMAILS.includes(u.email?.toLowerCase() || '')
    }));

    return NextResponse.json({
      users: enrichedUsers,
      total: enrichedUsers.length,
      stats: {
        total_users: enrichedUsers.length,
        active_users: enrichedUsers.filter(u => u.last_sign_in_at).length,
        pending_invitations: invitations?.length || 0,
        super_admins: enrichedUsers.filter(u => u.is_super_admin).length
      }
    });

  } catch (error) {
    console.error('Server error fetching users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
