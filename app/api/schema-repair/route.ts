import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST() {
  const results = {
    timestamp: new Date().toISOString(),
    repairs: [] as any[],
    success: false
  };

  try {
    // Step 1: Add missing token column as TEXT
    try {
      await supabase.from('workspace_invitations').select('token').limit(1);
    } catch (error) {
      // Column doesn't exist, add it
      const { error: alterError } = await supabase.rpc('sql', {
        query: 'ALTER TABLE workspace_invitations ADD COLUMN token TEXT;'
      });
      
      results.repairs.push({
        step: 'Add token column',
        status: alterError ? 'FAIL' : 'PASS',
        error: alterError?.message
      });
    }

    // Step 2: Add updated_at column if missing
    try {
      await supabase.from('workspace_invitations').select('updated_at').limit(1);
    } catch (error) {
      // Column doesn't exist, add it
      const { error: alterError } = await supabase.rpc('sql', {
        query: 'ALTER TABLE workspace_invitations ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();'
      });
      
      results.repairs.push({
        step: 'Add updated_at column',
        status: alterError ? 'FAIL' : 'PASS',
        error: alterError?.message
      });
    }

    // Step 3: Make company column nullable
    const { error: companyError } = await supabase.rpc('sql', {
      query: 'ALTER TABLE workspace_invitations ALTER COLUMN company DROP NOT NULL;'
    });
    
    results.repairs.push({
      step: 'Make company column nullable',
      status: companyError ? 'FAIL' : 'PASS',
      error: companyError?.message
    });

    // Step 4: Test the schema by doing a query
    const { data: testData, error: testError } = await supabase
      .from('workspace_invitations')
      .select('id, email, token, expires_at, company, updated_at')
      .limit(1);

    results.repairs.push({
      step: 'Test schema integrity',
      status: testError ? 'FAIL' : 'PASS',
      error: testError?.message,
      data: testData
    });

    results.success = results.repairs.filter(r => r.status === 'PASS').length === results.repairs.length;

  } catch (error) {
    results.repairs.push({
      step: 'Schema repair process',
      status: 'FAIL',
      error: (error as Error).message
    });
  }

  return NextResponse.json(results, {
    status: results.success ? 200 : 500
  });
}

export async function GET() {
  // Verify current schema
  const results = {
    timestamp: new Date().toISOString(),
    schema_check: {} as any
  };

  // Test 1: Check if we can query basic fields
  try {
    const { data, error } = await supabase
      .from('workspace_invitations')
      .select('id, email, role, expires_at, invited_by, accepted_at, created_at')
      .limit(1);

    results.schema_check.basic_fields = {
      status: error ? 'FAIL' : 'PASS',
      error: error?.message,
      data
    };
  } catch (error) {
    results.schema_check.basic_fields = {
      status: 'FAIL',
      error: (error as Error).message
    };
  }

  // Test 2: Check if we can query extended fields
  try {
    const { data, error } = await supabase
      .from('workspace_invitations')
      .select('id, token, company, updated_at')
      .limit(1);

    results.schema_check.extended_fields = {
      status: error ? 'FAIL' : 'PASS',
      error: error?.message,
      data
    };
  } catch (error) {
    results.schema_check.extended_fields = {
      status: 'FAIL',
      error: (error as Error).message
    };
  }

  // Test 3: Try to insert a test record
  try {
    const testEmail = `schema-test-${Date.now()}@example.com`;
    const testToken = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const { data, error } = await supabase
      .from('workspace_invitations')
      .insert({
        workspace_id: 'c86ecbcf-a28d-445d-b030-485804c9255d',
        email: testEmail,
        role: 'member',
        token: testToken,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        invited_by: 'a948a612-9a42-41aa-84a9-d368d9090054'
      })
      .select()
      .single();

    results.schema_check.insert_test = {
      status: error ? 'FAIL' : 'PASS',
      error: error?.message,
      data: data ? { id: data.id, email: data.email, token: data.token } : null
    };

    // Clean up test data
    if (data) {
      await supabase
        .from('workspace_invitations')
        .delete()
        .eq('id', data.id);
    }

  } catch (error) {
    results.schema_check.insert_test = {
      status: 'FAIL',
      error: (error as Error).message
    };
  }

  return NextResponse.json(results);
}