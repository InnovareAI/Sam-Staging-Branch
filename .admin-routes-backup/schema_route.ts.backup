import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get table schemas
    const { data: tables, error: tablesError } = await supabaseAdmin
      .rpc('get_table_info', {});

    if (tablesError) {
      console.error('Tables error:', tablesError);
    }

    // Get organizations table schema
    const { data: orgsSchema, error: orgsError } = await supabaseAdmin
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'organizations')
      .eq('table_schema', 'public');

    // Get workspaces table schema  
    const { data: workspacesSchema, error: workspacesError } = await supabaseAdmin
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