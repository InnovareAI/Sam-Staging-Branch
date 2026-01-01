
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireAdmin } from '@/lib/security/route-auth';

export async function GET(request: NextRequest) {

  // Require admin authentication
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const poolKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    // Using pool from lib/db

    // Get table schemas
    const { data: tables, error: tablesError } = await pool
      .rpc('get_table_info', {});

    if (tablesError) {
      console.error('Tables error:', tablesError);
    }

    // Get organizations table schema
    const { data: orgsSchema, error: orgsError } = await pool
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'organizations')
      .eq('table_schema', 'public');

    // Get workspaces table schema  
    const { data: workspacesSchema, error: workspacesError } = await pool
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'workspaces')
      .eq('table_schema', 'public');

    return NextResponse.json({
      organizations_schema: orgsSchema,
      workspaces_schema: workspacesSchema,
      tables_info: tables,
      errors: {
        orgsError,
        workspacesError,
        tablesError
      }
    });

  } catch (error) {
    console.error('Schema check error:', error);
    return NextResponse.json({ error: 'Failed to check schema' }, { status: 500 });
  }
}
