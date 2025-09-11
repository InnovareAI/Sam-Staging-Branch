import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { userIds } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'User IDs array is required and cannot be empty' },
        { status: 400 }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the request is from a super admin
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify the user making the request
    const { data: { user }, error: authError } = await adminSupabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 }
      );
    }

    // Check if the user is a super admin
    const superAdminEmails = ['tl@innovareai.com', 'cl@innovareai.com'];
    if (!superAdminEmails.includes(user.email?.toLowerCase() || '')) {
      return NextResponse.json(
        { error: 'Super admin access required' },
        { status: 403 }
      );
    }

    // First, check which users are super admins - they cannot be deleted
    const { data: usersToCheck, error: checkError } = await adminSupabase
      .from('users')
      .select('id, email, is_super_admin')
      .in('id', userIds);

    if (checkError) {
      console.error('Error checking users:', checkError);
      return NextResponse.json(
        { error: 'Failed to check user permissions', details: checkError.message },
        { status: 500 }
      );
    }

    // Filter out super admin users
    const superAdminUsers = usersToCheck?.filter(u => u.is_super_admin) || [];
    const deletableUserIds = userIds.filter(id => 
      !superAdminUsers.some(admin => admin.id === id)
    );

    if (superAdminUsers.length > 0) {
      console.warn('Attempted to delete super admin users:', superAdminUsers.map(u => u.email));
      if (deletableUserIds.length === 0) {
        return NextResponse.json(
          { error: 'Cannot delete super admin users' },
          { status: 400 }
        );
      }
    }

    let deletedCount = 0;
    const errors: string[] = [];

    // Delete each user (this will cascade to related tables due to foreign key constraints)
    for (const userId of deletableUserIds) {
      try {
        // Delete from auth.users table (this is the primary user record)
        const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(userId);
        
        if (deleteError) {
          console.error(`Failed to delete user ${userId}:`, deleteError);
          errors.push(`Failed to delete user ${userId}: ${deleteError.message}`);
        } else {
          deletedCount++;
          console.log(`Successfully deleted user ${userId}`);
        }
      } catch (error) {
        console.error(`Error deleting user ${userId}:`, error);
        errors.push(`Error deleting user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    const response: any = {
      success: true,
      deletedCount,
      totalRequested: userIds.length,
      superAdminSkipped: superAdminUsers.length
    };

    if (errors.length > 0) {
      response.errors = errors;
      response.partialSuccess = true;
    }

    if (superAdminUsers.length > 0) {
      response.skippedUsers = superAdminUsers.map(u => ({ id: u.id, email: u.email, reason: 'Super admin cannot be deleted' }));
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Delete users error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}