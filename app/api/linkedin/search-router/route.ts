import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Smart LinkedIn Search Router
 *
 * COST OPTIMIZATION STRATEGY:
 * 1. Prioritize Unipile (FREE) - use whenever possible
 * 2. Use BrightData (PAID) only when Unipile is limited
 *
 * Routing Logic:
 * - Sales Navigator/Recruiter: Use Unipile for ALL searches (1st, 2nd, 3rd degree)
 * - Premium: Use Unipile for 2nd/3rd, BrightData for 1st degree only
 * - Classic: Use BrightData (Unipile very limited on Classic accounts)
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
    const { search_criteria, target_count = 50, needs_emails = false } = body;

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
    if (accountType.type === 'sales_navigator' || accountType.type === 'recruiter') {
      console.log('✅ Using Unipile (FREE) - Sales Navigator/Recruiter can search all degrees');

      searchResult = await searchViaUnipile(supabase, {
        workspaceId,
        userId: user.id,
        accountType: accountType.type,
        search_criteria,
        target_count
      });

      // If emails needed, enrich with BrightData
      if (needs_emails && searchResult.success) {
        console.log('📧 Email enrichment needed - calling BrightData (PAID)');
        searchResult.prospects = await enrichWithBrightData(searchResult.prospects);
        searchResult.email_enrichment = 'brightdata';
        searchResult.cost_breakdown = {
          unipile_search: 'FREE',
          brightdata_enrichment: 'PAID'
        };
      } else {
        searchResult.cost_breakdown = {
          unipile_search: 'FREE'
        };
      }
    }

    // === PREMIUM (CAREER/BUSINESS) ===
    // ✅ Use Unipile for 2nd/3rd degree (FREE)
    // ⚠️ Use BrightData for 1st degree (PAID) - different API
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
          target_count
        });

        if (needs_emails && searchResult.success) {
          console.log('📧 Email enrichment needed - calling BrightData (PAID)');
          searchResult.prospects = await enrichWithBrightData(searchResult.prospects);
          searchResult.email_enrichment = 'brightdata';
          searchResult.cost_breakdown = {
            unipile_search: 'FREE',
            brightdata_enrichment: 'PAID'
          };
        } else {
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
  const { data: accounts } = await supabase
    .from('workspace_accounts')
    .select('unipile_account_id, linkedin_account_type, account_features')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('account_type', 'linkedin')
    .eq('connection_status', 'connected');

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
  }
) {
  // Forward to existing Unipile endpoint
  const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/linkedin/search/simple`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      search_criteria: params.search_criteria,
      target_count: params.target_count
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
}) {
  console.log('🌐 BrightData search parameters:', params);

  // Build LinkedIn search URL based on connection degree
  const searchUrl = params.connectionDegree === '1st'
    ? buildMyNetworkUrl(params.search_criteria)
    : buildLinkedInSearchUrl(params.connectionDegree, params.search_criteria);

  console.log('🔗 LinkedIn URL:', searchUrl);

  // Call BrightData MCP
  // TODO: Replace with actual MCP call when BrightData MCP is integrated
  console.log('⚠️ BrightData MCP not yet integrated - returning mock data');

  return {
    success: true,
    provider: 'brightdata',
    prospects: [],
    message: 'BrightData integration pending. This will scrape LinkedIn and enrich with emails.',
    mock_url: searchUrl,
    cost_note: 'PAID service - will incur BrightData costs per prospect scraped'
  };
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
 * Enrich prospects with BrightData for email addresses
 */
async function enrichWithBrightData(prospects: any[]): Promise<any[]> {
  console.log('📧 Enriching prospects with emails via BrightData...');

  // TODO: Implement BrightData email enrichment
  // For now, return prospects unchanged with note
  return prospects.map(p => ({
    ...p,
    email: null,
    email_enrichment_status: 'pending_brightdata_integration'
  }));
}
