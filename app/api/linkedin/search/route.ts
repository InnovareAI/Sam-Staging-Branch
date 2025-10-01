import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Unipile API configuration
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_BASE_URL = `https://${UNIPILE_DSN}.unipile.com:13443`;

/**
 * LinkedIn Search API using Unipile
 * 
 * Supports:
 * - Classic LinkedIn search (people, companies, posts, jobs)
 * - Sales Navigator search (people, companies)
 * - Recruiter search (people)
 * - Search from URL or structured parameters
 * 
 * API Docs: https://developer.unipile.com/docs/linkedin-search
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Authenticate user
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    let {
      // Search configuration
      api, // 'classic' | 'sales_navigator' | 'recruiter' - will auto-detect if not provided
      category = 'people', // 'people' | 'companies' | 'posts' | 'jobs'
      
      // Search methods (either url OR structured params)
      url, // Direct LinkedIn search URL
      
      // Common search parameters
      keywords,
      location, // Array of location IDs
      company, // Array of company IDs
      industry, // Array of industry IDs or { include: [], exclude: [] }
      
      // People-specific parameters
      title, // Job title keywords
      current_company, // Array of company IDs
      past_company, // Array of company IDs
      school, // Array of school IDs
      profile_language, // Array of language codes: ['en', 'es', etc.]
      network_distance, // Array: [1, 2, 3] for 1st, 2nd, 3rd connections
      tenure, // [{ min: 3 }] for years at company
      
      // Sales Navigator specific
      function_param, // Array of function IDs
      seniority_level, // Array of seniority level IDs
      company_headcount, // Array: ['B' (11-50), 'C' (51-200), etc.]
      company_type, // Array: ['C' (Public), 'D' (Private), etc.]
      
      // Recruiter specific
      role, // Array of role objects: [{ keywords: "developer OR engineer", priority: "MUST_HAVE", scope: "CURRENT_OR_PAST" }]
      skills, // Array: [{ id: "261", priority: "DOESNT_HAVE" }, { id: "50517", priority: "MUST_HAVE" }]
      
      // Company search specific
      has_job_offers, // Boolean
      
      // Pagination
      limit = 50, // Max 50 for classic, 100 for sales_navigator/recruiter
      cursor, // For pagination
      
      // Account
      accountId, // Specific LinkedIn account to search from
      
      // Options
      enrichProfiles = false, // Whether to enrich results with full profile data
    } = body;

    // Validate Unipile configuration
    if (!UNIPILE_API_KEY || !UNIPILE_DSN) {
      return NextResponse.json({
        success: false,
        error: 'Unipile not configured. Please contact support.'
      }, { status: 500 });
    }

    // Get user's LinkedIn account
    let linkedinAccountId = accountId;
    if (!linkedinAccountId) {
      const { data: linkedinAccount } = await supabase
        .from('user_unipile_accounts')
        .select('unipile_account_id')
        .eq('user_id', session.user.id)
        .eq('platform', 'LINKEDIN')
        .eq('connection_status', 'active')
        .single();
      
      if (!linkedinAccount?.unipile_account_id) {
        return NextResponse.json({
          success: false,
          error: 'No active LinkedIn account found. Please connect your LinkedIn account first.',
          action: 'connect_linkedin'
        }, { status: 400 });
      }
      
      linkedinAccountId = linkedinAccount.unipile_account_id;
    }

    // Auto-detect LinkedIn capabilities (Sales Navigator, Recruiter, etc.)
    if (!api) {
      console.log('🔍 Auto-detecting LinkedIn capabilities...');
      
      const accountInfoResponse = await fetch(
        `${UNIPILE_BASE_URL}/api/v1/accounts/${linkedinAccountId}`,
        {
          headers: {
            'X-API-KEY': UNIPILE_API_KEY,
            'Accept': 'application/json'
          }
        }
      );

      if (accountInfoResponse.ok) {
        const accountInfo = await accountInfoResponse.json();
        const premiumFeatures = accountInfo.connection_params?.im?.premiumFeatures || [];
        
        console.log('✅ Premium features detected:', premiumFeatures);
        
        // Auto-select best API based on features
        if (premiumFeatures.includes('recruiter')) {
          api = 'recruiter';
          console.log('🎯 Using Recruiter API (2,500 results limit)');
        } else if (premiumFeatures.includes('sales_navigator')) {
          api = 'sales_navigator';
          console.log('🎯 Using Sales Navigator API (2,500 results limit)');
        } else {
          api = 'classic';
          console.log('🎯 Using Classic LinkedIn API (1,000 results limit)');
        }
      } else {
        // Fallback to classic if account info fails
        api = 'classic';
        console.warn('⚠️  Could not detect capabilities, using Classic LinkedIn');
      }
    }

    // Adjust limit based on API
    const maxLimit = api === 'classic' ? 50 : 100;
    if (limit > maxLimit) {
      console.warn(`⚠️  Limit ${limit} exceeds max for ${api} (${maxLimit}), adjusting...`);
      limit = maxLimit;
    }

    // Build search request
    let searchBody: any = {};
    
    if (url) {
      // Search from URL (easiest method)
      searchBody = { url };
    } else {
      // Structured search
      searchBody = {
        api,
        category,
        ...(keywords && { keywords }),
        ...(location && { location }),
        ...(company && { company }),
        ...(industry && { industry }),
        ...(title && { title }),
        ...(current_company && { current_company }),
        ...(past_company && { past_company }),
        ...(school && { school }),
        ...(profile_language && { profile_language }),
        ...(network_distance && { network_distance }),
        ...(tenure && { tenure }),
        ...(function_param && { function: function_param }),
        ...(seniority_level && { seniority_level }),
        ...(company_headcount && { company_headcount }),
        ...(company_type && { company_type }),
        ...(role && { role }),
        ...(skills && { skills }),
        ...(has_job_offers !== undefined && { has_job_offers }),
      };
    }

    // Perform LinkedIn search via Unipile
    const searchUrl = new URL(`${UNIPILE_BASE_URL}/api/v1/linkedin/search`);
    searchUrl.searchParams.append('account_id', linkedinAccountId);
    searchUrl.searchParams.append('limit', limit.toString());
    if (cursor) {
      searchUrl.searchParams.append('cursor', cursor);
    }

    console.log('🔍 Unipile LinkedIn search:', {
      url: searchUrl.toString(),
      body: searchBody
    });

    const response = await fetch(searchUrl.toString(), {
      method: 'POST',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(searchBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Unipile search error:', errorData);
      
      return NextResponse.json({
        success: false,
        error: errorData.message || 'LinkedIn search failed',
        details: errorData
      }, { status: response.status });
    }

    const searchResults = await response.json();

    // Transform results to our format
    const prospects = (searchResults.items || []).map((item: any) => 
      transformLinkedInResult(item, category, api)
    );

    // Optionally enrich profiles with full data
    let enrichedProspects = prospects;
    if (enrichProfiles && category === 'people' && prospects.length > 0) {
      enrichedProspects = await enrichProspectProfiles(
        prospects,
        linkedinAccountId,
        supabase
      );
    }

    // Save search to database
    await saveSearchResults(supabase, {
      user_id: session.user.id,
      search_query: keywords || url || 'Advanced search',
      search_params: searchBody,
      api_type: api,
      category,
      results_count: prospects.length,
      prospects: enrichedProspects,
      cursor: searchResults.paging?.cursor
    });

    return NextResponse.json({
      success: true,
      prospects: enrichedProspects,
      metadata: {
        source: 'unipile_linkedin',
        api,
        category,
        total_found: prospects.length,
        total_count: searchResults.paging?.total_count,
        page_count: searchResults.paging?.page_count,
        cursor: searchResults.paging?.cursor,
        has_more: !!searchResults.paging?.cursor,
        max_results: api === 'classic' ? 1000 : 2500,
        max_per_page: api === 'classic' ? 50 : 100,
        auto_detected: !body.api, // Was API auto-detected?
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ LinkedIn search error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'LinkedIn search failed'
    }, { status: 500 });
  }
}

// Transform Unipile LinkedIn result to our prospect format
function transformLinkedInResult(item: any, category: string, api: string) {
  const base = {
    id: `linkedin_${item.id || item.public_identifier}`,
    source: `unipile_${api}`,
    unipile_data: item, // Store full Unipile response
  };

  if (category === 'people') {
    return {
      ...base,
      type: 'person',
      
      // Basic info
      name: item.name || `${item.first_name || ''} ${item.last_name || ''}`.trim(),
      firstName: item.first_name,
      lastName: item.last_name,
      headline: item.headline,
      
      // Professional info
      title: item.title || item.headline,
      company: item.company_name || item.current_company,
      industry: item.industry,
      
      // LinkedIn specific
      linkedinUrl: item.profile_url,
      profileUrl: item.profile_url,
      publicIdentifier: item.public_identifier,
      entityUrn: item.entity_urn,
      
      // Location
      location: item.location,
      country: item.country,
      
      // Connection info
      connectionDegree: item.network_distance || item.connection_degree,
      mutualConnections: item.num_of_mutual_connections,
      
      // Profile details
      summary: item.summary,
      premium: item.premium_subscriber,
      openToWork: item.open_to_work,
      
      // Scoring
      confidence: calculateConfidence(item, category),
      profileCompleteness: calculateProfileCompleteness(item),
      
      // Metadata
      scrapedAt: new Date().toISOString()
    };
  }

  if (category === 'companies') {
    return {
      ...base,
      type: 'company',
      
      // Basic info
      name: item.name,
      description: item.summary || item.description,
      
      // Company details
      industry: item.industry,
      headcount: item.headcount || item.employee_count,
      companyType: item.company_type,
      
      // LinkedIn info
      linkedinUrl: item.profile_url,
      publicIdentifier: item.public_identifier,
      entityUrn: item.entity_urn,
      
      // Location
      location: item.location,
      headquarters: item.hq_location,
      
      // Additional
      website: item.website,
      followerCount: item.follower_count,
      hasJobOffers: item.has_job_offers,
      
      // Metadata
      scrapedAt: new Date().toISOString()
    };
  }

  // Default fallback
  return { ...base, ...item };
}

// Calculate confidence score
function calculateConfidence(item: any, category: string): number {
  let score = 0.5; // Base score
  
  if (category === 'people') {
    if (item.name || (item.first_name && item.last_name)) score += 0.15;
    if (item.headline || item.title) score += 0.15;
    if (item.company_name) score += 0.1;
    if (item.location) score += 0.05;
    if (item.summary) score += 0.05;
  } else if (category === 'companies') {
    if (item.name) score += 0.2;
    if (item.industry) score += 0.15;
    if (item.headcount) score += 0.1;
    if (item.website) score += 0.05;
  }
  
  return Math.min(0.95, score);
}

// Calculate profile completeness
function calculateProfileCompleteness(item: any): number {
  const fields = ['name', 'headline', 'location', 'summary', 'company_name', 'industry'];
  let completed = 0;
  
  fields.forEach(field => {
    if (item[field]) completed++;
  });
  
  return Math.round((completed / fields.length) * 100);
}

// Enrich prospect profiles with full LinkedIn data
async function enrichProspectProfiles(
  prospects: any[],
  accountId: string,
  supabase: any
): Promise<any[]> {
  // This would make additional API calls to get full profile data
  // For now, return as-is (can be implemented later)
  return prospects;
}

// Save search results to database
async function saveSearchResults(supabase: any, data: any) {
  try {
    const { error } = await supabase
      .from('linkedin_searches')
      .insert({
        user_id: data.user_id,
        search_query: data.search_query,
        search_params: data.search_params,
        api_type: data.api_type,
        category: data.category,
        results_count: data.results_count,
        prospects: data.prospects,
        next_cursor: data.cursor,
        searched_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Failed to save search results:', error);
    }
  } catch (error) {
    console.error('Error saving search results:', error);
  }
}
