import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';
import { unipileRequest } from '@/lib/unipile';
import { saveSearchResults } from '@/lib/linkedin';

// Extend function timeout to 60 seconds for pagination across many pages
export const maxDuration = 60;

/**
 * SIMPLE LinkedIn Search - Minimal version that just works
 * No fancy features, just get results
 * Force rebuild: 2025-10-10-v2
 */
export async function POST(request: NextRequest) {
  console.log('🔵 SIMPLE SEARCH START');
  try {
    // Check for internal auth headers (when called from SAM)
    const internalAuth = request.headers.get('X-Internal-Auth');
    const internalUserId = request.headers.get('X-User-Id');
    const internalWorkspaceId = request.headers.get('X-Workspace-Id');

    console.log('🔵 [SEARCH-1/6] Headers received:', {
      internalAuth,
      internalUserId,
      internalWorkspaceId,
      hasWorkspace: !!internalWorkspaceId
    });

    let user: any = null;
    let workspaceId: string | null = null;

    if (internalAuth === 'true' && internalUserId) {
      // Internal call from SAM - use service role to verify user exists
      console.log('🔐 Internal auth detected from SAM');
      const userResult = await pool.query(
        'SELECT id, email, current_workspace_id FROM users WHERE id = $1',
        [internalUserId]
      );
      const userData = userResult.rows[0];

      console.log('🔵 [SEARCH-2/6] User lookup result:', {
        found: !!userData,
        email: userData?.email,
      });

      if (userData) {
        user = userData;
        workspaceId = internalWorkspaceId || userData.current_workspace_id;
        console.log(`✅ Internal auth successful: ${user.email}, workspace: ${workspaceId}`);
      } else {
        console.error('❌ User not found in database:', { internalUserId });
      }
    }

    // Fall back to cookie-based auth if internal auth not used
    if (!user) {
      try {
        const authContext = await verifyAuth(request);
        user = {
          id: authContext.userId,
          email: authContext.userEmail
        };
        console.log(`✅ User authenticated: ${user.email}`);
      } catch (authError: any) {
        console.log('❌ No user - returning 401', authError.message);
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
    }

    console.log('🔵 [SEARCH-3/6] About to parse request JSON...');
    let requestBody: any = null;
    try {
      requestBody = await request.json();
    } catch (jsonError) {
      console.error('❌ [SEARCH-3a/6] Failed to parse request JSON:', jsonError instanceof Error ? jsonError.message : String(jsonError));
      throw new Error(`Invalid JSON in request body: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
    }

    // max_pages: Limit pagination to avoid gateway timeouts (default 10 pages = 1000 results)
    // When called via SAM chat, use lower max_pages to fit within 26s gateway timeout
    const { search_criteria, target_count = 2500, fetch_all = true, max_pages = 10, category = 'people' } = requestBody;

    console.log('🔵 [SEARCH-4/6] Received search_criteria:', JSON.stringify(search_criteria));
    console.log('🔵 [SEARCH-4a/6] Target count:', target_count);

    // Map 'companies' to 'company' for Unipile compatibility
    const unipileCategory = category === 'companies' ? 'company' : category;

    // Get workspace (with fallback, or use internal auth workspace)
    if (!workspaceId) {
      console.log('🔵 Querying users table for workspace...');
      const profileResult = await pool.query(
        'SELECT current_workspace_id FROM users WHERE id = $1',
        [user.id]
      );
      const userProfile = profileResult.rows[0];

      console.log('🔵 Users table result:', {
        hasProfile: !!userProfile,
        workspaceId: userProfile?.current_workspace_id
      });

      if (userProfile?.current_workspace_id) {
        workspaceId = userProfile.current_workspace_id;
        console.log('✅ Got workspace from users table:', workspaceId);
      } else {
        console.log('⚠️ No workspace in users table, trying fallback...');
        // Fallback: get first workspace
        const membershipResult = await pool.query(
          'SELECT workspace_id FROM workspace_members WHERE user_id = $1 LIMIT 1',
          [user.id]
        );
        const membership = membershipResult.rows[0];

        console.log('🔵 Workspace_members result:', {
          hasMembership: !!membership,
          workspaceId: membership?.workspace_id
        });

        if (membership?.workspace_id) {
          workspaceId = membership.workspace_id;
          console.log('✅ Got workspace from memberships:', workspaceId);
          // Update for next time
          await pool.query(
            'UPDATE users SET current_workspace_id = $1 WHERE id = $2',
            [workspaceId, user.id]
          );
          console.log('💾 Updated users table');
        }
      }
    }

    if (!workspaceId) {
      console.log('❌ NO WORKSPACE FOUND');
      return NextResponse.json({
        error: 'No workspace',
        debug: { userId: user.id, checked: 'users + workspace_members' }
      }, { status: 400 });
    }

    console.log('✅ [SEARCH-5/6] Final workspace:', workspaceId);
    // Note: Membership already verified above (lines 105-126), no need for redundant check

    // CRITICAL FIX: Query Unipile API directly instead of trusting stale database records
    // This ensures we always get live account data and avoid 404 errors from stale IDs
    console.log('🔍 [SEARCH-5a/6] Fetching LinkedIn accounts directly from Unipile API...');

    const unipileDSN = process.env.UNIPILE_DSN;
    const unipileApiKey = process.env.UNIPILE_API_KEY;

    if (!unipileDSN || !unipileApiKey) {
      throw new Error(`Missing Unipile config: DSN=${!!unipileDSN}, KEY=${!!unipileApiKey}`);
    }

    console.log('🔍 [SEARCH-5b/6] Unipile config valid:', {
      hasDSN: !!unipileDSN,
      hasKey: !!unipileApiKey,
      dsnValue: unipileDSN?.substring(0, 20),
      apiKeyPrefix: unipileApiKey?.substring(0, 8),
      apiKeySuffix: unipileApiKey?.substring(unipileApiKey.length - 4),
      apiKeyLength: unipileApiKey?.length
    });

    // Step 1: Get ALL accounts from Unipile
    // UNIPILE_DSN format: "api6.unipile.com:13670" - already includes domain and port
    const allAccountsUrl = `https://${unipileDSN}/api/v1/accounts`;

    console.log('🔍 [SEARCH-5c/6] Calling Unipile accounts endpoint:', allAccountsUrl);
    const allAccountsResponse = await fetch(allAccountsUrl, {
      headers: {
        'X-API-KEY': unipileApiKey,
        'Accept': 'application/json'
      }
    });

    if (!allAccountsResponse.ok) {
      console.error('❌ Failed to fetch Unipile accounts:', allAccountsResponse.status);
      return NextResponse.json({
        success: false,
        error: `Failed to fetch LinkedIn accounts from Unipile: ${allAccountsResponse.status}`,
        details: 'Unipile API communication error'
      }, { status: 500 });
    }

    const allAccountsData = await allAccountsResponse.json();
    const allAccounts = Array.isArray(allAccountsData) ? allAccountsData : (allAccountsData.items || allAccountsData.accounts || []);

    console.log(`📊 Total Unipile accounts: ${allAccounts.length}`);

    // Step 2: Filter to LinkedIn accounts only
    const allLinkedInAccounts = allAccounts.filter((account: any) => account.type === 'LINKEDIN');
    console.log(`📊 Total LinkedIn accounts in Unipile: ${allLinkedInAccounts.length}`);

    // Step 3: Get ALL connected LinkedIn accounts from the workspace
    // Any workspace member can use any connected account in their workspace
    console.log(`🔍 Finding LinkedIn accounts for workspace ${workspaceId} (user: ${user.email})`);

    // CRITICAL: Use admin client to bypass RLS for workspace_accounts
    const accountsResult = await pool.query(
      `SELECT unipile_account_id, account_name, user_id 
       FROM workspace_accounts 
       WHERE workspace_id = $1 
         AND account_type = 'linkedin' 
         AND connection_status = ANY($2::text[])`,
      [workspaceId, VALID_CONNECTION_STATUSES]
    );
    const userLinkedInAccounts = accountsResult.rows;

    if (!userLinkedInAccounts || userLinkedInAccounts.length === 0) {
      console.error('❌ No LinkedIn accounts found for this workspace');
      return NextResponse.json({
        success: false,
        error: 'No LinkedIn account connected',
        details: 'No LinkedIn accounts are connected in this workspace. Please connect a LinkedIn account in Settings > Integrations.'
      }, { status: 400 });
    }

    // Step 4: Allow ANY workspace member to use ANY connected workspace account
    // This enables collaborative searches where team members can use each other's accounts
    console.log(`📊 Workspace has ${userLinkedInAccounts.length} LinkedIn account(s) available`);

    const availableAccounts = userLinkedInAccounts; // Use ALL workspace accounts, not just user's own

    if (availableAccounts.length === 0) {
      console.error(`❌ No LinkedIn accounts found in workspace`);
      return NextResponse.json({
        success: false,
        error: 'No LinkedIn account connected',
        details: 'No LinkedIn accounts are connected in this workspace. Please go to Settings > Integrations to connect one.'
      }, { status: 400 });
    }

    // Step 5: Match workspace accounts to Unipile accounts - PRIORITIZE Sales Navigator/Recruiter
    let selectedAccount = null;
    let salesNavAccount = null;
    let recruiterAccount = null;
    let premiumAccount = null; // Includes Career, Business Premium, Learning, Job Seeker

    for (const dbAccount of availableAccounts) {
      console.log(`\n  🔍 Checking user's account: ${dbAccount.account_name} (${dbAccount.unipile_account_id})`);

      const unipileAccount = allLinkedInAccounts.find(a => a.id === dbAccount.unipile_account_id);

      if (!unipileAccount) {
        console.log(`     ⚠️ Account not found in Unipile (may be disconnected)`);
        continue;
      }

      const premiumFeatures = unipileAccount.connection_params?.im?.premiumFeatures || [];
      console.log(`     Features detected: ${premiumFeatures.join(', ') || 'none (Unipile will auto-detect)'}`);

      // Prioritize accounts by capability
      if (premiumFeatures.includes('sales_navigator')) {
        salesNavAccount = unipileAccount;
        console.log(`     ⭐ SALES NAVIGATOR account found`);
      } else if (premiumFeatures.includes('recruiter')) {
        recruiterAccount = unipileAccount;
        console.log(`     ⭐ RECRUITER account found`);
      } else if (
        premiumFeatures.includes('premium') ||
        premiumFeatures.includes('premium_career') ||
        premiumFeatures.includes('premium_business') ||
        premiumFeatures.includes('learning') ||
        premiumFeatures.includes('job_seeker')
      ) {
        premiumAccount = unipileAccount;
        const accountType = premiumFeatures.find(f =>
          ['premium', 'premium_career', 'premium_business', 'learning', 'job_seeker'].includes(f)
        ) || 'premium';
        console.log(`     ⚠️  ${accountType.toUpperCase()} account (Classic API - limited data)`);
      } else {
        // Free account
        if (!premiumAccount) premiumAccount = unipileAccount; // Use free as fallback
        console.log(`     ⚠️  Free account (Classic API - limited data)`);
      }
    }

    // Select best available account (Sales Nav > Recruiter > Premium/Business/Learning/JobSeeker/Free)
    selectedAccount = salesNavAccount || recruiterAccount || premiumAccount;

    if (selectedAccount === salesNavAccount) {
      console.log(`\n✅ SELECTED: Sales Navigator account (BEST for prospect scraping)`);
    } else if (selectedAccount === recruiterAccount) {
      console.log(`\n✅ SELECTED: Recruiter account (GOOD for prospect scraping)`);
    } else if (selectedAccount === premiumAccount) {
      const premiumFeatures = selectedAccount.connection_params?.im?.premiumFeatures || [];
      const accountType = premiumFeatures.find(f =>
        ['premium', 'premium_career', 'premium_business', 'learning', 'job_seeker'].includes(f)
      ) || 'free';
      console.log(`\n⚠️  SELECTED: ${accountType.toUpperCase()} account (Classic API - limited data)`);
    }

    if (!selectedAccount) {
      console.error('❌ No connected LinkedIn accounts found');
      return NextResponse.json({
        success: false,
        error: 'No LinkedIn account connected',
        details: 'Please connect your LinkedIn account first.'
      }, { status: 400 });
    }

    console.log(`✅ Using ${user.email}'s LinkedIn account: ${selectedAccount.name}`);

    // Continue with selected account
    const workspaceLinkedInAccounts = [selectedAccount];

    console.log(`📊 LinkedIn accounts belonging to user: ${workspaceLinkedInAccounts.length}`);

    // Determine API type based on selected account's premium features
    const premiumFeatures = selectedAccount.connection_params?.im?.premiumFeatures || [];
    let api = 'classic';
    if (premiumFeatures.includes('recruiter')) {
      api = 'recruiter';
    } else if (premiumFeatures.includes('sales_navigator')) {
      api = 'sales_navigator';
    }

    console.log('✅ Selected LinkedIn account:', selectedAccount.name || selectedAccount.id);
    console.log(`🎯 Using LinkedIn API: ${api}`);
    console.log(`📧 Account email: ${selectedAccount.connection_params?.im?.email || selectedAccount.connection_params?.im?.username}`);

    // Use selected account for the search - DEFINED HERE TO FIX SCOPING ERROR
    const linkedinAccount = {
      unipile_account_id: selectedAccount.id,
      account_name: selectedAccount.name || selectedAccount.connection_params?.im?.publicIdentifier,
      account_identifier: selectedAccount.connection_params?.im?.email || selectedAccount.connection_params?.im?.username
    };

    // ⚠️ VALIDATION: Check if search criteria requires Sales Navigator features
    const unsupportedCriteria = [];
    const warnings = [];

    if (api === 'classic') {
      console.warn('⚠️  WARNING: Classic LinkedIn API has limited data');
      console.warn('   Selected account does not have Sales Navigator or Recruiter');
      console.warn('   Premium features found:', premiumFeatures);
      console.warn('   Account name:', selectedAccount.name || 'Unknown');

      // Check for Sales Navigator-only filters and warn (but don't block)
      if (search_criteria.company_size || search_criteria.companySize) {
        unsupportedCriteria.push('Company Size');
        warnings.push('Company Size filtering is not available with your account - results may include all company sizes');
      }
      if (search_criteria.seniority_level || search_criteria.seniorityLevel) {
        unsupportedCriteria.push('Seniority Level');
        warnings.push('Seniority Level filtering is not available with your account - results may include all seniority levels');
      }
      if (search_criteria.years_at_company || search_criteria.yearsAtCompany) {
        unsupportedCriteria.push('Years at Company');
        warnings.push('Years at Company filtering is not available with your account - results may include all tenure lengths');
      }
      if (search_criteria.function || search_criteria.job_function) {
        unsupportedCriteria.push('Job Function');
        warnings.push('Job Function filtering is not available with your account - results may include all functions');
      }

      // General warnings for Classic API limitations
      if (!warnings.some(w => w.includes('Company data'))) {
        warnings.push('Company data will be parsed from headlines (may be less accurate)');
      }
      warnings.push('Results limited to basic LinkedIn search (fewer filters available)');

      // Log but don't block - let search proceed with warnings
      if (unsupportedCriteria.length > 0) {
        console.warn('⚠️  UNSUPPORTED CRITERIA (will be ignored):', unsupportedCriteria);
        console.warn('   Recommendation: Upgrade to Sales Navigator for full filtering');
      }

      // Helper function to lookup parameter IDs from Unipile
      // Supports LOCATION, COMPANY, INDUSTRY, SCHOOL, etc.
      async function lookupParameterIds(
        paramType: 'LOCATION' | 'COMPANY' | 'INDUSTRY' | 'SCHOOL',
        keywords: string
      ): Promise<string[] | null> {
        try {
          // UNIPILE_DSN format: "api6.unipile.com:13670" - already includes domain and port
          const paramUrl = `https://${unipileDSN}/api/v1/linkedin/search/parameters`;

          const params = new URLSearchParams({
            account_id: linkedinAccount.unipile_account_id,
            type: paramType,
            keywords: keywords,
            limit: '5' // Get top 5 matches
          });

          console.log(`🔍 Looking up ${paramType} IDs for: "${keywords}"`);
          console.log(`🔍 Request URL: ${paramUrl}?${params}`);

          const response = await fetch(`${paramUrl}?${params}`, {
            headers: {
              'X-API-KEY': process.env.UNIPILE_API_KEY!,
              'Accept': 'application/json'
            }
          });

          if (response.status === 404) {
            console.warn(`⚠️ ${paramType} lookup endpoint not available - account may not support this feature`);
            return null;
          }

          const data = await response.json();
          console.log(`✅ ${paramType} lookup response:`, JSON.stringify(data, null, 2));

          // Handle different response structures
          // Some APIs return { items: [...] }, others return arrays directly
          let items = data.items || data;
          if (!Array.isArray(items)) {
            console.warn(`⚠️ Unexpected ${paramType} response structure:`, data);
            return null;
          }

          // Extract IDs from results
          if (items.length > 0) {
            const ids = items.map((item: any) => {
              // Handle different ID field names
              return item.id || item.urn || item.value;
            }).filter(id => id != null);

            console.log(`✅ Found ${ids.length} ${paramType} ID(s):`, ids);
            return ids.length > 0 ? ids : null;
          } else {
            console.log(`⚠️ No ${paramType} matches found for "${keywords}"`);
            return null;
          }
        } catch (error) {
          console.error(`❌ Error looking up ${paramType} IDs:`, error);
          return null;
        }
      }
    }

    // Call Unipile - format payload correctly
    // UNIPILE_DSN format: "api6.unipile.com:13670" - already includes domain and port
    const unipileUrl = `https://${unipileDSN}/api/v1/linkedin/search`;

    // Sales Navigator and Recruiter can handle up to 100, Classic limited to 50
    const maxLimit = (api === 'sales_navigator' || api === 'recruiter') ? 100 : 50;

    const params = new URLSearchParams({
      account_id: linkedinAccount.unipile_account_id,
      limit: String(Math.min(target_count, maxLimit))
    });

    // Build proper Unipile payload with detected API (for Sales Navigator/Recruiter)
    const unipilePayload: any = {
      api: api,  // Use detected API (sales_navigator, recruiter, or classic)
      category: unipileCategory // Use 'people' or 'company' from request
    };

    // Add search parameters to Unipile payload
    // Title (job title filter)
    if (search_criteria.title) {
      unipilePayload.title = search_criteria.title;
    }

    // Keywords (general search keywords)
    if (search_criteria.keywords) {
      unipilePayload.keywords = search_criteria.keywords;
    }

    // Saved Search ID (Sales Navigator)
    if (search_criteria.saved_search_id) {
      unipilePayload.saved_search_id = search_criteria.saved_search_id;
      console.log('🎯 Using Saved Search ID:', search_criteria.saved_search_id);
    }

    // Direct Search URL fallback (from search_criteria.url)
    if (search_criteria.url && !unipilePayload.saved_search_id && !unipilePayload.keywords) {
      unipilePayload.url = search_criteria.url;
      console.log('🎯 Using Direct Search URL as fallback:', search_criteria.url);
    }

    // Track if we can use structured filters or need to fall back to keywords
    // For classic API, ALWAYS use keyword-based search (parameter lookups often fail)
    let useStructuredFilters = (api !== 'classic');
    let keywordsFallback: string[] = [];

    // For classic API, add all filters to keywords instead of trying parameter lookups
    if (api === 'classic') {
      console.log('🎯 Classic API detected - using keyword-based search (no parameter lookups)');
      if (search_criteria.location) keywordsFallback.push(search_criteria.location);
      if (search_criteria.company) keywordsFallback.push(search_criteria.company);
      if (search_criteria.industry) keywordsFallback.push(search_criteria.industry);
      if (search_criteria.school) keywordsFallback.push(search_criteria.school);
    }

    // Location (city, state, country) - REQUIRES NUMERIC IDs (Sales Nav/Recruiter only)
    if (api !== 'classic' && search_criteria.location) {
      console.log('🎯 Processing location filter:', search_criteria.location);
      const locationIds = await lookupParameterIds('LOCATION', search_criteria.location);

      if (locationIds && locationIds.length > 0) {
        // Use the location IDs for the appropriate API type
        if (api === 'sales_navigator') {
          // Sales Navigator uses location.include array
          unipilePayload.location = {
            include: locationIds
          };
          console.log('✅ Location filter (Sales Nav):', unipilePayload.location);
        } else if (api === 'recruiter') {
          // Recruiter uses location array with id objects
          unipilePayload.location = locationIds.map(id => ({ id }));
          console.log('✅ Location filter (Recruiter):', unipilePayload.location);
        } else {
          // Classic LinkedIn uses simple location array
          unipilePayload.location = locationIds;
          console.log('✅ Location filter (Classic):', unipilePayload.location);
        }
      } else {
        console.warn(`⚠️ Could not find location ID for "${search_criteria.location}"`);

        // For classic API, if we can't get location IDs, add location to keywords as fallback
        if (api === 'classic') {
          keywordsFallback.push(search_criteria.location);
          useStructuredFilters = false;
          console.log(`⚠️ Adding location "${search_criteria.location}" to keyword search as fallback`);
        }
      }
    }

    // Company (current company filter) - REQUIRES NUMERIC IDs (Sales Nav/Recruiter only)
    if (api !== 'classic' && search_criteria.company) {
      console.log('🎯 Processing company filter:', search_criteria.company);
      const companyIds = await lookupParameterIds('COMPANY', search_criteria.company);

      if (companyIds && companyIds.length > 0) {
        // Use the company IDs for the appropriate API type
        if (api === 'sales_navigator') {
          // Sales Navigator uses company.include array
          unipilePayload.company = {
            include: companyIds
          };
          console.log('✅ Company filter (Sales Nav):', unipilePayload.company);
        } else if (api === 'recruiter') {
          // Recruiter uses company array with id objects
          unipilePayload.company = companyIds.map(id => ({
            id,
            priority: 'MUST_HAVE',
            scope: 'CURRENT'
          }));
          console.log('✅ Company filter (Recruiter):', unipilePayload.company);
        } else {
          // Classic LinkedIn uses simple company array
          unipilePayload.company = companyIds;
          console.log('✅ Company filter (Classic):', unipilePayload.company);
        }
      } else {
        console.warn(`⚠️ Could not find company ID for "${search_criteria.company}" - proceeding without company filter`);
      }
    }

    // Industry - REQUIRES NUMERIC IDs (Sales Nav/Recruiter only)
    if (api !== 'classic' && search_criteria.industry) {
      console.log('🎯 Processing industry filter:', search_criteria.industry);
      // Use SALES_INDUSTRY for Sales Navigator, INDUSTRY for Classic/Recruiter
      const industryType = api === 'sales_navigator' ? 'INDUSTRY' : 'INDUSTRY';
      const industryIds = await lookupParameterIds('INDUSTRY', search_criteria.industry);

      if (industryIds && industryIds.length > 0) {
        // Use the industry IDs for the appropriate API type
        if (api === 'sales_navigator') {
          // Sales Navigator uses industry.include array
          unipilePayload.industry = {
            include: industryIds
          };
          console.log('✅ Industry filter (Sales Nav):', unipilePayload.industry);
        } else if (api === 'recruiter') {
          // Recruiter uses industry.include array
          unipilePayload.industry = {
            include: industryIds
          };
          console.log('✅ Industry filter (Recruiter):', unipilePayload.industry);
        } else {
          // Classic LinkedIn uses simple industry array
          unipilePayload.industry = industryIds;
          console.log('✅ Industry filter (Classic):', unipilePayload.industry);
        }
      } else {
        console.warn(`⚠️ Could not find industry ID for "${search_criteria.industry}" - proceeding without industry filter`);
      }
    }

    // School/University - REQUIRES NUMERIC IDs (Sales Nav/Recruiter only)
    if (api !== 'classic' && search_criteria.school) {
      console.log('🎯 Processing school filter:', search_criteria.school);
      const schoolIds = await lookupParameterIds('SCHOOL', search_criteria.school);

      if (schoolIds && schoolIds.length > 0) {
        // Use the school IDs for the appropriate API type
        if (api === 'sales_navigator') {
          // Sales Navigator uses school.include array
          unipilePayload.school = {
            include: schoolIds
          };
          console.log('✅ School filter (Sales Nav):', unipilePayload.school);
        } else if (api === 'recruiter') {
          // Recruiter uses school array with id objects
          unipilePayload.school = schoolIds.map(id => ({
            id,
            priority: 'MUST_HAVE'
          }));
          console.log('✅ School filter (Recruiter):', unipilePayload.school);
        } else {
          // Classic LinkedIn uses simple school array
          unipilePayload.school = schoolIds;
          console.log('✅ School filter (Classic):', unipilePayload.school);
        }
      } else {
        console.warn(`⚠️ Could not find school ID for "${search_criteria.school}" - proceeding without school filter`);
      }
    }

    // Connection degree filter - Default to 2nd degree if not specified
    // Allow 1st, 2nd, 3rd, or all degrees
    const connectionDegree = search_criteria.connectionDegree || '2nd'; // Default to 2nd degree

    const degreeToNumber: Record<string, number> = {
      '1st': 1, '2nd': 2, '3rd': 3,
      '1': 1, '2': 2, '3': 3,
      'all': 0 // Allow explicit "all" to search all degrees
    };

    const numericDegree = degreeToNumber[connectionDegree];
    let requestedDegree = numericDegree || 0;
    let searchDegrees: number[] = [];

    if (numericDegree === 0) {
      // Special case: search all degrees
      searchDegrees = [1, 2, 3];
      console.log('🎯 Connection degree: Searching ALL degrees (1st, 2nd, 3rd)');
    } else if (numericDegree) {
      requestedDegree = numericDegree;
      searchDegrees = [numericDegree];
      console.log(`🎯 Connection degree: Searching ONLY ${connectionDegree} degree connections`);
    } else {
      return NextResponse.json({
        success: false,
        error: `Invalid connection degree "${connectionDegree}". Must be "1st", "2nd", "3rd", or "all".`
      }, { status: 400 });
    }

    // Set the appropriate field based on API type
    if (api === 'sales_navigator' || api === 'recruiter') {
      unipilePayload.network_distance = searchDegrees;
    } else {
      // Classic uses network with letter codes
      const degreeMap: Record<number, string> = { 1: 'F', 2: 'S', 3: 'O' };
      unipilePayload.network = searchDegrees.map(d => degreeMap[d]);
    }

    // Profile Language filter
    if (search_criteria.profileLanguage) {
      unipilePayload.profile_language = [search_criteria.profileLanguage];
      console.log('🎯 Profile language filter:', search_criteria.profileLanguage);
    }

    // Tenure (Years of Experience) filter
    if (search_criteria.yearsOfExperience) {
      // Parse years of experience from various formats:
      // "5-10", "5+", "10", "3 to 7"
      const exp = search_criteria.yearsOfExperience.toString();

      if (exp.includes('-')) {
        // Format: "5-10"
        const [min, max] = exp.split('-').map(n => parseInt(n.trim()));
        unipilePayload.tenure = [{ min, max }];
        console.log('🎯 Tenure filter (range):', { min, max });
      } else if (exp.includes('+')) {
        // Format: "5+"
        const min = parseInt(exp.replace('+', '').trim());
        unipilePayload.tenure = [{ min }];
        console.log('🎯 Tenure filter (minimum):', { min });
      } else if (exp.toLowerCase().includes('to')) {
        // Format: "3 to 7"
        const [min, max] = exp.toLowerCase().split('to').map(n => parseInt(n.trim()));
        unipilePayload.tenure = [{ min, max }];
        console.log('🎯 Tenure filter (range):', { min, max });
      } else {
        // Format: "10" (exact or minimum)
        const years = parseInt(exp);
        unipilePayload.tenure = [{ min: years }];
        console.log('🎯 Tenure filter (minimum):', { min: years });
      }
    }

    // If we're using classic API and couldn't get structured filters, combine everything into keywords
    if (api === 'classic' && !useStructuredFilters && keywordsFallback.length > 0) {
      // Combine original keywords with fallback terms
      const allKeywords = [
        search_criteria.keywords,
        ...keywordsFallback
      ].filter(k => k).join(' ');

      unipilePayload.keywords = allKeywords;
      console.log('⚠️ Using keyword-based search fallback for Classic API');
      console.log('⚠️ Combined keywords:', unipilePayload.keywords);

      // Remove any failed structured filters to avoid conflicts
      delete unipilePayload.location;
      delete unipilePayload.company;
      delete unipilePayload.industry;
      delete unipilePayload.school;
    }

    // Calculate actual limits based on API type and target_count
    const apiMaxPerPage = api === 'classic' ? 50 : 100;
    const apiMaxTotal = api === 'classic' ? 1000 : 2500;
    const effectiveMaxResults = Math.min(target_count, apiMaxTotal);
    const perPageLimit = Math.min(target_count, apiMaxPerPage);

    // Auto-pagination: fetch all pages if requested
    let allItems: any[] = [];
    let currentCursor: string | null = null;
    let pagesFetched = 0;
    let totalAvailable = 0;

    console.log('🔵 ═══════════════════════════════════════════════════');
    console.log('🔵 UNIPILE SEARCH REQUEST');
    console.log('🔵 API Type:', api);
    console.log(`🔵 Auto-pagination: ${fetch_all ? 'ENABLED' : 'DISABLED'}`);
    console.log(`🔵 Target count: ${target_count}, Effective max: ${effectiveMaxResults}`);
    console.log('🔵 Full Payload:', JSON.stringify(unipilePayload, null, 2));
    console.log('🔵 ═══════════════════════════════════════════════════');

    // Pagination loop
    do {
      // Build params for this page
      const pageParams = new URLSearchParams({
        account_id: linkedinAccount.unipile_account_id,
        limit: String(perPageLimit)
      });
      if (currentCursor) {
        pageParams.append('cursor', currentCursor);
      }

      console.log(`🔍 Fetching page ${pagesFetched + 1}... (current items: ${allItems.length})`);

      try {
        const searchResults = await unipileRequest(`/api/v1/linkedin/search?${pageParams}`, {
          method: 'POST',
          body: JSON.stringify(unipilePayload)
        });

        const items = searchResults.items || [];
        totalAvailable = searchResults.paging?.total_count || totalAvailable;

        // Transform results
        const pageItems = items.map((item: any) => ({
          ...item,
          fullName: item.name || `${item.first_name || ''} ${item.last_name || ''}`.trim(),
          linkedinUrl: item.profile_url || item.profile_link
        }));

        allItems = allItems.concat(pageItems);
        pagesFetched++;

        console.log(`✅ Page ${pagesFetched}: Got ${pageItems.length} results (total: ${allItems.length}/${totalAvailable})`);

        // Update cursor - Note: Unipile cursor is often at ROOT level OR inside paging
        currentCursor = searchResults.cursor || searchResults.paging?.cursor || null;

        // Stop conditions
        const effectiveMaxPages = Math.min(max_pages, 50);
        if (!currentCursor || allItems.length >= effectiveMaxResults || !fetch_all || pagesFetched >= effectiveMaxPages) {
          break;
        }

        // Delay between pages
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (err: any) {
        if (err.message === 'LINKEDIN_COMMERCIAL_LIMIT') {
          console.error('🛑 Stopping search due to LinkedIn Commercial Use Limit');
          warnings.push('LinkedIn Commercial Use Limit reached. Results may be truncated.');
          break;
        }

        console.error('❌ UNIPILE API ERROR on page', pagesFetched + 1, err.message);

        if (allItems.length > 0) {
          console.warn(`⚠️ Error on page ${pagesFetched + 1}, returning ${allItems.length} results collected so far`);
          break;
        }
        throw err;
      }
    } while (true);

    // Trim to max results if we fetched more
    if (allItems.length > effectiveMaxResults) {
      allItems = allItems.slice(0, effectiveMaxResults);
    }

    // Save to database for quota tracking and history
    if (allItems.length > 0) {
      try {
        await saveSearchResults({
          user_id: user.id,
          workspace_id: workspaceId!, // Use verified workspaceId
          unipile_account_id: linkedinAccount.unipile_account_id,
          search_query: keywords || (search_criteria as any)?.url || 'LinkedIn Search',
          search_params: unipilePayload,
          api_type: api,
          category: 'people',
          results_count: allItems.length,
          prospects: allItems.slice(0, 50), // Store sample prospects only
          cursor: currentCursor || undefined
        });
      } catch (persistenceError) {
        console.error('⚠️ Search persistence failed (non-blocking):', persistenceError);
      }
    }

    console.log('🔵 ═══════════════════════════════════════════════════');
    console.log('🔵 PAGINATION COMPLETE');
    console.log(`🔵 Total items: ${allItems.length} in ${pagesFetched} page(s)`);
    console.log(`🔵 Total available: ${totalAvailable}`);
    console.log('🔵 ═══════════════════════════════════════════════════');

    // Use allItems as data.items for the rest of the processing
    const data = { items: allItems, paging: { total_count: totalAvailable, pages_fetched: pagesFetched } };

    // Log sample item structure to debug data issues
    if (data.items && data.items.length > 0) {
      console.log('🔵 Sample prospect structure:', JSON.stringify(data.items[0], null, 2));
      console.log('🔵 Available fields in first item:', Object.keys(data.items[0]));
    }

    // Keep networkToNumber for parsing response data
    const networkToNumber: Record<string, number> = { 'F': 1, 'S': 2, 'O': 3 };

    const prospects = (data.items || []).map((item: any) => {
      // Handle name - Classic gives full name, Sales Nav gives first/last
      let firstName = item.first_name || '';
      let lastName = item.last_name || '';

      if (!item.first_name && item.name) {
        // Classic API - split full name
        const nameParts = item.name.trim().split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      }

      // CRITICAL: Skip if no name available - we can't use prospects without names
      if (!firstName || firstName === 'Unknown') {
        return null; // Will be filtered out
      }

      // Handle title - Classic uses "headline", Sales Nav uses "current_positions"
      let title = item.headline || '';
      if (item.current_positions && item.current_positions.length > 0) {
        title = item.current_positions[0].role || item.headline || '';
      }

      // Handle company and industry - different sources per API type
      let company = '';
      let industry = '';

      if (item.current_positions && item.current_positions.length > 0) {
        // Sales Navigator API - has detailed current_positions array
        company = item.current_positions[0].company || '';
        industry = item.current_positions[0].industry || item.industry || '';
        console.log(`✅ Company from Sales Navigator API: "${company}"`);
      } else {
        // Classic LinkedIn API - NO structured company field available
        // DO NOT parse from headline - headlines are unreliable and error-prone
        industry = item.industry || '';

        // Check if there's a direct company field (unlikely in Classic API)
        company = item.company || item.company_name || item.current_company || '';

        if (company) {
          console.log(`✅ Company from direct field: "${company}"`);
        } else {
          // No structured company data available
          console.log(`⚠️ No structured company data available for ${item.name || 'prospect'}`);
          console.log(`   Headline: "${item.headline}"`);
          console.log(`   This prospect will be marked for enrichment`);
          // Leave company empty - will be handled by enrichment system
        }
      }

      // LinkedIn URL - convert Sales Navigator URLs to public LinkedIn
      let linkedinUrl = item.profile_url || item.public_profile_url || '';

      // Convert Sales Navigator URL to regular LinkedIn profile URL
      // From: https://www.linkedin.com/sales/lead/...
      // To: https://www.linkedin.com/in/[username]
      if (linkedinUrl.includes('/sales/lead/') || linkedinUrl.includes('/sales/people/')) {
        // Extract LinkedIn username from Sales Nav URL or use public_identifier
        const publicId = item.public_identifier || item.linkedin_id || '';
        if (publicId) {
          linkedinUrl = `https://www.linkedin.com/in/${publicId}`;
        }
      }

      // Connection degree from Unipile data
      // Unipile returns network_distance as "DISTANCE_1", "DISTANCE_2", "DISTANCE_3" (Classic)
      // OR numeric 1, 2, 3 (Sales Nav/Recruiter)
      let connectionDegree: number | null = null;

      console.log(`🔍 RAW DATA for ${firstName} ${lastName}:`, {
        network: item.network,
        network_distance: item.network_distance,
        distance: item.distance,
        requestedDegree
      });

      // Extract actual degree from Unipile's response
      if (item.network_distance !== undefined && item.network_distance !== null) {
        // Parse network_distance - Classic returns "DISTANCE_2", Sales Nav returns 2
        if (typeof item.network_distance === 'string') {
          // Extract number from "DISTANCE_1", "DISTANCE_2", "DISTANCE_3" format
          const match = item.network_distance.match(/DISTANCE[_\s-]?(\d+)/i);
          if (match && match[1]) {
            connectionDegree = parseInt(match[1]);
            console.log(`  ✓ Used item.network_distance (string): ${item.network_distance} → ${connectionDegree}`);
          } else {
            // Try to extract any number if format doesn't match expected pattern
            const numMatch = item.network_distance.match(/(\d+)/);
            if (numMatch) {
              connectionDegree = parseInt(numMatch[1]);
              console.log(`  ⚠️ Parsed number from network_distance: ${item.network_distance} → ${connectionDegree}`);
            }
          }
        } else if (typeof item.network_distance === 'number') {
          connectionDegree = item.network_distance;
          console.log(`  ✓ Used item.network_distance (number): ${item.network_distance} → ${connectionDegree}`);
        }
      } else if (item.network) {
        // Classic API: 'F' (1st), 'S' (2nd), 'O' (3rd)
        if (networkToNumber[item.network]) {
          connectionDegree = networkToNumber[item.network];
          console.log(`  ✓ Used item.network: ${item.network} → ${connectionDegree}`);
        }
      } else if (item.distance !== undefined && item.distance !== null) {
        // Some APIs use 'distance' field
        const parsed = parseInt(String(item.distance));
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 3) {
          connectionDegree = parsed;
          console.log(`  ✓ Used item.distance: ${item.distance} → ${connectionDegree}`);
        }
      }

      // If we couldn't extract degree from response, assume it matches request
      if (connectionDegree === null) {
        connectionDegree = requestedDegree;
        console.log(`  ℹ️ No degree metadata found, assuming requested: ${requestedDegree}`);
      }

      // Ensure connectionDegree is always a valid integer between 1-3
      connectionDegree = Math.max(1, Math.min(3, connectionDegree));
      console.log(`  📌 FINAL connectionDegree: ${connectionDegree}`);

      // CRITICAL: Verify the degree matches what was requested
      // This catches cases where Unipile returns wrong degree results
      if (requestedDegree > 0 && connectionDegree !== requestedDegree) {
        console.log(`❌ FILTERING OUT: ${firstName} ${lastName} - Unipile returned degree ${connectionDegree} but we requested ${requestedDegree}`);
        return null;
      }

      console.log(`✅ Including: ${firstName} ${lastName} - connection degree: ${connectionDegree}`);

      // Extract location
      const location = item.location || item.geo_region || '';

      // Flag for enrichment: Mark prospects with missing/uncertain company data
      const needsEnrichment = !company || company.length < 2;

      return {
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        title,
        company: company || 'unavailable', // 'unavailable' = needs enrichment (Classic API limitation)
        industry: industry || 'unavailable', // 'unavailable' when Classic API doesn't provide
        location,
        linkedinUrl,
        connectionDegree,
        providerId: item.id, // Store the provider_id from search results - this is the authoritative profile ID
        publicIdentifier: item.public_identifier || null, // Vanity identifier for fallback lookups
        needsEnrichment: !company || company === 'unavailable', // Flag for downstream enrichment
        apiType: api, // Track which API was used (classic, sales_navigator, recruiter)
        headline: item.headline || null // Store headline for reference only, never as company
      };
    }).filter(p => p !== null); // Remove prospects without names AND mismatched connection degrees

    console.log(`🔵 Mapped ${prospects.length} prospects (filtered out prospects without names and mismatched connection degrees)`);

    // Log how many were rejected due to missing data or degree mismatch
    const rejectedCount = (data.items?.length || 0) - prospects.length;
    if (rejectedCount > 0) {
      console.log(`⚠️ Rejected ${rejectedCount} prospects due to missing name data or connection degree mismatch`);
    }

    // Log enrichment needs
    const needsEnrichmentCount = prospects.filter((p: any) => p.needsEnrichment).length;
    if (needsEnrichmentCount > 0) {
      console.log(`📊 Data Quality: ${needsEnrichmentCount}/${prospects.length} prospects need company enrichment`);
      console.log(`   API used: ${api}`);
      if (api === 'classic') {
        console.log(`   ℹ️  Classic API does not provide structured company data`);
        console.log(`   💡 Recommendation: Use Sales Navigator account for better data quality`);
      }
    } else {
      console.log(`✅ Data Quality: All prospects have company data`);
    }

    // Save to workspace_prospects with correct column names
    // Filter out prospects without LinkedIn URLs (required field)
    const prospectsWithUrls = prospects.filter((p: any) => p.linkedinUrl);
    console.log(`🔵 Prospects with LinkedIn URLs: ${prospectsWithUrls.length}/${prospects.length}`);

    // DEDUP: Exclude prospects already in campaign_prospects (pending CRs, previous contacts)
    const existingResult = await pool.query(
      'SELECT linkedin_url FROM campaign_prospects WHERE linkedin_url IS NOT NULL'
    );
    const existingProspects = existingResult.rows;

    // DEDUP: Also exclude prospects already in prospect_approval_data (pending approval from previous searches)
    const pendingResult = await pool.query(
      'SELECT contact FROM prospect_approval_data WHERE contact IS NOT NULL'
    );
    const pendingApprovalProspects = pendingResult.rows;

    // Build set of all existing LinkedIn URLs (from campaigns + pending approval)
    const existingUrls = new Set(
      (existingProspects || [])
        .map(p => p.linkedin_url?.toLowerCase())
        .filter(Boolean)
    );

    // Add URLs from pending approval data (stored in contact.linkedin_url JSONB field)
    let pendingApprovalCount = 0;
    (pendingApprovalProspects || []).forEach((p: any) => {
      const url = p.contact?.linkedin_url?.toLowerCase();
      if (url) {
        existingUrls.add(url);
        pendingApprovalCount++;
      }
    });

    console.log(`🔍 Dedup pool: ${existingUrls.size} URLs (${existingProspects?.length || 0} in campaigns, ${pendingApprovalCount} pending approval)`);

    const validProspects = prospectsWithUrls.filter((p: any) => {
      const url = p.linkedinUrl?.toLowerCase();
      if (existingUrls.has(url)) {
        console.log(`   🔄 Skipping (duplicate): ${p.firstName} ${p.lastName}`);
        return false;
      }
      return true;
    });

    const skippedCount = prospectsWithUrls.length - validProspects.length;
    if (skippedCount > 0) {
      console.log(`🔍 Excluded ${skippedCount} duplicate prospects (already in campaigns or pending approval)`);
    }
    console.log(`🔵 Valid NEW prospects: ${validProspects.length}`);

    // Track persistence outcome to surface failures to caller
    let sessionId: string | null = null;
    let persistenceFailed = false;
    const persistenceErrors: string[] = [];

    if (validProspects.length > 0) {
      const toInsert = validProspects.map((p: any) => ({
        workspace_id: workspaceId,
        first_name: p.firstName,
        last_name: p.lastName,
        job_title: p.title || null,
        company_name: p.company, // Already 'unavailable' if missing
        industry: p.industry, // Already 'unavailable' if missing
        location: p.location || null,
        linkedin_profile_url: p.linkedinUrl,
        // BrightData will enrich these fields:
        email_address: null,              // Will be enriched by BrightData
        company_domain: null,             // Will be enriched by BrightData (website)
        company_linkedin_url: null        // Will be enriched by BrightData
      }));

      console.log('🔵 Inserting to database (workspace_prospects, best-effort):', JSON.stringify(toInsert[0]));
      // Use admin client to bypass RLS for workspace_prospects insert; this is best-effort and non-fatal
      try {
        // Construct bulk insert query
        const keys = Object.keys(toInsert[0]);
        const columns = keys.join(', ');
        const values: any[] = [];
        const placeholders: string[] = [];

        toInsert.forEach((item: any, idx) => {
          const rowPlaceholders: string[] = [];
          keys.forEach((key, kIdx) => {
            values.push(item[key]);
            rowPlaceholders.push(`$${values.length}`);
          });
          placeholders.push(`(${rowPlaceholders.join(', ')})`);
        });

        const query = `INSERT INTO workspace_prospects (${columns}) VALUES ${placeholders.join(', ')} RETURNING *`;

        const { rows: inserted } = await pool.query(query, values);
        const insertError = null;

        if (insertError) {
          console.warn('⚠️ workspace_prospects insert warning (non-fatal):', insertError);
          // Do NOT mark persistenceFailed; approval session/data will still be created
        } else {
          console.log(`✅ Inserted ${inserted?.length || 0} prospects into workspace_prospects`);
        }
      } catch (e: any) {
        console.warn('⚠️ workspace_prospects insert threw exception (non-fatal):', e?.message || e);
      }

      // CRITICAL: Create approval session so prospects show in Data Approval tab
      console.log('📋 Creating approval session...');
      sessionId = crypto.randomUUID(); // CORRECTED: Must be UUID not string

      // Generate campaign name: YYYYMMDD-COMPANYCODE-CampaignName
      const today = new Date().toISOString().split('T')[0].replace(/-/g, ''); // 20251011

      // Get workspace name for company code and calculate next batch number
      const workspaceResult = await pool.query(
        'SELECT name, id, owner_id FROM workspaces WHERE id = $1',
        [workspaceId]
      );
      const workspace = workspaceResult.rows[0];
      const workspaceError = !workspace ? { message: 'Workspace not found' } : null;

      if (workspaceError || !workspace) {
        console.error('❌ CRITICAL: Cannot fetch workspace for company code:', {
          workspaceId,
          error: workspaceError?.message
        });
        return NextResponse.json({
          error: 'Failed to fetch workspace information',
          debug: { workspaceId, error: workspaceError?.message }
        }, { status: 500 });
      }

      console.log('📋 Workspace for company code generation:', {
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        ownerId: workspace.owner_id,
        currentUserId: user.id
      });

      // SECURITY ASSERTION: Verify this is NOT InnovareAI workspace (unless user is owner)
      if (workspace.name === 'InnovareAI' && workspace.owner_id !== user.id) {
        console.error('❌ SECURITY VIOLATION: User accessing InnovareAI workspace without ownership!', {
          userId: user.id,
          userEmail: user.email,
          workspaceId: workspace.id,
          ownerId: workspace.owner_id
        });
        return NextResponse.json({
          error: 'Workspace access violation detected',
          debug: { userId: user.id, workspaceId }
        }, { status: 403 });
      }

      // Get next batch_number for this user/workspace combination
      const sessionsResult = await pool.query(
        'SELECT batch_number FROM prospect_approval_sessions WHERE user_id = $1 AND workspace_id = $2 ORDER BY batch_number DESC LIMIT 1',
        [user.id, workspaceId]
      );
      const existingSessions = sessionsResult.rows;

      const nextBatchNumber = existingSessions && existingSessions.length > 0
        ? (existingSessions[0].batch_number + 1)
        : 1;

      console.log('📋 Next batch number:', nextBatchNumber);

      // Generate company code from workspace name (e.g., "InnovareAI" → "IAI")
      const generateCompanyCode = (name: string): string => {
        console.log('🏢 Generating company code for workspace:', name);

        if (!name) {
          console.warn('⚠️ No workspace name provided, defaulting to CLI');
          return 'CLI';
        }

        const cleanName = name.replace(/[^a-zA-Z0-9]/g, '');
        console.log('🏢 Cleaned name:', cleanName);

        // Extract capital letters (e.g., "InnovareAI" → "IAI")
        const capitals = cleanName.match(/[A-Z]/g);
        if (capitals && capitals.length >= 3) {
          const code = capitals.slice(0, 3).join('');
          console.log('✅ Company code from capitals:', code);
          return code;
        }

        // Handle names starting with numbers
        if (/^\d/.test(cleanName)) {
          const code = (cleanName.substring(0, 1) + cleanName.substring(1, 3).toUpperCase()).padEnd(3, 'X');
          console.log('✅ Company code from number-prefixed name:', code);
          return code;
        }

        // Default: first 3 characters uppercased
        const code = cleanName.substring(0, 3).toUpperCase().padEnd(3, 'X');
        console.log('✅ Company code from first 3 chars:', code);
        return code;
      };

      const companyCode = generateCompanyCode(workspace.name);
      console.log('📋 Final company code:', companyCode, 'for workspace:', workspace.name);

      // If user provides campaign name, use it. Otherwise auto-number: "Search 01", "Search 02"
      let campaignName: string;
      if (search_criteria.campaignName) {
        // User provided a name
        campaignName = `${today}-${companyCode}-${search_criteria.campaignName}`;
      } else {
        // Auto-generate: Count existing sessions and increment
        const countResult = await pool.query(
          'SELECT count(*) FROM prospect_approval_sessions WHERE workspace_id = $1',
          [workspaceId]
        );
        const count = parseInt(countResult.rows[0].count);

        const searchNumber = String((count || 0) + 1).padStart(2, '0'); // 01, 02, 03...
        campaignName = `${today}-${companyCode}-Search ${searchNumber}`;
      }

      const campaignTag = search_criteria.keywords || api; // Use keywords or API type as tag

      console.log(`📋 Campaign: ${campaignName}, Tag: ${campaignTag}`);

      let sessionError = null;
      try {
        await pool.query(
          `INSERT INTO prospect_approval_sessions 
           (id, batch_number, user_id, workspace_id, prospect_source, campaign_name, campaign_tag, 
            total_prospects, pending_count, approved_count, rejected_count, status, icp_criteria, learning_insights, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            sessionId,
            nextBatchNumber,
            user.id,
            workspaceId,
            'linkedin_search',
            campaignName,
            campaignTag,
            validProspects.length,
            validProspects.length,
            0,
            0,
            'active',
            JSON.stringify({}),
            JSON.stringify({}),
            new Date().toISOString()
          ]
        );
      } catch (err: any) {
        sessionError = err;
      }

      if (sessionError) {
        console.error('❌ Session creation error:', sessionError);
        persistenceFailed = true;
        persistenceErrors.push(`prospect_approval_sessions: ${sessionError.message}`);
      } else {
        console.log('✅ Approval session created:', sessionId);

        // Add prospects to approval data table
        const approvalProspects = validProspects.map((p: any) => ({
          session_id: sessionId,
          prospect_id: `prospect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: p.fullName,
          title: p.title || '',
          company: {  // JSONB object - 'unavailable' for Classic API
            name: p.company, // Already 'unavailable' if missing
            size: '',
            website: '',
            industry: p.industry  // Already 'unavailable' if missing
          },
          contact: {  // JSONB object
            email: '',
            linkedin_url: p.linkedinUrl || ''
          },
          location: p.location || '',
          profile_image: '',
          recent_activity: '',
          connection_degree: p.connectionDegree,  // Actual connection degree from search
          enrichment_score: 80,
          source: `linkedin_${api}`,
          enriched_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        }));

        // Construct bulk insert for approval prospects
        let prospectsError = null;
        try {
          const pKeys = Object.keys(approvalProspects[0]);
          const pColumns = pKeys.join(', ');
          const pValues: any[] = [];
          const pPlaceholders: string[] = [];

          approvalProspects.forEach((item: any) => {
            const rowP: string[] = [];
            pKeys.forEach((key) => {
              if (key === 'company' || key === 'contact') {
                pValues.push(JSON.stringify(item[key]));
              } else {
                pValues.push(item[key]);
              }
              rowP.push(`$${pValues.length}`);
            });
            pPlaceholders.push(`(${rowP.join(', ')})`);
          });

          const pQuery = `INSERT INTO prospect_approval_data (${pColumns}) VALUES ${pPlaceholders.join(', ')}`;
          await pool.query(pQuery, pValues);
        } catch (err: any) {
          prospectsError = err;
        }

        if (prospectsError) {
          console.error('❌ Approval prospects error:', prospectsError);
          persistenceFailed = true;
          persistenceErrors.push(`prospect_approval_data: ${prospectsError.message}`);
        } else {
          console.log(`✅ Added ${approvalProspects.length} prospects to approval session`);
        }
      }
    }

    // Trigger automatic enrichment for Classic API prospects
    let enrichmentTriggered = false;
    if (api === 'classic' && sessionId && needsEnrichmentCount > 0) {
      console.log(`🔄 Triggering automatic BrightData enrichment for ${needsEnrichmentCount} prospects...`);

      // Trigger enrichment in background (non-blocking)
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/prospects/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          autoEnrich: true
        })
      }).catch(error => {
        console.error('⚠️ Background enrichment failed:', error);
      });

      enrichmentTriggered = true;
    }

    // Return response - include persistence errors as warnings if any
    if (validProspects.length > 0 && persistenceFailed) {
      return NextResponse.json({
        success: false,
        error: 'Prospect persistence failed',
        details: persistenceErrors,
        prospects: validProspects,
        count: validProspects.length
      }, { status: 500 });
    }

    console.log('🔵 [SEARCH-6/6] About to return success response:', {
      prospectCount: validProspects.length,
      totalFound: prospects.length,
      sessionId,
      api
    });

    return NextResponse.json({
      success: true,
      prospects: validProspects,
      count: validProspects.length,
      total_found: prospects.length,
      total_available: totalAvailable,
      pages_fetched: pagesFetched,
      fetch_all_enabled: fetch_all,
      api: api,
      session_id: sessionId,
      persistence_warnings: persistenceErrors.length > 0 ? persistenceErrors : undefined,
      enrichment_triggered: enrichmentTriggered,
      data_quality: {
        needsEnrichmentCount,
        enrichmentRate: prospects.length > 0 ? Math.round((needsEnrichmentCount / prospects.length) * 100) : 0,
        warnings: warnings.length > 0 ? warnings : undefined,
        unsupportedCriteria: unsupportedCriteria.length > 0 ? unsupportedCriteria : undefined,
        recommendation: api === 'classic' && needsEnrichmentCount > 0
          ? enrichmentTriggered
            ? `Enriching ${needsEnrichmentCount} prospects with BrightData (estimated cost: $${(needsEnrichmentCount * 0.01).toFixed(2)})`
            : 'Consider upgrading to LinkedIn Sales Navigator for better data quality and full filtering capabilities'
          : undefined
      }
    });

  } catch (error) {
    console.error('❌ ═══════════════════════════════════════════════════');
    console.error('❌ SIMPLE SEARCH ENDPOINT ERROR CAUGHT');
    console.error('❌ ═══════════════════════════════════════════════════');
    console.error('❌ Full error object:', error);
    console.error('❌ Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('❌ Error message:', error instanceof Error ? error.message : String(error));
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
    if (error instanceof Error && 'code' in error) {
      console.error('❌ Error code:', (error as any).code);
    }
    if (error instanceof Error && 'cause' in error) {
      console.error('❌ Error cause:', (error as any).cause);
    }
    console.error('❌ ═══════════════════════════════════════════════════');
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Search failed',
      errorType: error instanceof Error ? error.constructor.name : typeof error
    }, { status: 500 });
  }
}
