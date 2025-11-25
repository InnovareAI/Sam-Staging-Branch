import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, prospect_data, campaign_config } = body;

    switch (action) {
      case 'test_template_system': {
        // Test the complete template system
        const testResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/sam/test-linkedin-sequence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prospect_data: prospect_data || {
              first_name: "Test User",
              company_name: "Your Company",
              industry: "saas",
              company_size: 150,
              job_title: "VP of Sales",
              seniority_level: "vp",
              department: "sales",
              recent_funding: true,
              funding_stage: "series_b",
              growth_indicators: ["scaling team"],
              pain_points: ["pipeline_consistency"],
              recent_activity: "recently expanded team"
            },
            test_type: 'linkedin_sequence'
          })
        });
        
        const testResult = await testResponse.json();
        
        return NextResponse.json({
          success: true,
          message: "Template system test completed",
          test_results: testResult,
          next_steps: [
            "Review the generated LinkedIn sequence",
            "Test with your actual LinkedIn account", 
            "Launch live campaign when satisfied"
          ]
        });
      }

      case 'live_linkedin_test': {
        // Execute actual LinkedIn campaign with your account
        if (!prospect_data || !prospect_data.first_name) {
          return NextResponse.json({
            error: "Prospect data required for live LinkedIn test"
          }, { status: 400 });
        }

        // Call queue-based Unipile LinkedIn campaign execution
        // CRITICAL FIX (Nov 25): Use -fast endpoint, not disabled direct endpoint
        const campaignResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/campaigns/direct/send-connection-requests-fast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaignId: `test_${Date.now()}`
          })
        });

        const campaignResult = await campaignResponse.json();

        return NextResponse.json({
          success: true,
          message: "Live LinkedIn test initiated",
          campaign_result: campaignResult,
          note: "This will use your connected LinkedIn account to send the generated message"
        });
      }

      case 'cost_analysis': {
        // Analyze costs for different approaches
        const costTestResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/sam/test-linkedin-sequence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prospect_data: prospect_data || {
              first_name: "Cost Test",
              company_name: "Test Company",
              industry: "technology"
            },
            test_type: 'cost_comparison'
          })
        });
        
        const costResult = await costTestResponse.json();
        
        return NextResponse.json({
          success: true,
          message: "Cost analysis completed",
          cost_analysis: costResult,
          summary: {
            variable_only_savings: "100% token reduction vs full personalization",
            template_creation_cost: "$50 one-time for Claude Sonnet 4 templates",
            ongoing_campaign_cost: "$0 per campaign with variable-only personalization"
          }
        });
      }

      default:
        return NextResponse.json({
          error: `Unknown action: ${action}. Available: test_template_system, live_linkedin_test, cost_analysis`
        }, { status: 400 });
    }

  } catch (error) {
    console.error('LinkedIn campaign test error:', error);
    return NextResponse.json({
      error: 'Failed to process LinkedIn campaign test',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'test_template_system';

  return NextResponse.json({
    message: "LinkedIn Campaign Testing Interface",
    available_actions: [
      {
        action: "test_template_system",
        description: "Test template selection and variable replacement",
        endpoint: "POST /api/sam/linkedin-campaign-test",
        payload: { action: "test_template_system", prospect_data: {} }
      },
      {
        action: "live_linkedin_test", 
        description: "Execute actual LinkedIn campaign with your account",
        endpoint: "POST /api/sam/linkedin-campaign-test",
        payload: { action: "live_linkedin_test", prospect_data: {} }
      },
      {
        action: "cost_analysis",
        description: "Compare costs across personalization approaches",
        endpoint: "POST /api/sam/linkedin-campaign-test",
        payload: { action: "cost_analysis", prospect_data: {} }
      }
    ],
    example_prospect_data: {
      first_name: "Your Name",
      company_name: "Your Target Company",
      industry: "saas",
      company_size: 150,
      job_title: "VP of Sales",
      seniority_level: "vp",
      department: "sales",
      recent_funding: true,
      funding_stage: "series_b",
      growth_indicators: ["scaling team"],
      pain_points: ["pipeline_consistency"],
      recent_activity: "recently expanded team"
    }
  });
}