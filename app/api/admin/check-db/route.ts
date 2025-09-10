import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Use service role for admin access
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check auth users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('Auth users error:', authError);
    }

    // Check organizations table
    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select('*');

    if (orgError) {
      console.error('Organizations error:', orgError);
    }

    // Check users table
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*');

    if (usersError) {
      console.error('Users table error:', usersError);
    }

    // Check user_organizations table
    const { data: userOrgs, error: userOrgsError } = await supabase
      .from('user_organizations')
      .select('*');

    if (userOrgsError) {
      console.error('User organizations error:', userOrgsError);
    }

    return NextResponse.json({
      authUsers: authUsers?.users || [],
      organizations: organizations || [],
      users: users || [],
      userOrganizations: userOrgs || [],
      errors: {
        auth: authError?.message,
        organizations: orgError?.message,
        users: usersError?.message,
        userOrganizations: userOrgsError?.message,
      }
    });

  } catch (error) {
    console.error('Database check error:', error);
    return NextResponse.json(
      { error: 'Failed to check database' },
      { status: 500 }
    );
  }
}