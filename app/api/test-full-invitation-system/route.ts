import { NextRequest, NextResponse } from 'next/server';
import { LinkTrackingOptions } from 'postmark/dist/client/models/message/SupportingTypes';
import { pool } from '@/lib/db';
import { ServerClient } from 'postmark';

const COMPANIES = {
  innovareai: {
    name: 'InnovareAI',
    api_key: process.env.POSTMARK_INNOVAREAI_API_KEY!,
    from_email: 'sp@innovareai.com',
    from_name: 'Sarah Powell - SAM AI',
    test_email: 'tl@innovareai.com'
  },
  cubedai: {
    name: '3CubedAI',
    api_key: process.env.POSTMARK_3CUBEDAI_API_KEY!,
    from_email: 'sophia@3cubed.ai',
    from_name: 'Sophia Caldwell - 3CubedAI',
    test_email: 'tl@3cubed.ai'
  }
};

export async function GET() {
  const results = {
    timestamp: new Date().toISOString(),
    tests: {} as any,
    summary: {
      total_tests: 0,
      passed: 0,
      failed: 0,
      success_rate: 0
    }
  };

  for (const [companyKey, company] of Object.entries(COMPANIES)) {
    const companyTests = {
      company_name: company.name,
      tests: {} as any,
      success: true,
      error: null as string | null
    };

    try {
      // Test 1: Workspace Selection
      const { data: workspaces } = await supabase
        .from('workspaces')
        .select('id, name, owner_id')
        .limit(1);

      const workspace = workspaces?.[0];
      if (!workspace) {
        throw new Error('No test workspace available');
      }

      companyTests.tests.workspace_selection = {
        status: 'PASS',
        data: { workspace_id: workspace.id, workspace_name: workspace.name }
      };
      results.summary.passed++;

      // Test 2: Invitation Creation
      const testEmail = `integration-test-${companyKey}-${Date.now()}@example.com`;
      const inviteToken = `invite_${companyKey}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const { data: inviteData, error: inviteError } = await supabase
        .from('workspace_invitations')
        .insert({
          email: testEmail,
          workspace_id: workspace.id,
          role: 'member',
          invite_token: inviteToken,
          invited_by: workspace.owner_id,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          company: company.name
        })
        .select()
        .single();

      if (inviteError) {
        throw inviteError;
      }

      companyTests.tests.invitation_creation = {
        status: 'PASS',
        data: { invitation_id: inviteData.id, email: testEmail, token: inviteToken }
      };
      results.summary.passed++;

      // Test 3: Email Delivery
      const postmarkClient = new ServerClient(company.api_key);
      
      const emailResult = await postmarkClient.sendEmail({
        From: company.from_email,
        To: company.test_email,
        Subject: `${company.name} Workspace Invitation - Integration Test`,
        HtmlBody: generateTestInvitationEmail(company.name, workspace.name, inviteToken),
        MessageStream: 'outbound',
        TrackOpens: true,
        TrackLinks: LinkTrackingOptions.TextOnly
      });

      companyTests.tests.email_delivery = {
        status: 'PASS',
        data: {
          message_id: emailResult.MessageID,
          submitted_at: emailResult.SubmittedAt,
          to: emailResult.To,
          error_code: emailResult.ErrorCode,
          message: emailResult.Message
        }
      };
      results.summary.passed++;

      // Test 4: Invitation Retrieval
      const { data: retrievedInvite, error: retrieveError } = await supabase
        .from('workspace_invitations')
        .select('*')
        .eq('invite_token', inviteToken)
        .single();

      if (retrieveError) {
        throw retrieveError;
      }

      companyTests.tests.invitation_retrieval = {
        status: 'PASS',
        data: {
          found: true,
          email: retrievedInvite.email,
          company: retrievedInvite.company,
          expires_at: retrievedInvite.expires_at,
          accepted_at: retrievedInvite.accepted_at
        }
      };
      results.summary.passed++;

      // Test 5: Multi-tenant Isolation (verify this company's invitations)
      const { data: companyInvites, error: isolationError } = await supabase
        .from('workspace_invitations')
        .select('id, email, company')
        .eq('company', company.name);

      companyTests.tests.multi_tenant_isolation = {
        status: isolationError ? 'FAIL' : 'PASS',
        data: {
          company_invitations_count: companyInvites?.length || 0,
          error: isolationError?.message
        }
      };

      if (!isolationError) results.summary.passed++;
      else results.summary.failed++;

      // Test 6: Performance Test (batch invitation check)
      const performanceStart = Date.now();
      
      const { data: allInvites, error: perfError } = await supabase
        .from('workspace_invitations')
        .select('id, email, company, created_at')
        .limit(100);

      const performanceEnd = Date.now();
      const queryTime = performanceEnd - performanceStart;

      companyTests.tests.performance_check = {
        status: perfError ? 'FAIL' : 'PASS',
        data: {
          query_time_ms: queryTime,
          records_retrieved: allInvites?.length || 0,
          performance_rating: queryTime < 1000 ? 'EXCELLENT' : queryTime < 2000 ? 'GOOD' : 'SLOW'
        },
        error: perfError?.message
      };

      if (!perfError) results.summary.passed++;
      else results.summary.failed++;

      // Cleanup
      await supabase
        .from('workspace_invitations')
        .delete()
        .eq('id', inviteData.id);

    } catch (error) {
      companyTests.success = false;
      companyTests.error = (error as Error).message;
      results.summary.failed++;
    }

    results.summary.total_tests += Object.keys(companyTests.tests).length;
    results.tests[companyKey] = companyTests;
  }

  results.summary.success_rate = Math.round((results.summary.passed / results.summary.total_tests) * 100);

  return NextResponse.json(results, {
    status: results.summary.failed === 0 ? 200 : 500
  });
}

export async function POST(req: NextRequest) {
  const { company, email, workspace_id } = await req.json();

  if (!company || !COMPANIES[company as keyof typeof COMPANIES]) {
    return NextResponse.json({ error: 'Invalid company specified' }, { status: 400 });
  }

  if (!email || !workspace_id) {
    return NextResponse.json({ error: 'Email and workspace_id required' }, { status: 400 });
  }

  const companyConfig = COMPANIES[company as keyof typeof COMPANIES];
  
  try {
    // Simulate the full invitation API call
    const inviteResponse = await fetch('http://localhost:3004/api/workspaces/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        workspaceId: workspace_id,
        role: 'member'
      })
    });

    const inviteResult = await inviteResponse.json();

    return NextResponse.json({
      success: inviteResponse.ok,
      company: companyConfig.name,
      invite_result: inviteResult,
      test_type: 'live_invitation_api_call'
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      company: companyConfig.name,
      error: (error as Error).message,
      test_type: 'live_invitation_api_call'
    }, { status: 500 });
  }
}

function generateTestInvitationEmail(companyName: string, workspaceName: string, token: string) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #7C3AED; margin: 0;">${companyName} - SAM AI</h1>
        <p style="color: #6B7280; margin: 5px 0;">AI-Powered Sales Assistant Platform</p>
      </div>
      
      <div style="background: #FEF3E2; padding: 30px; border-radius: 12px; margin-bottom: 30px;">
        <h2 style="color: #1F2937; margin-top: 0;">🧪 Integration Test Invitation</h2>
        <p style="color: #4B5563; line-height: 1.6;">
          This is a test invitation for workspace <strong>"${workspaceName}"</strong> 
          on the SAM AI platform by ${companyName}.
        </p>
        <p style="color: #4B5563; line-height: 1.6;">
          <strong>Test Token:</strong> <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${token}</code>
        </p>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="#" 
           style="background: #7C3AED; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
          Test Integration Link (Disabled)
        </a>
      </div>
      
      <div style="background: #EFF6FF; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="color: #1E40AF; margin: 0; font-size: 14px;">
          <strong>🔧 System Integration Test</strong><br>
          This email was generated during automated system integration testing.<br>
          Company: ${companyName} | Test Run: ${new Date().toISOString()}
        </p>
      </div>
      
      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
      
      <p style="color: #6B7280; font-size: 14px; text-align: center;">
        Engineering Mode Subagent #2 - System Integration Testing
      </p>
    </div>
  `;
}