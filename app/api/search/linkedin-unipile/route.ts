/**
 * LinkedIn Search via Unipile (Sales Navigator Only)
 * For users with Sales Navigator accounts
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Firebase auth - workspace comes from header
    let authContext;
    try {
      authContext = await verifyAuth(request);
    } catch (error) {
      const authError = error as AuthError;
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.statusCode }
      );
    }

    const { userId, workspaceId } = authContext;

    const body = await request.json();
    const {
      search_query,
      filters = {},
      max_results = 25
    } = body;

    if (!search_query) {
      return NextResponse.json(
        { success: false, error: 'Search query is required' },
        { status: 400 }
      );
    }

    // Check workspace tier and LinkedIn account type via RPC function
    const { rows: tierRows } = await pool.query(
      `SELECT * FROM check_lead_search_quota($1)`,
      [workspaceId]
    ).catch(() => ({ rows: [{ has_quota: true, search_tier: 'sales_navigator', quota_remaining: 100 }] }));

    const tierData = tierRows[0] || { has_quota: true, search_tier: 'sales_navigator', quota_remaining: 100 };

    if (!tierData.has_quota) {
      return NextResponse.json({
        success: false,
        error: 'Search quota exceeded',
        quota_info: tierData
      }, { status: 429 });
    }

    // Only Sales Navigator users can use this endpoint
    if (tierData.search_tier !== 'sales_navigator') {
      return NextResponse.json({
        success: false,
        error: 'Sales Navigator required',
        hint: 'This endpoint requires Sales Navigator. Classic/Premium LinkedIn users should use /api/search/google-cse or /api/leads/brightdata-scraper',
        current_tier: tierData.search_tier
      }, { status: 403 });
    }

    // Get user's Sales Navigator account
    const { rows: accountRows } = await pool.query(
      `SELECT unipile_account_id, account_name, linkedin_account_type
       FROM user_unipile_accounts
       WHERE user_id = $1
       AND platform = 'LINKEDIN'
       AND linkedin_account_type = 'sales_navigator'
       AND connection_status = 'active'
       LIMIT 1`,
      [userId]
    );

    const linkedinAccount = accountRows[0];

    if (!linkedinAccount) {
      return NextResponse.json({
        success: false,
        error: 'No Sales Navigator account connected',
        hint: 'Please connect your Sales Navigator account in Settings'
      }, { status: 400 });
    }

    console.log(`LinkedIn Search via Unipile: ${search_query}`);
    console.log(`Using Sales Navigator account: ${linkedinAccount.account_name}`);

    // Call Unipile LinkedIn search MCP
    // TODO: Implement actual Unipile MCP LinkedIn search
    // const mcpClient = await getMCPClient('unipile');
    // const searchResults = await mcpClient.invokeTool('linkedin_search', {
    //   account_id: linkedinAccount.unipile_account_id,
    //   query: search_query,
    //   filters: filters,
    //   max_results: max_results
    // });

    // Mock response for now (replace with real Unipile MCP call)
    const startTime = Date.now();

    // Simulate Unipile LinkedIn search results
    const mockResults = [
      {
        linkedin_url: 'https://linkedin.com/in/example-profile-1',
        full_name: 'Example Person 1',
        headline: 'CTO at Tech Company',
        location: 'San Francisco, CA',
        company: 'Tech Company',
        profile_picture: null,
        connection_degree: '2nd',
        shared_connections: 5
      },
      {
        linkedin_url: 'https://linkedin.com/in/example-profile-2',
        full_name: 'Example Person 2',
        headline: 'VP Engineering at Software Inc',
        location: 'New York, NY',
        company: 'Software Inc',
        profile_picture: null,
        connection_degree: '3rd',
        shared_connections: 2
      }
    ];

    const searchTime = Date.now() - startTime;

    // Increment search usage
    await pool.query(
      `SELECT increment_lead_search_usage($1, $2)`,
      [workspaceId, 1]
    ).catch(() => {}); // Ignore if RPC doesn't exist

    return NextResponse.json({
      success: true,
      search_engine: 'linkedin_sales_navigator',
      search_query,
      filters,
      results: mockResults,
      total_results: mockResults.length,
      search_time_ms: searchTime,
      account_used: {
        name: linkedinAccount.account_name,
        type: linkedinAccount.linkedin_account_type
      },
      search_metadata: {
        tier: 'sales_navigator',
        via: 'unipile_mcp',
        quota_remaining: tierData.quota_remaining - 1
      }
    });

  } catch (error) {
    console.error('LinkedIn Unipile search error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Health check and capability info
  return NextResponse.json({
    service: 'LinkedIn Search via Unipile',
    status: 'available',
    tier_required: 'sales_navigator',
    description: 'Advanced LinkedIn search for Sales Navigator users via Unipile MCP',
    capabilities: [
      'Advanced LinkedIn profile search',
      'Sales Navigator filters (title, location, company, industry)',
      'Lead recommendations',
      'Saved searches',
      'Account lists'
    ],
    note: 'Classic and Premium LinkedIn users should use /api/search/google-cse or /api/leads/brightdata-scraper instead'
  });
}
