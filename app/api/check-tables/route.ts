import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const results = {
    timestamp: new Date().toISOString(),
    table_checks: {} as any
  };

  const tablesToCheck = [
    'workspace_invites',
    'workspace_invitations',
    'workspaces',
    'workspace_members',
    'users'
  ];

  for (const tableName of tablesToCheck) {
    try {
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact' })
        .limit(1);

      results.table_checks[tableName] = {
        exists: !error,
        error: error?.message,
        record_count: count || 0,
        sample_data: data
      };
    } catch (error) {
      results.table_checks[tableName] = {
        exists: false,
        error: (error as Error).message,
        record_count: 0
      };
    }
  }

  return NextResponse.json(results);
}

export async function POST() {
  // Create the missing workspace_invites table if it doesn't exist
  const results = {
    timestamp: new Date().toISOString(),
    table_creation: {} as any,
    success: false
  };

  try {
    // First check if workspace_invites exists
    const { error: checkError } = await supabase
      .from('workspace_invites')
      .select('id')
      .limit(1);

    if (checkError && checkError.message.includes('does not exist')) {
      // Create the table by inserting a test record (this will fail but show us the schema)
      // Actually, let's create it properly
      
      // Since we can't execute DDL directly, let's work with what we have
      // Check if workspace_invitations exists and use it instead
      const { error: altCheckError } = await supabase
        .from('workspace_invitations')
        .select('id')
        .limit(1);

      if (!altCheckError) {
        results.table_creation.recommendation = 'Use workspace_invitations table (exists) instead of workspace_invites';
        results.table_creation.action = 'Update code to use workspace_invitations';
        results.success = true;
      } else {
        results.table_creation.error = 'Neither workspace_invites nor workspace_invitations table exists';
        results.success = false;
      }
    } else {
      results.table_creation.status = 'workspace_invites table already exists';
      results.success = true;
    }

  } catch (error) {
    results.table_creation.error = (error as Error).message;
  }

  return NextResponse.json(results, {
    status: results.success ? 200 : 500
  });
}