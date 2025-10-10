import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * SIMPLE LinkedIn Search - Minimal version that just works
 * No fancy features, just get results
 * Force rebuild: 2025-10-10-v2
 */
export async function POST(request: NextRequest) {
  console.log('🔵 SIMPLE SEARCH START');
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

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

    // Get LinkedIn account
    const { data: linkedinAccount } = await supabase
      .from('user_unipile_accounts')
      .select('unipile_account_id')
      .eq('user_id', user.id)
      .eq('platform', 'LINKEDIN')
      .single();

    if (!linkedinAccount) {
      return NextResponse.json({ error: 'LinkedIn not connected' }, { status: 400 });
    }

    // Auto-detect LinkedIn capabilities (Sales Navigator, Recruiter, or Classic)
    let api = 'classic';
    try {
      const unipileDSN = process.env.UNIPILE_DSN!;
      const accountUrl = unipileDSN.includes('.')
        ? `https://${unipileDSN}/api/v1/accounts/${linkedinAccount.unipile_account_id}`
        : `https://${unipileDSN}.unipile.com:13443/api/v1/accounts/${linkedinAccount.unipile_account_id}`;

      const accountInfoResponse = await fetch(accountUrl, {
        headers: {
          'X-API-KEY': process.env.UNIPILE_API_KEY!,
          'Accept': 'application/json'
        }
      });

      if (accountInfoResponse.ok) {
        const accountInfo = await accountInfoResponse.json();
        const premiumFeatures = accountInfo.connection_params?.im?.premiumFeatures || [];

        if (premiumFeatures.includes('recruiter')) {
          api = 'recruiter';
        } else if (premiumFeatures.includes('sales_navigator')) {
          api = 'sales_navigator';
        }
      }
    } catch (error) {
      console.warn('Could not detect LinkedIn capabilities, using classic:', error);
    }

    console.log(`🎯 Using LinkedIn API: ${api}`);

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

    // Combine title + keywords into single keywords field
    const keywordParts = [];
    if (search_criteria.title) keywordParts.push(search_criteria.title);
    if (search_criteria.keywords) keywordParts.push(search_criteria.keywords);
    if (keywordParts.length > 0) {
      unipilePayload.keywords = keywordParts.join(' ');
    }

    // CRITICAL FIX: Parse and add connection degree filter
    if (search_criteria.connectionDegree) {
      // Convert "1st", "2nd", "3rd" to proper format for Unipile
      const degreeMap: Record<string, string[]> = {
        '1st': ['F'],      // First-degree (F = First)
        '2nd': ['S'],      // Second-degree (S = Second)
        '3rd': ['O'],      // Third-degree (O = Out of network)
        '1': ['F'],
        '2': ['S'],
        '3': ['O']
      };

      // Unipile uses 'network' parameter with values: F, S, O
      // F = First degree, S = Second degree, O = Third+ degree
      unipilePayload.network = degreeMap[search_criteria.connectionDegree] || ['F', 'S', 'O'];
      console.log('🎯 Connection degree filter:', search_criteria.connectionDegree, '→', unipilePayload.network);
    } else {
      // Default: search all connection degrees
      console.log('🎯 No connection degree specified, searching all degrees');
    }

    console.log('🔵 Unipile payload:', JSON.stringify(unipilePayload));

    const response = await fetch(`${unipileUrl}?${params}`, {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.UNIPILE_API_KEY!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(unipilePayload)
    });

    const data = await response.json();
    console.log('🔵 Unipile response:', JSON.stringify(data).substring(0, 500));

    // Extract requested connection degree for saving
    // Convert network notation back to numeric degree: F→1, S→2, O→3
    const networkToNumber: Record<string, number> = { 'F': 1, 'S': 2, 'O': 3 };
    const requestedDegree = unipilePayload.network?.[0]
      ? (networkToNumber[unipilePayload.network[0]] || 2)
      : 2;

    const prospects = (data.items || []).map((item: any) => {
      // Handle name - Classic gives full name, Sales Nav gives first/last
      let firstName = item.first_name || 'Unknown';
      let lastName = item.last_name || 'Unknown';

      if (!item.first_name && item.name) {
        // Classic API - split full name
        const nameParts = item.name.trim().split(' ');
        firstName = nameParts[0] || 'Unknown';
        lastName = nameParts.slice(1).join(' ') || 'Unknown';
      }

      // Handle title - Classic uses "headline", Sales Nav uses "current_positions"
      let title = item.headline || '';
      if (item.current_positions && item.current_positions.length > 0) {
        title = item.current_positions[0].role || item.headline || '';
      }

      // Handle company - only in Sales Nav current_positions
      let company = '';
      if (item.current_positions && item.current_positions.length > 0) {
        company = item.current_positions[0].company || '';
      }

      // LinkedIn URL - both APIs use profile_url
      const linkedinUrl = item.profile_url || item.public_profile_url || '';

      // Connection degree from Unipile data (or use requested degree as fallback)
      // Unipile returns network as 'F', 'S', 'O' - convert to number
      let connectionDegree = requestedDegree;
      if (item.network) {
        connectionDegree = networkToNumber[item.network] || requestedDegree;
      } else if (item.network_distance) {
        connectionDegree = item.network_distance;
      }

      return {
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        title,
        company,
        linkedinUrl,
        connectionDegree
      };
    });

    console.log(`🔵 Mapped ${prospects.length} prospects`);

    // Save to workspace_prospects with correct column names
    // Filter out prospects without LinkedIn URLs (required field)
    const validProspects = prospects.filter((p: any) => p.linkedinUrl);
    console.log(`🔵 Valid prospects with LinkedIn URLs: ${validProspects.length}/${prospects.length}`);

    if (validProspects.length > 0) {
      const toInsert = validProspects.map((p: any) => ({
        workspace_id: workspaceId,
        first_name: p.firstName,
        last_name: p.lastName,
        job_title: p.title || null,
        company_name: p.company || null,
        linkedin_profile_url: p.linkedinUrl
      }));

      console.log('🔵 Inserting to database:', JSON.stringify(toInsert[0]));
      const { data: inserted, error: insertError } = await supabase
        .from('workspace_prospects')
        .insert(toInsert)
        .select();

      if (insertError) {
        console.error('❌ Insert error:', insertError);
      } else {
        console.log(`✅ Inserted ${inserted?.length || 0} prospects`);
      }

      // CRITICAL: Create approval session so prospects show in Data Approval tab
      console.log('📋 Creating approval session...');
      const sessionId = crypto.randomUUID(); // CORRECTED: Must be UUID not string

      // Generate campaign name: YYYYMMDD-COMPANYCODE-CampaignName
      const today = new Date().toISOString().split('T')[0].replace(/-/g, ''); // 20251011

      // Get workspace name for company code
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('name')
        .eq('id', workspaceId)
        .single();

      // Generate company code from workspace name (e.g., "InnovareAI" → "IAI")
      const generateCompanyCode = (name: string): string => {
        if (!name) return 'CLI';
        const cleanName = name.replace(/[^a-zA-Z0-9]/g, '');
        const capitals = cleanName.match(/[A-Z]/g);
        if (capitals && capitals.length >= 3) {
          return capitals.slice(0, 3).join('');
        }
        if (/^\d/.test(cleanName)) {
          return (cleanName.substring(0, 1) + cleanName.substring(1, 3).toUpperCase()).padEnd(3, 'X');
        }
        return cleanName.substring(0, 3).toUpperCase().padEnd(3, 'X');
      };

      const companyCode = generateCompanyCode(workspace?.name || '');

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
          batch_number: 1, // REQUIRED: NOT NULL constraint
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
            industry: ''
          },
          contact: {  // CORRECTED: contact is JSONB object
            email: '',
            linkedin_url: p.linkedinUrl || ''
          },
          location: '',
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
        } else {
          console.log(`✅ Added ${approvalProspects.length} prospects to approval session`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      prospects: validProspects,
      count: validProspects.length,
      total_found: prospects.length,
      api: api  // Show which API was used
    });

  } catch (error) {
    console.error('Simple search error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Search failed'
    }, { status: 500 });
  }
}
