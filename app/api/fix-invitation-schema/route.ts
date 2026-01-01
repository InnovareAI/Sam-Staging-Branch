import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST() {
  const results = {
    timestamp: new Date().toISOString(),
    schema_fixes: [] as any[],
    success: false
  };

  try {
    // Fix 1: Change token column to TEXT type and make it nullable for compatibility
    const schemaFix1 = await supabase.rpc('exec_sql', {
      query: `ALTER TABLE workspace_invitations ALTER COLUMN token TYPE TEXT USING token::TEXT;`
    });

    results.schema_fixes.push({
      operation: 'Change token column to TEXT type',
      status: schemaFix1.error ? 'FAIL' : 'PASS',
      error: schemaFix1.error?.message
    });

    // Fix 2: Ensure all required columns exist
    const schemaFix2 = await supabase.rpc('exec_sql', {
      query: `
        ALTER TABLE workspace_invitations 
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
      `
    });

    results.schema_fixes.push({
      operation: 'Add updated_at column if missing',
      status: schemaFix2.error ? 'FAIL' : 'PASS',
      error: schemaFix2.error?.message
    });

    // Fix 3: Make company column nullable for backward compatibility
    const schemaFix3 = await supabase.rpc('exec_sql', {
      query: `ALTER TABLE workspace_invitations ALTER COLUMN company DROP NOT NULL;`
    });

    results.schema_fixes.push({
      operation: 'Make company column nullable',
      status: schemaFix3.error ? 'FAIL' : 'PASS',
      error: schemaFix3.error?.message
    });

    // Test: Try to insert a test invitation to verify schema works
    const testInvite = await supabase
      .from('workspace_invitations')
      .insert({
        workspace_id: 'c86ecbcf-a28d-445d-b030-485804c9255d',
        email: `schema-test-${Date.now()}@example.com`,
        role: 'member',
        token: `test_token_${Date.now()}`,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        invited_by: 'a948a612-9a42-41aa-84a9-d368d9090054'
      })
      .select()
      .single();

    results.schema_fixes.push({
      operation: 'Test invitation insertion',
      status: testInvite.error ? 'FAIL' : 'PASS',
      error: testInvite.error?.message,
      data: testInvite.data ? { id: testInvite.data.id } : null
    });

    // Clean up test data
    if (testInvite.data) {
      await supabase
        .from('workspace_invitations')
        .delete()
        .eq('id', testInvite.data.id);
    }

    const successCount = results.schema_fixes.filter(fix => fix.status === 'PASS').length;
    results.success = successCount === results.schema_fixes.length;

  } catch (error) {
    results.schema_fixes.push({
      operation: 'Schema fix execution',
      status: 'FAIL',
      error: (error as Error).message
    });
  }

  return NextResponse.json(results, {
    status: results.success ? 200 : 500
  });
}

export async function GET() {
  // Check current schema status
  const results = {
    timestamp: new Date().toISOString(),
    schema_status: {} as any
  };

  try {
    // Check if workspace_invitations table exists and get its structure
    const { data: tableInfo, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'workspace_invitations' 
        AND table_schema = 'public'
        ORDER BY ordinal_position;
      `
    });

    results.schema_status.table_structure = {
      exists: !error,
      columns: tableInfo,
      error: error?.message
    };

    // Test a simple query
    const { data: testData, error: queryError } = await supabase
      .from('workspace_invitations')
      .select('id, email, token, expires_at')
      .limit(1);

    results.schema_status.query_test = {
      status: queryError ? 'FAIL' : 'PASS',
      error: queryError?.message,
      sample_data: testData
    };

  } catch (error) {
    results.schema_status.error = (error as Error).message;
  }

  return NextResponse.json(results);
}