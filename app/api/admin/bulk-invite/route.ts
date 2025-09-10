import { supabase, supabaseAdmin } from '../../../lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

interface InviteUser {
  email: string;
  firstName: string;
  lastName: string;
  role?: string;
}

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

    // Use shared Supabase clients
    const adminSupabase = supabaseAdmin();

    // Verify the requesting user is the super admin
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is super admin (Thorsten)
    if (user.email !== 'tl@innovareai.com') {
      return NextResponse.json(
        { error: 'Super admin access required' },
        { status: 403 }
      );
    }

    const { organizationId, users }: { organizationId: string; users: InviteUser[] } = await request.json();

    if (!organizationId || !users || !Array.isArray(users) || users.length === 0) {
      return NextResponse.json(
        { error: 'Organization ID and users array are required' },
        { status: 400 }
      );
    }

    // Verify organization exists
    const { data: org, error: orgError } = await adminSupabase
      .from('organizations')
      .select('id, name, slug')
      .eq('id', organizationId)
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    console.log(`Super admin ${user.email} inviting ${users.length} users to ${org.name}`);

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // Process each invitation
    for (const userData of users) {
      try {
        const { email, firstName, lastName, role = 'member' } = userData;

        if (!email || !firstName || !lastName) {
          results.push({
            email: email || 'unknown',
            status: 'error',
            error: 'Missing required fields (email, firstName, lastName)'
          });
          errorCount++;
          continue;
        }

        // Send invitation via Supabase Admin API
        const { data: inviteData, error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(email, {
          data: {
            first_name: firstName,
            last_name: lastName,
            invited_by: user.id,
            organization_id: organizationId,
            organization_name: org.name,
            role: role,
            invited_by_email: user.email
          },
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback?org=${org.slug}`
        });

        if (inviteError) {
          results.push({
            email,
            status: 'error',
            error: inviteError.message
          });
          errorCount++;
        } else {
          results.push({
            email,
            status: 'success',
            userId: inviteData.user?.id,
            invitedAt: inviteData.user?.invited_at
          });
          successCount++;
        }

      } catch (error) {
        results.push({
          email: userData.email || 'unknown',
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        errorCount++;
      }
    }

    return NextResponse.json({
      message: `Bulk invitation completed for ${org.name}`,
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug
      },
      summary: {
        total: users.length,
        successful: successCount,
        errors: errorCount
      },
      results
    });

  } catch (error) {
    console.error('Server error in bulk invitation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}