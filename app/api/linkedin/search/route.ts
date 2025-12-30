import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';
import { unipileRequest } from '@/lib/unipile';
import { checkSearchQuota, saveSearchResults } from '@/lib/linkedin';
import { logger } from '@/lib/logging';

// Delay helper for rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

      // Auto-pagination options
      fetch_all = false, // Automatically fetch all pages (up to max_results)
      max_results = 2500, // Maximum results to fetch when fetch_all is true

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

    // Get user's workspace
    const { data: userProfile } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', session.user.id)
      .single();

    const workspaceId = userProfile?.current_workspace_id;
    if (!workspaceId) {
      return NextResponse.json({
        success: false,
        error: 'No workspace found'
      }, { status: 400 });
    }

    // Get LinkedIn account from workspace_accounts table - ONLY user's own accounts
    let linkedinAccountId = accountId;
    if (!linkedinAccountId) {
      // Get any workspace member's LinkedIn account (can be shared across team)
      const { data: linkedinAccounts } = await supabase
        .from('workspace_accounts')
        .select('unipile_account_id, account_name, account_identifier')
        .eq('workspace_id', workspaceId)
        .eq('account_type', 'linkedin')
        .in('connection_status', VALID_CONNECTION_STATUSES);

      console.log('🔵 LinkedIn accounts found:', linkedinAccounts?.length || 0);

      if (!linkedinAccounts || linkedinAccounts.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No active LinkedIn account found. Please connect a LinkedIn account to your workspace first.',
          action: 'connect_linkedin'
        }, { status: 400 });
      }

      const linkedinAccount = linkedinAccounts[0];
      console.log('✅ Using LinkedIn account:', linkedinAccount.account_name || linkedinAccount.account_identifier);
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

    // --- QUOTA CHECK ---
    console.log(`🔍 Checking daily search quota for account: ${linkedinAccountId}`);
    const quota = await checkSearchQuota(supabase, linkedinAccountId);
    if (quota) {
      console.log(`📊 Current usage: ${quota.usage_last_24h}/${quota.daily_limit} results in 24h`);
      if (quota.is_blocked) {
        console.error('🛑 LinkedIn Search Quota Exceeded:', quota);
        return NextResponse.json({
          success: false,
          error: `LinkedIn search quota exceeded for this account (${quota.usage_last_24h}/${quota.daily_limit} results in 24h). Please try again later.`,
          quota
        }, { status: 429 });
      }
    }
    // ------------------

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

    // Calculate actual limits based on API type
    const apiMaxPerPage = api === 'classic' ? 50 : 100;
    const apiMaxTotal = api === 'classic' ? 1000 : 2500;
    const effectiveMaxResults = Math.min(max_results, apiMaxTotal);
    const perPageLimit = Math.min(limit, apiMaxPerPage);

    // Auto-pagination: fetch all pages if requested
    let allProspects: any[] = [];
    let currentCursor = cursor;
    let pagesFetched = 0;
    let totalAvailable = 0;
    let lastPaging: any = null;

    console.log(`🔍 LinkedIn search starting (fetch_all: ${fetch_all}, max_results: ${effectiveMaxResults}, per_page: ${perPageLimit})`);

    const MAX_PAGE_RETRIES = 2;

    do {
      // Build search URL for this page
      const pageParams = new URLSearchParams({
        account_id: linkedinAccountId,
        limit: perPageLimit.toString()
      });
      if (currentCursor) {
        pageParams.append('cursor', currentCursor);
      }

      console.log(`🔍 Fetching page ${pagesFetched + 1}...`, {
        currentCount: allProspects.length
      });

      let pageRetryCount = 0;
      let success = false;

      while (pageRetryCount <= MAX_PAGE_RETRIES && !success) {
        try {
          const searchResults = await unipileRequest(`/api/v1/linkedin/search?${pageParams}`, {
            method: 'POST',
            body: JSON.stringify(searchBody)
          });

          lastPaging = searchResults.paging;
          totalAvailable = searchResults.paging?.total_count || 0;

          // Transform results
          const pageProspects = (searchResults.items || []).map((item: any) =>
            (transformLinkedInResult as any)(item, category, api)
          );

          allProspects = allProspects.concat(pageProspects);
          pagesFetched++;
          success = true;

          console.log(`✅ Page ${pagesFetched}: Got ${pageProspects.length} results (total: ${allProspects.length}/${totalAvailable})`);

          // Update cursor
          currentCursor = searchResults.cursor || searchResults.paging?.cursor || null;

        } catch (err: any) {
          if (err.message === 'LINKEDIN_COMMERCIAL_LIMIT') {
            console.error('🛑 Stopping search due to LinkedIn Commercial Use Limit');
            break;
          }

          pageRetryCount++;
          if (pageRetryCount <= MAX_PAGE_RETRIES) {
            const retryDelay = 2000 * pageRetryCount;
            console.warn(`⚠️ Page fetch failed, retrying in ${retryDelay}ms... (Retry ${pageRetryCount}/${MAX_PAGE_RETRIES})`, err.message);
            await delay(retryDelay);
          } else {
            console.error('❌ UNIPILE API ERROR on page', pagesFetched + 1, err.message);
            if (allProspects.length > 0) {
              console.warn(`⚠️ Error on page ${pagesFetched + 1} after max retries, returning ${allProspects.length} results collected so far`);
              break;
            }
            throw err;
          }
        }
      }

      // Stop conditions
      if (!success || !currentCursor || allProspects.length >= effectiveMaxResults || !fetch_all || pagesFetched >= 50) {
        break;
      }

      // Delay between pages
      await delay(1000); // Increased delay for safety

    } while (true);

    // Trim to max_results if we fetched more
    if (allProspects.length > effectiveMaxResults) {
      allProspects = allProspects.slice(0, effectiveMaxResults);
    }

    console.log(`🎯 Search complete: ${allProspects.length} results in ${pagesFetched} pages (${totalAvailable} total available)`);

    // Optionally enrich profiles with full data
    let enrichedProspects = allProspects;
    if (enrichProfiles && category === 'people' && allProspects.length > 0) {
      enrichedProspects = await (enrichProspectProfiles as any)(
        allProspects,
        linkedinAccountId,
        supabase
      );
    }

    // Save search to database for quota tracking and history
    if (enrichedProspects.length > 0) {
      await saveSearchResults(supabase, {
        user_id: session.user.id,
        workspace_id: workspaceId, // Add workspace_id for isolation
        unipile_account_id: linkedinAccountId,
        search_query: keywords || url || 'Advanced search',
        search_params: searchBody,
        api_type: api,
        category,
        results_count: enrichedProspects.length,
        prospects: enrichedProspects.slice(0, 50), // Store sample prospects only
        cursor: currentCursor || undefined
      });
    }
    return NextResponse.json({
      success: true,
      prospects: enrichedProspects,
      metadata: {
        source: 'unipile_linkedin',
        api,
        category,
        total_found: enrichedProspects.length,
        total_count: totalAvailable,
        pages_fetched: pagesFetched,
        cursor: lastPaging?.cursor,
        has_more: !!lastPaging?.cursor && enrichedProspects.length < totalAvailable,
        fetch_all_enabled: fetch_all,
        max_results: effectiveMaxResults,
        max_per_page: apiMaxPerPage,
        auto_detected: !body.api,
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


