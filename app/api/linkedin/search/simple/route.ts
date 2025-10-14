import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/app/lib/supabase';

/**
 * SIMPLE LinkedIn Search - Minimal version that just works
 * No fancy features, just get results
 * Force rebuild: 2025-10-10-v2
 */
export async function POST(request: NextRequest) {
  console.log('🔵 SIMPLE SEARCH START');
  try {
    const cookieStore = await cookies();

    // Use @supabase/ssr createServerClient (matches browser client)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          }
        }
      }
    );

    // Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('🔵 Auth check:', { hasUser: !!user, userId: user?.id, authError: authError?.message });

    if (!user) {
      console.log('❌ No user - returning 401');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log(`✅ User authenticated: ${user.email}`);

    const { search_criteria, target_count = 50 } = await request.json();

    console.log('🔵 Received search_criteria:', JSON.stringify(search_criteria));

    // Get workspace (with fallback)
    let workspaceId: string | null = null;

    console.log('🔵 Querying users table for workspace...');
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single();

    console.log('🔵 Users table result:', {
      hasProfile: !!userProfile,
      workspaceId: userProfile?.current_workspace_id,
      error: profileError?.message
    });

    if (userProfile?.current_workspace_id) {
      workspaceId = userProfile.current_workspace_id;
      console.log('✅ Got workspace from users table:', workspaceId);
    } else {
      console.log('⚠️ No workspace in users table, trying fallback...');
      // Fallback: get first workspace
      const { data: membership, error: membershipError } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      console.log('🔵 Workspace_members result:', {
        hasMembership: !!membership,
        workspaceId: membership?.workspace_id,
        error: membershipError?.message
      });

      if (membership?.workspace_id) {
        workspaceId = membership.workspace_id;
        console.log('✅ Got workspace from memberships:', workspaceId);
        // Update for next time
        await supabase
          .from('users')
          .update({ current_workspace_id: membership.workspace_id })
          .eq('id', user.id);
        console.log('💾 Updated users table');
      }
    }

    if (!workspaceId) {
      console.log('❌ NO WORKSPACE FOUND');
      return NextResponse.json({
        error: 'No workspace',
        debug: { userId: user.id, checked: 'users + workspace_members' }
      }, { status: 400 });
    }

    console.log('✅ Final workspace:', workspaceId);

    // SECURITY: Verify workspace isolation - user MUST be a member of this workspace
    const { data: membershipCheck, error: membershipError } = await supabase
      .from('workspace_members')
      .select('role, workspace_id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!membershipCheck || membershipError) {
      console.error('❌ SECURITY: User is not a member of workspace:', {
        userId: user.id,
        workspaceId,
        error: membershipError?.message
      });
      return NextResponse.json({
        error: 'Access denied: You are not a member of this workspace',
        debug: { userId: user.id, workspaceId }
      }, { status: 403 });
    }

    console.log('✅ Workspace membership verified:', {
      workspaceId,
      role: membershipCheck.role,
      userId: user.id
    });

    // Get LinkedIn account from workspace_accounts table
    const { data: linkedinAccounts } = await supabase
      .from('workspace_accounts')
      .select('unipile_account_id, account_name, account_identifier')
      .eq('workspace_id', workspaceId)
      .eq('account_type', 'linkedin')
      .eq('connection_status', 'connected');

    console.log('🔵 LinkedIn accounts found:', linkedinAccounts?.length || 0);

    if (!linkedinAccounts || linkedinAccounts.length === 0) {
      return NextResponse.json({ error: 'LinkedIn not connected' }, { status: 400 });
    }

    // Use the first available LinkedIn account
    const linkedinAccount = linkedinAccounts[0];
    console.log('✅ Using LinkedIn account:', linkedinAccount.account_name || linkedinAccount.account_identifier);

    // Auto-detect LinkedIn capabilities (Sales Navigator, Recruiter, or Classic)
    let api = 'classic';
    let accountInfo: any = null;
    try {
      const unipileDSN = process.env.UNIPILE_DSN!;
      const accountUrl = unipileDSN.includes('.')
        ? `https://${unipileDSN}/api/v1/accounts/${linkedinAccount.unipile_account_id}`
        : `https://${unipileDSN}.unipile.com:13443/api/v1/accounts/${linkedinAccount.unipile_account_id}`;

      console.log('🔍 Checking LinkedIn account capabilities:', accountUrl);
      
      const accountInfoResponse = await fetch(accountUrl, {
        headers: {
          'X-API-KEY': process.env.UNIPILE_API_KEY!,
          'Accept': 'application/json'
        }
      });

      if (accountInfoResponse.ok) {
        accountInfo = await accountInfoResponse.json();
        console.log('📊 Account info received:', JSON.stringify({
          id: accountInfo.id,
          provider: accountInfo.provider,
          premiumFeatures: accountInfo.connection_params?.im?.premiumFeatures
        }));
        
        const premiumFeatures = accountInfo.connection_params?.im?.premiumFeatures || [];
        
        console.log('🔍 Premium features detected:', premiumFeatures);

        if (premiumFeatures.includes('recruiter')) {
          api = 'recruiter';
          console.log('✅ Detected LinkedIn Recruiter account');
        } else if (premiumFeatures.includes('sales_navigator')) {
          api = 'sales_navigator';
          console.log('✅ Detected LinkedIn Sales Navigator account');
        } else {
          console.log('ℹ️ No premium features detected, using Classic LinkedIn');
        }
      } else {
        console.error('❌ Failed to fetch account info:', accountInfoResponse.status, await accountInfoResponse.text());
      }
    } catch (error) {
      console.error('❌ Error detecting LinkedIn capabilities:', error);
      console.log('⚠️ Falling back to classic LinkedIn');
    }

    console.log(`🎯 Using LinkedIn API: ${api}`);

    // Helper function to lookup parameter IDs from Unipile
    // Supports LOCATION, COMPANY, INDUSTRY, SCHOOL, etc.
    async function lookupParameterIds(
      paramType: 'LOCATION' | 'COMPANY' | 'INDUSTRY' | 'SCHOOL',
      keywords: string
    ): Promise<string[] | null> {
      try {
        const unipileDSN = process.env.UNIPILE_DSN!;
        const paramUrl = unipileDSN.includes('.')
          ? `https://${unipileDSN}/api/v1/linkedin/search/parameters`
          : `https://${unipileDSN}.unipile.com:13443/api/v1/linkedin/search/parameters`;
        
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

        if (!response.ok) {
          console.error(`❌ ${paramType} lookup failed: ${response.status}`, await response.text());
          return null;
        }

        const data = await response.json();
        console.log(`✅ ${paramType} lookup results:`, JSON.stringify(data, null, 2));

        // Extract IDs from results
        if (data.items && data.items.length > 0) {
          const ids = data.items.map((item: any) => item.id);
          console.log(`✅ Found ${ids.length} ${paramType} ID(s):`, ids);
          return ids;
        } else {
          console.log(`⚠️ No ${paramType} matches found for "${keywords}"`);
          return null;
        }
      } catch (error) {
        console.error(`❌ Error looking up ${paramType} IDs:`, error);
        return null;
      }
    }

    // Call Unipile - format payload correctly
    // UNIPILE_DSN can be either "api6" or "api6.unipile.com:13443" (full domain)
    const unipileDSN = process.env.UNIPILE_DSN!;
    const unipileUrl = unipileDSN.includes('.')
      ? `https://${unipileDSN}/api/v1/linkedin/search`  // Full domain already provided
      : `https://${unipileDSN}.unipile.com:13443/api/v1/linkedin/search`;  // Just subdomain

    // Sales Navigator and Recruiter can handle up to 100, Classic limited to 50
    const maxLimit = (api === 'sales_navigator' || api === 'recruiter') ? 100 : 50;

    const params = new URLSearchParams({
      account_id: linkedinAccount.unipile_account_id,
      limit: String(Math.min(target_count, maxLimit))
    });

    // Build proper Unipile payload with detected API
    const unipilePayload: any = {
      api: api,  // Use detected API (sales_navigator, recruiter, or classic)
      category: 'people' // Default to people search
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

    // Location (city, state, country) - REQUIRES NUMERIC IDs
    if (search_criteria.location) {
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
        console.warn(`⚠️ Could not find location ID for "${search_criteria.location}" - proceeding without location filter`);
      }
    }

    // Company (current company filter) - REQUIRES NUMERIC IDs
    if (search_criteria.company) {
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

    // Industry - REQUIRES NUMERIC IDs
    if (search_criteria.industry) {
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

    // School/University - REQUIRES NUMERIC IDs
    if (search_criteria.school) {
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

    // Connection degree filter - REQUIRED
    // Must be explicitly specified by user
    if (!search_criteria.connectionDegree) {
      console.error('❌ Connection degree not specified');
      return NextResponse.json({
        success: false,
        error: 'Connection degree is required. Please specify "1st", "2nd", or "3rd" degree connections.'
      }, { status: 400 });
    }
    
    const connectionDegree = search_criteria.connectionDegree;
    
    // Map user input to numeric values
    const degreeToNumber: Record<string, number> = {
      '1st': 1,
      '2nd': 2,
      '3rd': 3,
      '1': 1,
      '2': 2,
      '3': 3
    };
    
    const numericDegree = degreeToNumber[connectionDegree];
    
    if (!numericDegree) {
      console.error('❌ Invalid connection degree format:', connectionDegree);
      return NextResponse.json({
        success: false,
        error: 'Invalid connection degree. Must be "1st", "2nd", or "3rd"'
      }, { status: 400 });
    }
    
    // Set the appropriate field based on API type
    if (api === 'sales_navigator' || api === 'recruiter') {
      // Sales Navigator and Recruiter use network_distance with numeric array
      unipilePayload.network_distance = [numericDegree];
      console.log('🎯 Connection degree filter (Sales Nav/Recruiter):', connectionDegree, '→ network_distance:', unipilePayload.network_distance);
    } else {
      // Classic uses network with letter codes
      const classicMap: Record<number, string[]> = {
        1: ['F'],  // First
        2: ['S'],  // Second
        3: ['O']   // Out of network (3rd)
      };
      unipilePayload.network = classicMap[numericDegree];
      console.log('🎯 Connection degree filter (Classic):', connectionDegree, '→ network:', unipilePayload.network);
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

    console.log('🔵 ═══════════════════════════════════════════════════');
    console.log('🔵 UNIPILE SEARCH REQUEST');
    console.log('🔵 API Type:', api);
    console.log('🔵 URL:', `${unipileUrl}?${params}`);
    console.log('🔵 Full Payload:', JSON.stringify(unipilePayload, null, 2));
    console.log('🔵 ═══════════════════════════════════════════════════');

    const response = await fetch(`${unipileUrl}?${params}`, {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.UNIPILE_API_KEY!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(unipilePayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Unipile API error:', response.status, errorText);
      return NextResponse.json({
        success: false,
        error: `LinkedIn search failed: ${response.status}`,
        details: errorText
      }, { status: 500 });
    }

    const data = await response.json();
    console.log('🔵 ═══════════════════════════════════════════════════');
    console.log('🔵 UNIPILE RESPONSE');
    console.log('🔵 Status:', response.status);
    console.log('🔵 Items returned:', data.items?.length || 0);
    console.log('🔵 Response preview:', JSON.stringify(data).substring(0, 500));
    console.log('🔵 ═══════════════════════════════════════════════════');
    
    // Log sample item structure to debug data issues
    if (data.items && data.items.length > 0) {
      console.log('🔵 Sample prospect structure:', JSON.stringify(data.items[0], null, 2));
      console.log('🔵 Available fields in first item:', Object.keys(data.items[0]));
      console.log('🔵 All prospect connection degrees:', data.items.map((item: any, idx: number) => ({
        index: idx,
        name: item.name || `${item.first_name} ${item.last_name}`,
        company: item.company || item.company_name || item.current_positions?.[0]?.company || 'N/A',
        industry: item.industry || item.current_positions?.[0]?.industry || 'N/A',
        headline: item.headline?.substring(0, 50) || 'N/A',
        network: item.network,
        distance: item.distance,
        network_distance: item.network_distance
      })));
    }

    // Use the numeric degree we already calculated
    const requestedDegree = numericDegree;
    
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
      } else {
        // Classic LinkedIn API - company is NOT in separate field!
        // Unipile Classic returns: industry: null, no company field
        // Company is ALWAYS in headline: "Title at Company"
        industry = item.industry || '';

        // ALWAYS parse company from headline for Classic LinkedIn
        if (item.headline) {
          // Headlines format: "Director of Creative Operations at WKNY"
          // Split on " at " and take everything after
          if (item.headline.includes(' at ')) {
            const parts = item.headline.split(' at ');
            if (parts.length > 1) {
              // Take everything after the last " at " (handles "Title at Company at Location")
              company = parts.slice(1).join(' at ').trim();
              console.log(`📌 Extracted company from headline: "${company}"`);
            }
          } else if (item.headline.includes(' | ')) {
            // Alternative format: "Title | Company"
            const parts = item.headline.split(' | ');
            if (parts.length > 1) {
              company = parts[parts.length - 1].trim();
              console.log(`📌 Extracted company from headline (pipe format): "${company}"`);
            }
          } else {
            // No " at " or " | " - might be freelancer or unemployed
            console.log(`⚠️ No company in headline: "${item.headline}"`);
          }
        }

        // Fallback to separate company fields (Sales Navigator older format)
        if (!company) {
          company = item.company || item.company_name || item.current_company || '';
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
      let connectionDegree = requestedDegree;

      console.log(`🔍 RAW DATA for ${firstName} ${lastName}:`, {
        network: item.network,
        network_distance: item.network_distance,
        distance: item.distance,
        requestedDegree
      });

      // Priority order: network_distance > network > distance > requestedDegree
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
            connectionDegree = numMatch ? parseInt(numMatch[1]) : requestedDegree;
            console.log(`  ⚠️ Parsed number from network_distance: ${item.network_distance} → ${connectionDegree}`);
          }
        } else if (typeof item.network_distance === 'number') {
          connectionDegree = item.network_distance;
          console.log(`  ✓ Used item.network_distance (number): ${item.network_distance} → ${connectionDegree}`);
        }
      } else if (item.network) {
        // Classic API: 'F' (1st), 'S' (2nd), 'O' (3rd)
        connectionDegree = networkToNumber[item.network] || requestedDegree;
        console.log(`  ✓ Used item.network: ${item.network} → ${connectionDegree}`);
      } else if (item.distance !== undefined && item.distance !== null) {
        // Some APIs use 'distance' field
        connectionDegree = parseInt(String(item.distance)) || requestedDegree;
        console.log(`  ✓ Used item.distance: ${item.distance} → ${connectionDegree}`);
      } else {
        console.log(`  ⚠️ No degree field found, using requested: ${requestedDegree}`);
      }

      // Ensure connectionDegree is always a valid integer between 1-3
      const finalDegree = Math.max(1, Math.min(3, parseInt(String(connectionDegree)) || requestedDegree));
      console.log(`  📌 FINAL connectionDegree: ${finalDegree}`);
      connectionDegree = finalDegree;
      
      // STRICT FILTERING: Only return prospects matching requested degree
      if (connectionDegree !== requestedDegree) {
        console.log(`⚠️ FILTERING OUT: ${firstName} ${lastName} - connection degree ${connectionDegree} doesn't match requested ${requestedDegree}`);
        return null; // Filter out mismatched degrees
      }

      // Extract location
      const location = item.location || item.geo_region || '';

      return {
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        title,
        company,
        industry,
        location,
        linkedinUrl,
        connectionDegree
      };
    }).filter(p => p !== null); // Remove prospects without names AND mismatched connection degrees

    console.log(`🔵 Mapped ${prospects.length} prospects (filtered out prospects without names and mismatched connection degrees)`);

    // Log how many were rejected due to missing data or degree mismatch
    const rejectedCount = (data.items?.length || 0) - prospects.length;
    if (rejectedCount > 0) {
      console.log(`⚠️ Rejected ${rejectedCount} prospects due to missing name data or connection degree mismatch`);
    }

    // Save to workspace_prospects with correct column names
    // Filter out prospects without LinkedIn URLs (required field)
    const validProspects = prospects.filter((p: any) => p.linkedinUrl);
    console.log(`🔵 Valid prospects with LinkedIn URLs: ${validProspects.length}/${prospects.length}`);

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
        company_name: p.company || null,
        linkedin_profile_url: p.linkedinUrl
      }));

      console.log('🔵 Inserting to database (workspace_prospects, best-effort):', JSON.stringify(toInsert[0]));
      // Use admin client to bypass RLS for workspace_prospects insert; this is best-effort and non-fatal
      try {
        const admin = supabaseAdmin();
        const { data: inserted, error: insertError } = await admin
          .from('workspace_prospects')
          .insert(toInsert)
          .select();

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
      const { data: workspace, error: workspaceError } = await supabase
        .from('workspaces')
        .select('name, id, owner_id')
        .eq('id', workspaceId)
        .single();

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
      const { data: existingSessions } = await supabase
        .from('prospect_approval_sessions')
        .select('batch_number')
        .eq('user_id', user.id)
        .eq('workspace_id', workspaceId)
        .order('batch_number', { ascending: false })
        .limit(1);

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
        const { count } = await supabase
          .from('prospect_approval_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId);

        const searchNumber = String((count || 0) + 1).padStart(2, '0'); // 01, 02, 03...
        campaignName = `${today}-${companyCode}-Search ${searchNumber}`;
      }

      const campaignTag = search_criteria.keywords || api; // Use keywords or API type as tag

      console.log(`📋 Campaign: ${campaignName}, Tag: ${campaignTag}`);

      const { error: sessionError } = await supabase
        .from('prospect_approval_sessions')
        .insert({
          id: sessionId,
          batch_number: nextBatchNumber, // Auto-incremented to avoid duplicates
          user_id: user.id,
          workspace_id: workspaceId, // CORRECTED: workspace_id not organization_id
          prospect_source: 'linkedin_search',
          campaign_name: campaignName,  // NEW: Proper campaign name
          campaign_tag: campaignTag,     // NEW: Campaign tag
          total_prospects: validProspects.length,
          pending_count: validProspects.length,
          approved_count: 0,
          rejected_count: 0,
          status: 'active', // CORRECTED: Valid values are 'active' or 'completed'
          icp_criteria: {}, // REQUIRED: Default empty object
          learning_insights: {}, // REQUIRED: Default empty object
          created_at: new Date().toISOString()
        });

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
          company: {  // CORRECTED: company is JSONB object
            name: p.company || '',
            size: '',
            website: '',
            industry: p.industry || ''  // FIXED: Save industry from LinkedIn data
          },
          contact: {  // CORRECTED: contact is JSONB object
            email: '',
            linkedin_url: p.linkedinUrl || ''
          },
          location: p.location || '',
          profile_image: '',
          recent_activity: '',
          connection_degree: p.connectionDegree,  // FIXED: Use actual connection degree from search
          enrichment_score: 80,  // CORRECTED: number not decimal
          source: `linkedin_${api}`,
          enriched_at: new Date().toISOString(),
          // NO approval_status column!
          created_at: new Date().toISOString()
        }));

        const { error: prospectsError } = await supabase
          .from('prospect_approval_data')
          .insert(approvalProspects);

        if (prospectsError) {
          console.error('❌ Approval prospects error:', prospectsError);
          persistenceFailed = true;
          persistenceErrors.push(`prospect_approval_data: ${prospectsError.message}`);
        } else {
          console.log(`✅ Added ${approvalProspects.length} prospects to approval session`);
        }
      }
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

    return NextResponse.json({
      success: true,
      prospects: validProspects,
      count: validProspects.length,
      total_found: prospects.length,
      api: api,
      session_id: sessionId,
      persistence_warnings: persistenceErrors.length > 0 ? persistenceErrors : undefined
    });

  } catch (error) {
    console.error('Simple search error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Search failed'
    }, { status: 500 });
  }
}
