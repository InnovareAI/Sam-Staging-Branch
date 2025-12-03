import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';

// Unipile API for LinkedIn search
// API Docs: https://developer.unipile.com/docs/linkedin-search
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const UNIPILE_DSN = process.env.UNIPILE_DSN || 'api6.unipile.com:13670';
const UNIPILE_BASE_URL = `https://${UNIPILE_DSN}`;

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      searchQuery,
      query, // alias
      workspaceId,
      accountId, // LinkedIn account ID to search from
      limit = 25
    } = body;

    const searchTerm = searchQuery || query;

    if (!searchTerm) {
      return NextResponse.json({
        success: false,
        error: 'Search query is required'
      }, { status: 400 });
    }

    // Check if Unipile is configured
    if (!UNIPILE_API_KEY || !UNIPILE_DSN) {
      console.error('Unipile not configured - LinkedIn search unavailable');
      return NextResponse.json({
        success: false,
        error: 'LinkedIn search is not configured. Please contact support.'
      }, { status: 503 });
    }

    // Get LinkedIn account from Unipile API
    let linkedinAccountId = accountId;
    if (!linkedinAccountId) {
      const unipileResponse = await fetch(`${UNIPILE_BASE_URL}/api/v1/accounts`, {
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Accept': 'application/json'
        }
      });

      if (!unipileResponse.ok) {
        const errorText = await unipileResponse.text();
        console.error('Unipile accounts error:', errorText);
        return NextResponse.json({
          success: false,
          error: 'Failed to retrieve LinkedIn accounts'
        }, { status: 503 });
      }

      const unipileData = await unipileResponse.json();
      const allAccounts = Array.isArray(unipileData) ? unipileData : (unipileData.items || []);
      const linkedInAccounts = allAccounts.filter((acc: any) => acc.type === 'LINKEDIN');

      if (linkedInAccounts.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No LinkedIn account connected. Please connect your LinkedIn account first.'
        }, { status: 400 });
      }

      linkedinAccountId = linkedInAccounts[0].id;
    }

    // Search via Unipile
    const searchResponse = await fetch(`${UNIPILE_BASE_URL}/api/v1/linkedin/search`, {
      method: 'POST',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        account_id: linkedinAccountId,
        query: searchTerm,
        type: 'people',
        limit: Math.min(limit, 50)
      })
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('Unipile search error:', errorText);
      return NextResponse.json({
        success: false,
        error: `LinkedIn search failed: ${errorText}`
      }, { status: 500 });
    }

    const searchData = await searchResponse.json();
    const results = searchData.items || searchData.results || [];

    // Transform to prospect format
    const prospects = results.map((item: any) => ({
      id: item.id || `linkedin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: item.name || `${item.first_name || ''} ${item.last_name || ''}`.trim(),
      firstName: item.first_name,
      lastName: item.last_name,
      title: item.headline || item.title,
      company: item.company || item.company_name,
      linkedinUrl: item.linkedin_url || item.public_identifier ? `https://linkedin.com/in/${item.public_identifier}` : null,
      location: item.location,
      profileImage: item.profile_picture || item.photo_url,
      connectionDegree: item.connection_degree || 3,
      source: 'unipile_search'
    }));

    return NextResponse.json({
      success: true,
      prospects,
      metadata: {
        source: 'unipile',
        query: searchTerm,
        total_found: prospects.length,
        account_id: linkedinAccountId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('LinkedIn search error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'LinkedIn search failed'
    }, { status: 500 });
  }
}
