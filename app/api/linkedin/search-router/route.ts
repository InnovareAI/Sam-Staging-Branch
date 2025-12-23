import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/app/lib/supabase';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';

/**
 * Smart LinkedIn Search Router with Automatic Fallback
 *
 * COST OPTIMIZATION STRATEGY:
 * 1. Prioritize Unipile (FREE) - use whenever possible
 * 2. Use BrightData (PAID) only when Unipile is limited
 * 3. AUTO-FALLBACK: Automatically use BrightData when Unipile hits rate limits
 *
 * Routing Logic:
 * - Sales Navigator/Recruiter: Use Unipile for ALL searches (1st, 2nd, 3rd degree)
 * - Premium: Use Unipile for 2nd/3rd, BrightData for 1st degree only
 * - Classic: Use BrightData (Unipile very limited on Classic accounts)
 *
 * Rate Limit Protection:
 * - Detects when Unipile account hits rate limits
 * - Automatically falls back to BrightData MCP for seamless data retrieval
 * - Logs fallback events for cost tracking
 * - Returns data from BrightData without user-facing errors
 *
 * Email Enrichment:
 * - LinkedIn (even Sales Nav) doesn't provide emails
 * - If emails needed, always enrich with BrightData after Unipile search
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          }
        }
      }
    );

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { search_criteria, target_count = 50, needs_emails = false, category = 'people' } = body;

    // Get workspace
    const { data: userProfile } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single();

    const workspaceId = userProfile?.current_workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 });
    }

    // STEP 1: Detect LinkedIn Account Type
    const accountType = await detectLinkedInAccountType(supabase, workspaceId, user.id);
    console.log(`🔍 LinkedIn Account Type: ${accountType.type}`);
    console.log(`📊 Unipile Available: ${accountType.hasUnipile ? 'YES' : 'NO'}`);
    console.log(`💰 Cost Strategy: ${accountType.strategy}`);

    const connectionDegree = search_criteria.connectionDegree; // '1st', '2nd', or '3rd'

    // STEP 2: Route based on account type and connection degree
    let searchResult;

    // === SALES NAVIGATOR / RECRUITER ===
    // ✅ Use Unipile for ALL searches (1st, 2nd, 3rd) - FREE
    // ⚠️ Auto-fallback to BrightData if Unipile rate-limited
    if (accountType.type === 'sales_navigator' || accountType.type === 'recruiter') {
      console.log('✅ Using Unipile (FREE) - Sales Navigator/Recruiter can search all degrees');

      searchResult = await searchViaUnipile(supabase, {
        workspaceId,
        userId: user.id,
        accountType: accountType.type,
        search_criteria,
        target_count,
        category
      });

      // AUTO-FALLBACK: If Unipile failed due to rate limits, use BrightData
      if (!searchResult.success && isRateLimitError(searchResult)) {
        console.log('⚠️ Unipile rate limit detected - falling back to BrightData (PAID)');
        searchResult = await searchViaBrightData({
          workspaceId,
          connectionDegree,
          search_criteria,
          target_count,
          include_emails: needs_emails
        });
        searchResult.fallback_used = true;
        searchResult.fallback_reason = 'unipile_rate_limit';
        searchResult.cost_breakdown = {
          unipile_search: 'FAILED (rate limit)',
          brightdata_fallback: 'PAID',
          email_enrichment: needs_emails ? 'INCLUDED' : 'N/A'
        };
      }
      // If Unipile succeeded and emails needed, enrich with BrightData
      else if (needs_emails && searchResult.success) {
        console.log('📧 Email enrichment needed - calling BrightData (PAID)');
        searchResult.prospects = await enrichWithBrightData(searchResult.prospects);
        searchResult.email_enrichment = 'brightdata';
        searchResult.cost_breakdown = {
          unipile_search: 'FREE',
          brightdata_enrichment: 'PAID'
        };
      } else if (searchResult.success) {
        searchResult.cost_breakdown = {
          unipile_search: 'FREE'
        };
      }
    }

    // === PREMIUM (CAREER/BUSINESS) ===
    // ✅ Use Unipile for 2nd/3rd degree (FREE)
    // ⚠️ Use BrightData for 1st degree (PAID) - different API
    // ⚠️ Auto-fallback to BrightData if Unipile rate-limited
    else if (accountType.type === 'premium_career' || accountType.type === 'premium_business') {
      if (connectionDegree === '1st') {
        console.log('⚠️ Using BrightData (PAID) - Premium accounts need BrightData for 1st degree connections');
        searchResult = await searchViaBrightData({
          workspaceId,
          connectionDegree,
          search_criteria,
          target_count,
          include_emails: needs_emails
        });
        searchResult.cost_breakdown = {
          brightdata_search: 'PAID',
          email_enrichment: needs_emails ? 'INCLUDED' : 'N/A'
        };
      } else {
        console.log('✅ Using Unipile (FREE) - Premium can search 2nd/3rd degree');
        searchResult = await searchViaUnipile(supabase, {
          workspaceId,
          userId: user.id,
          accountType: accountType.type,
          search_criteria,
          target_count,
          category
        });

        // AUTO-FALLBACK: If Unipile failed due to rate limits, use BrightData
        if (!searchResult.success && isRateLimitError(searchResult)) {
          console.log('⚠️ Unipile rate limit detected - falling back to BrightData (PAID)');
          searchResult = await searchViaBrightData({
            workspaceId,
            connectionDegree,
            search_criteria,
            target_count,
            include_emails: needs_emails
          });
          searchResult.fallback_used = true;
          searchResult.fallback_reason = 'unipile_rate_limit';
          searchResult.cost_breakdown = {
            unipile_search: 'FAILED (rate limit)',
            brightdata_fallback: 'PAID',
            email_enrichment: needs_emails ? 'INCLUDED' : 'N/A'
          };
        }
        // If Unipile succeeded and emails needed, enrich with BrightData
        else if (needs_emails && searchResult.success) {
          console.log('📧 Email enrichment needed - calling BrightData (PAID)');
          searchResult.prospects = await enrichWithBrightData(searchResult.prospects);
          searchResult.email_enrichment = 'brightdata';
          searchResult.cost_breakdown = {
            unipile_search: 'FREE',
            brightdata_enrichment: 'PAID'
          };
        } else if (searchResult.success) {
          searchResult.cost_breakdown = {
            unipile_search: 'FREE'
          };
        }
      }
    }

    // === CLASSIC (FREE LINKEDIN) ===
    // ⚠️ Very limited Unipile capability - use BrightData (PAID)
    else {
      console.log('⚠️ Using BrightData (PAID) - Classic LinkedIn has very limited search via Unipile');
      searchResult = await searchViaBrightData({
        workspaceId,
        connectionDegree,
        search_criteria,
        target_count,
        include_emails: needs_emails
      });
      searchResult.cost_breakdown = {
        brightdata_search: 'PAID',
        email_enrichment: needs_emails ? 'INCLUDED' : 'N/A'
      };
    }

    return NextResponse.json({
      ...searchResult,
      routing_info: {
        account_type: accountType.type,
        connection_degree: connectionDegree,
        search_provider: searchResult.provider,
        cost_optimization: accountType.strategy
      }
    });

  } catch (error) {
    console.error('Search router error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Search routing failed'
    }, { status: 500 });
  }
}

/**
 * Detect LinkedIn Account Type from Workspace
 */
async function detectLinkedInAccountType(
  supabase: any,
  workspaceId: string,
  userId: string
): Promise<{
  type: 'sales_navigator' | 'recruiter' | 'premium_career' | 'premium_business' | 'classic' | 'unknown';
  hasUnipile: boolean;
  strategy: string;
}> {
  // Get user's LinkedIn accounts from workspace
  // CRITICAL: Use admin client to bypass RLS for workspace_accounts
  const { data: accounts } = await supabaseAdmin()
    .from('workspace_accounts')
    .select('unipile_account_id, linkedin_account_type, account_features')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('account_type', 'linkedin')
    .in('connection_status', VALID_CONNECTION_STATUSES);

  if (!accounts || accounts.length === 0) {
    return {
      type: 'unknown',
      hasUnipile: false,
      strategy: 'No LinkedIn account connected'
    };
  }

  // Use the first connected account
  const account = accounts[0];
  const accountType = account.linkedin_account_type || 'unknown';

  // Determine cost strategy based on account type
  let strategy = '';
  if (accountType === 'sales_navigator' || accountType === 'recruiter') {
    strategy = 'Use Unipile for all searches (FREE). BrightData only for emails (PAID).';
  } else if (accountType.includes('premium')) {
    strategy = 'Use Unipile for 2nd/3rd degree (FREE). BrightData for 1st degree + emails (PAID).';
  } else {
    strategy = 'Use BrightData for most searches (PAID). Classic LinkedIn has limited Unipile support.';
  }

  return {
    type: accountType as any,
    hasUnipile: !!account.unipile_account_id,
    strategy
  };
}

/**
 * Search via Unipile (FREE)
 */
async function searchViaUnipile(
  supabase: any,
  params: {
    workspaceId: string;
    userId: string;
    accountType: string;
    search_criteria: any;
    target_count: number;
    category?: string;
  }
) {
  // Forward to existing Unipile endpoint
  const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/linkedin/search/simple`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      search_criteria: params.search_criteria,
      target_count: params.target_count,
      category: params.category || 'people'
    })
  });

  const data = await response.json();

  return {
    ...data,
    provider: 'unipile',
    account_type: params.accountType
  };
}

/**
 * Search via BrightData (PAID)
 */
async function searchViaBrightData(params: {
  workspaceId: string;
  connectionDegree: string;
  search_criteria: any;
  target_count: number;
  include_emails: boolean;
}): Promise<any> {
  console.log('🌐 BrightData search parameters:', params);

  try {
    // Call BrightData scraper API
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/leads/brightdata-scraper`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'scrape_prospects',
        workspace_id: params.workspaceId,
        search_params: {
          target_sites: ['linkedin'],
          search_criteria: {
            keywords: params.search_criteria.keywords || '',
            job_titles: params.search_criteria.title ? [params.search_criteria.title] : [],
            industries: params.search_criteria.industry ? [params.search_criteria.industry] : [],
            locations: params.search_criteria.location ? [params.search_criteria.location] : [],
            company_names: params.search_criteria.company ? [params.search_criteria.company] : []
          },
          scraping_options: {
            max_results: params.target_count,
            include_emails: params.include_emails,
            include_phone: false,
            verify_contact_info: params.include_emails,
            depth: params.include_emails ? 'detailed' : 'basic'
          }
        },
        use_premium_proxies: true,
        geo_location: 'US'
      })
    });

    if (!response.ok) {
      throw new Error(`BrightData API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      return {
        success: false,
        provider: 'brightdata',
        error: data.error || 'BrightData search failed',
        prospects: []
      };
    }

    // Transform BrightData prospects to our format
    const prospects = (data.results?.prospects || []).map((p: any) => ({
      firstName: p.prospect_data.first_name,
      lastName: p.prospect_data.last_name,
      fullName: p.prospect_data.full_name,
      title: p.prospect_data.title,
      company: p.prospect_data.company,
      location: p.prospect_data.location,
      linkedinUrl: p.prospect_data.linkedin_url,
      email: p.prospect_data.email || null,
      phone: p.prospect_data.phone || null,
      connectionDegree: parseConnectionDegree(params.connectionDegree),
      source: 'brightdata_mcp',
      enrichment_score: Math.round((p.confidence_score || 0.8) * 100)
    }));

    console.log(`✅ BrightData returned ${prospects.length} prospects`);

    return {
      success: true,
      provider: 'brightdata',
      prospects,
      count: prospects.length,
      metadata: {
        scraping_source: data.results?.sources_used || ['linkedin'],
        cost_estimate: data.metadata?.cost_estimate || `$${(prospects.length * 0.05).toFixed(2)}`,
        data_quality: 'verified'
      }
    };

  } catch (error) {
    console.error('BrightData search error:', error);
    return {
      success: false,
      provider: 'brightdata',
      error: error instanceof Error ? error.message : 'BrightData search failed',
      prospects: []
    };
  }
}

/**
 * Parse connection degree string to number
 */
function parseConnectionDegree(degree: string): number {
  const degreeMap: Record<string, number> = {
    '1st': 1, '2nd': 2, '3rd': 3,
    '1': 1, '2': 2, '3': 3
  };
  return degreeMap[degree] || 2;
}

/**
 * Build LinkedIn "My Network" URL for 1st degree connections
 */
function buildMyNetworkUrl(criteria: any): string {
  // 1st degree = My Connections page
  const baseUrl = 'https://www.linkedin.com/mynetwork/invite-connect/connections/';

  // Can add filters via query params if supported
  const params = new URLSearchParams();
  if (criteria.title) params.append('title', criteria.title);
  if (criteria.company) params.append('company', criteria.company);

  return params.toString() ? `${baseUrl}?${params}` : baseUrl;
}

/**
 * Build LinkedIn Search URL for 2nd/3rd degree connections
 */
function buildLinkedInSearchUrl(connectionDegree: string, criteria: any): string {
  const baseUrl = 'https://www.linkedin.com/search/results/people/';
  const params = new URLSearchParams();

  // Network filter: F=1st (shouldn't be used here), S=2nd, O=3rd
  const networkMap: Record<string, string> = {
    '1st': 'F',
    '2nd': 'S',
    '3rd': 'O'
  };

  const networkCode = networkMap[connectionDegree] || 'S';
  params.append('network', `["${networkCode}"]`);
  params.append('origin', 'FACETED_SEARCH');

  // Add search filters
  if (criteria.keywords) params.append('keywords', criteria.keywords);
  if (criteria.title) params.append('title', criteria.title);
  if (criteria.location) params.append('geoUrn', criteria.location);
  if (criteria.company) params.append('company', criteria.company);

  return `${baseUrl}?${params}`;
}

/**
 * Detect if search result failed due to rate limiting
 */
function isRateLimitError(searchResult: any): boolean {
  if (!searchResult || !searchResult.error) {
    return false;
  }

  const error = searchResult.error.toLowerCase();

  // Check for common rate limit indicators
  const rateLimitIndicators = [
    'rate limit',
    'too many requests',
    'quota exceeded',
    'limit exceeded',
    'throttled',
    '429',
    'slow down',
    'try again later'
  ];

  return rateLimitIndicators.some(indicator => error.includes(indicator));
}

/**
 * Enrich prospects with BrightData for email addresses
 */
async function enrichWithBrightData(prospects: any[]): Promise<any[]> {
  console.log(`📧 Enriching ${prospects.length} prospects with emails via BrightData...`);

  if (prospects.length === 0) {
    return prospects;
  }

  try {
    // For each prospect, try to find their email using BrightData
    // This uses the scrape_as_markdown tool to extract email from LinkedIn profiles
    const enrichedProspects = await Promise.all(
      prospects.map(async (prospect) => {
        try {
          // If prospect already has email, skip enrichment
          if (prospect.email) {
            return {
              ...prospect,
              email_enrichment_status: 'already_present'
            };
          }

          // Call BrightData to scrape email from LinkedIn profile
          const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/leads/brightdata-scraper`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'verify_contact_info',
              prospect_name: prospect.fullName,
              linkedin_url: prospect.linkedinUrl
            })
          });

          if (!response.ok) {
            console.warn(`⚠️ Email enrichment failed for ${prospect.fullName}`);
            return {
              ...prospect,
              email: null,
              email_enrichment_status: 'enrichment_failed'
            };
          }

          const data = await response.json();

          // BrightData may return email in verification response
          return {
            ...prospect,
            email: data.email || null,
            email_verified: data.email_verification?.valid || false,
            email_confidence: data.email_verification?.confidence || 0,
            email_enrichment_status: data.email ? 'enriched' : 'not_found'
          };

        } catch (error) {
          console.error(`Error enriching ${prospect.fullName}:`, error);
          return {
            ...prospect,
            email: null,
            email_enrichment_status: 'error'
          };
        }
      })
    );

    const enrichedCount = enrichedProspects.filter(p => p.email).length;
    console.log(`✅ Successfully enriched ${enrichedCount}/${prospects.length} prospects with emails`);

    return enrichedProspects;

  } catch (error) {
    console.error('BrightData email enrichment error:', error);
    // Return prospects unchanged if enrichment fails
    return prospects.map(p => ({
      ...p,
      email: null,
      email_enrichment_status: 'enrichment_service_unavailable'
    }));
  }
}
