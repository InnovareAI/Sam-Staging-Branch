
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security/route-auth';

export async function DELETE(request: NextRequest) {

  // Require admin authentication
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;
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
    let superAdminUserIds: string[] = [];
    
    try {
      // Get user details from auth.users to check for super admin emails
      const { data: authUsers, error: authError } = await adminSupabase.auth.admin.listUsers();
      
      if (authError) {
        throw authError;
      }

      // Find super admin users by email
      const superAdminUsers = authUsers?.users?.filter((authUser: any) => 
        superAdminEmails.includes(authUser.email?.toLowerCase() || '')
      ) || [];
      
      superAdminUserIds = superAdminUsers.map(u => u.id);
      
    } catch (checkError) {
      console.error('Error checking users:', checkError);
      return NextResponse.json(
        { error: 'Failed to check user permissions', details: checkError instanceof Error ? checkError.message : 'Unknown error' },
        { status: 500 }
      );
    }

    // Filter out super admin users from deletion list
    const deletableUserIds = userIds.filter(id => 
      !superAdminUserIds.includes(id)
    );

    if (superAdminUserIds.length > 0) {
      const protectedCount = userIds.length - deletableUserIds.length;
      console.warn(`Attempted to delete ${protectedCount} super admin users`);
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

    const protectedCount = userIds.length - deletableUserIds.length;
    const response: any = {
      success: true,
      deletedCount,
      totalRequested: userIds.length,
      superAdminSkipped: protectedCount
    };

    if (errors.length > 0) {
      response.errors = errors;
      response.partialSuccess = true;
    }

    if (protectedCount > 0) {
      response.skippedUsers = userIds
        .filter(id => !deletableUserIds.includes(id))
        .map(id => ({ 
          id, 
          reason: 'Super admin cannot be deleted' 
        }));
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
