import { NextRequest, NextResponse } from 'next/server';

/**
 * MINIMAL LinkedIn Search - Follows Unipile docs exactly
 * No custom logic, no complexity, just forward the request to Unipile
 */
export async function POST(request: NextRequest) {
  try {
    const { search_criteria, account_id } = await request.json();

    const unipileDSN = process.env.UNIPILE_DSN;
    const unipileApiKey = process.env.UNIPILE_API_KEY;

    if (!unipileDSN || !unipileApiKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing Unipile configuration'
      }, { status: 500 });
    }

    if (!account_id) {
      return NextResponse.json({
        success: false,
        error: 'account_id is required'
      }, { status: 400 });
    }

    // Build the Unipile request exactly per documentation
    const url = `https://${unipileDSN}/api/v1/linkedin/search?account_id=${account_id}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-KEY': unipileApiKey,
        'accept': 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify(search_criteria)
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: data.message || data.error || `HTTP ${response.status}`,
        details: data
      }, { status: response.status });
    }

    // Transform Unipile response to our format
    return NextResponse.json({
      success: true,
      items: data.items || [],
      count: data.items?.length || 0,
      total: data.paging?.total_count || 0
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Search failed'
    }, { status: 500 });
  }
}
