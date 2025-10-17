/**
 * Google Custom Search API
 * For basic tier workspaces (Startup plan)
 * Provides company website search, LinkedIn profile search, contact page discovery
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      query,
      search_type = 'general', // 'general', 'company_website', 'linkedin_profile', 'contact_page'
      max_results = 10,
      workspace_id
    } = body;

    if (!query) {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      );
    }

    // Check workspace tier and quota
    if (workspace_id) {
      const { data: tierData, error: tierError } = await supabase
        .rpc('check_lead_search_quota', { p_workspace_id: workspace_id });

      if (tierError) {
        console.error('Error checking search quota:', tierError);
        return NextResponse.json(
          { success: false, error: 'Error checking search quota' },
          { status: 500 }
        );
      }

      if (!tierData.has_quota) {
        return NextResponse.json({
          success: false,
          error: 'Search quota exceeded',
          quota_info: tierData,
          upgrade_required: tierData.search_tier === 'basic'
        }, { status: 429 });
      }

      // Allow all tiers to use Google Custom Search
      console.log(`✅ Workspace tier: ${tierData.search_tier} - using Google Custom Search`);
    }

    // Build search query based on type
    let searchQuery = query;
    switch (search_type) {
      case 'company_website':
        searchQuery = `${query} official website`;
        break;
      case 'linkedin_profile':
        searchQuery = `site:linkedin.com/in/ ${query}`;
        break;
      case 'linkedin_company':
        searchQuery = `site:linkedin.com/company/ ${query}`;
        break;
      case 'contact_page':
        searchQuery = `${query} contact us`;
        break;
    }

    // Call Google Custom Search API
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;

    if (!GOOGLE_API_KEY || !GOOGLE_CSE_ID) {
      console.error('Google Custom Search credentials not configured');
      return NextResponse.json(
        { success: false, error: 'Search service not configured' },
        { status: 500 }
      );
    }

    const googleSearchUrl = new URL('https://www.googleapis.com/customsearch/v1');
    googleSearchUrl.searchParams.append('key', GOOGLE_API_KEY);
    googleSearchUrl.searchParams.append('cx', GOOGLE_CSE_ID);
    googleSearchUrl.searchParams.append('q', searchQuery);
    googleSearchUrl.searchParams.append('num', Math.min(max_results, 10).toString());

    const startTime = Date.now();
    const response = await fetch(googleSearchUrl.toString());
    const searchTime = Date.now() - startTime;

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Google Custom Search API error:', errorData);

      // Check if quota exceeded
      if (response.status === 429 || errorData.error?.code === 429) {
        return NextResponse.json({
          success: false,
          error: 'Google Search API quota exceeded',
          hint: 'Consider upgrading to SME or Enterprise plan for BrightData access'
        }, { status: 429 });
      }

      return NextResponse.json(
        { success: false, error: 'Search API error', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Transform results to standardized format
    const results = (data.items || []).map((item: any) => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet,
      display_link: item.displayLink,
      formatted_url: item.formattedUrl
    }));

    // Increment workspace search usage
    if (workspace_id) {
      await supabase.rpc('increment_lead_search_usage', {
        p_workspace_id: workspace_id,
        p_search_count: 1
      });
    }

    return NextResponse.json({
      success: true,
      search_type,
      query: searchQuery,
      results,
      total_results: results.length,
      search_time_ms: searchTime,
      search_metadata: {
        total_possible: data.searchInformation?.totalResults || '0',
        search_engine: 'google_custom_search',
        tier: 'basic'
      }
    });

  } catch (error) {
    console.error('Google Custom Search API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Simple health check
  return NextResponse.json({
    service: 'Google Custom Search API',
    status: 'available',
    tier_required: 'basic (Startup plan)',
    quota: '100 searches/day (free tier)',
    capabilities: [
      'Company website search',
      'LinkedIn profile search',
      'LinkedIn company page search',
      'Contact page discovery',
      'General web search'
    ]
  });
}
