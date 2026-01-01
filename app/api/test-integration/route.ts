import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { ServerClient } from 'postmark';

export async function GET() {
  const results = {
    timestamp: new Date().toISOString(),
    tests: {} as any,
    summary: {
      passed: 0,
      failed: 0,
      total: 0
    }
  };

  // Test 1: Database Connectivity
  try {
    const { data: workspaces, error } = await supabase
      .from('workspaces')
      .select('id, name, slug')
      .limit(5);
    
    results.tests.database_connectivity = {
      status: error ? 'FAIL' : 'PASS',
      data: workspaces,
      error: error?.message,
      workspaces_count: workspaces?.length || 0
    };
    if (!error) results.summary.passed++;
    else results.summary.failed++;
  } catch (error) {
    results.tests.database_connectivity = {
      status: 'FAIL',
      error: (error as Error).message
    };
    results.summary.failed++;
  }

  // Test 2: Invitation Table Schema
  try {
    const { data: invitations, error } = await supabase
      .from('workspace_invitations')
      .select('*')
      .limit(1);
    
    results.tests.invitation_schema = {
      status: error ? 'FAIL' : 'PASS',
      table_exists: !error,
      error: error?.message,
      sample_count: invitations?.length || 0
    };
    if (!error) results.summary.passed++;
    else results.summary.failed++;
  } catch (error) {
    results.tests.invitation_schema = {
      status: 'FAIL',
      error: (error as Error).message
    };
    results.summary.failed++;
  }

  // Test 3: Workspace Members Table
  try {
    const { data: members, error } = await supabase
      .from('workspace_members')
      .select('*')
      .limit(1);
    
    results.tests.workspace_members_schema = {
      status: error ? 'FAIL' : 'PASS',
      table_exists: !error,
      error: error?.message,
      sample_count: members?.length || 0
    };
    if (!error) results.summary.passed++;
    else results.summary.failed++;
  } catch (error) {
    results.tests.workspace_members_schema = {
      status: 'FAIL',
      error: (error as Error).message
    };
    results.summary.failed++;
  }

  // Test 4: InnovareAI Postmark Configuration
  try {
    const postmarkClient = new ServerClient(process.env.POSTMARK_INNOVAREAI_API_KEY!);
    const serverInfo = await postmarkClient.getServer();
    
    results.tests.innovareai_postmark = {
      status: 'PASS',
      server_name: serverInfo.Name,
      server_id: serverInfo.ID,
      bounce_hook_url: serverInfo.BounceHookUrl,
      inbound_hook_url: serverInfo.InboundHookUrl
    };
    results.summary.passed++;
  } catch (error) {
    results.tests.innovareai_postmark = {
      status: 'FAIL',
      error: (error as Error).message
    };
    results.summary.failed++;
  }

  // Test 5: 3CubedAI Postmark Configuration  
  try {
    const postmarkClient = new ServerClient(process.env.POSTMARK_3CUBEDAI_API_KEY!);
    const serverInfo = await postmarkClient.getServer();
    
    results.tests.cubedai_postmark = {
      status: 'PASS',
      server_name: serverInfo.Name,
      server_id: serverInfo.ID,
      bounce_hook_url: serverInfo.BounceHookUrl,
      inbound_hook_url: serverInfo.InboundHookUrl
    };
    results.summary.passed++;
  } catch (error) {
    results.tests.cubedai_postmark = {
      status: 'FAIL',
      error: (error as Error).message
    };
    results.summary.failed++;
  }

  // Test 6: Environment Variables
  const envVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'POSTMARK_INNOVAREAI_API_KEY',
    'POSTMARK_3CUBEDAI_API_KEY',
    'NEXT_PUBLIC_SITE_URL'
  ];

  const missingEnvVars = envVars.filter(varName => !process.env[varName]);
  
  results.tests.environment_variables = {
    status: missingEnvVars.length === 0 ? 'PASS' : 'FAIL',
    missing_variables: missingEnvVars,
    configured_variables: envVars.filter(varName => !!process.env[varName])
  };

  if (missingEnvVars.length === 0) results.summary.passed++;
  else results.summary.failed++;

  results.summary.total = results.summary.passed + results.summary.failed;

  return NextResponse.json(results, { 
    status: results.summary.failed === 0 ? 200 : 500 
  });
}

export async function POST(req: NextRequest) {
  const { test_type } = await req.json();
  
  if (test_type === 'full_invitation_flow') {
    return await testFullInvitationFlow();
  }

  return NextResponse.json({ error: 'Invalid test type' }, { status: 400 });
}

async function testFullInvitationFlow() {
  const testResults = {
    timestamp: new Date().toISOString(),
    test_name: 'Full Invitation Flow',
    steps: [] as any[],
    success: false
  };

  try {
    // Step 1: Get a test workspace
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id, name, owner_id')
      .limit(1);

    if (!workspaces || workspaces.length === 0) {
      throw new Error('No test workspace available');
    }

    const workspace = workspaces[0];
    testResults.steps.push({
      step: 1,
      description: 'Get test workspace',
      status: 'PASS',
      data: { workspace_id: workspace.id, workspace_name: workspace.name }
    });

    // Step 2: Test invitation creation
    const testEmail = `test-${Date.now()}@example.com`;
    const inviteToken = `invite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const { data: inviteData, error: inviteError } = await supabase
      .from('workspace_invitations')
      .insert({
        email: testEmail,
        workspace_id: workspace.id,
        role: 'member',
        invite_token: inviteToken,
        invited_by: workspace.owner_id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        company: 'InnovareAI'
      })
      .select()
      .single();

    if (inviteError) {
      testResults.steps.push({
        step: 2,
        description: 'Create invitation',
        status: 'FAIL',
        error: inviteError.message
      });
      throw inviteError;
    }

    testResults.steps.push({
      step: 2,
      description: 'Create invitation',
      status: 'PASS',
      data: { invitation_id: inviteData.id, token: inviteToken }
    });

    // Step 3: Verify invitation exists
    const { data: savedInvite, error: fetchError } = await supabase
      .from('workspace_invitations')
      .select('*')
      .eq('invite_token', inviteToken)
      .single();

    if (fetchError) {
      testResults.steps.push({
        step: 3,
        description: 'Verify invitation exists',
        status: 'FAIL',
        error: fetchError.message
      });
      throw fetchError;
    }

    testResults.steps.push({
      step: 3,
      description: 'Verify invitation exists',
      status: 'PASS',
      data: { invitation_found: true, email: savedInvite.email }
    });

    // Step 4: Clean up test data
    await supabase
      .from('workspace_invitations')
      .delete()
      .eq('id', inviteData.id);

    testResults.steps.push({
      step: 4,
      description: 'Clean up test data',
      status: 'PASS',
      data: { cleanup_complete: true }
    });

    testResults.success = true;

  } catch (error) {
    testResults.success = false;
    testResults.steps.push({
      step: 'error',
      description: 'Test failed',
      status: 'FAIL',
      error: (error as Error).message
    });
  }

  return NextResponse.json(testResults, {
    status: testResults.success ? 200 : 500
  });
}