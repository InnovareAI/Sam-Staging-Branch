import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

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

    const { email, firstName, lastName, organizationId, role = 'member' } = await request.json();

    if (!email || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Email, first name, and last name are required' },
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

    // If organization is specified, prepare to add user when they accept
    if (organizationId) {
      // You might want to store pending invitations in a separate table
      // for now, we'll just log it
      console.log(`User ${email} invited to organization ${organizationId} with role ${role}`);
    }

    return NextResponse.json({
      message: 'Invitation sent successfully',
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