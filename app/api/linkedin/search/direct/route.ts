import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

/**
 * Direct LinkedIn Search - No Background Jobs
 *
 * Executes LinkedIn search synchronously and returns results immediately.
 * Limited to 100 prospects to fit within Netlify 10s timeout.
 * Perfect for 90% of use cases - fast and reliable.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const {
      search_criteria,
      target_count = 100,
      save_to_approval = true // Save to prospect approval by default
    } = body;

    // Hard limit to 100 for speed (fits in 10s Netlify timeout)
    const limitedTarget = Math.min(target_count, 100);

    console.log(`🔍 Direct search for ${user.email}: ${limitedTarget} prospects`);

    // Get user's workspace with fallback logic
    let workspaceId: string | null = null;

    // Try to get current workspace from users table
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single();

    console.log('📊 Workspace check:', {
      userId: user.id,
      currentWorkspaceId: userProfile?.current_workspace_id,
      profileError: profileError?.message
    });

    if (userProfile?.current_workspace_id) {
      workspaceId = userProfile.current_workspace_id;
      console.log('✅ Using workspace from users table:', workspaceId);
    } else {
      // Fallback: get first workspace from memberships
      console.log('⚠️ No current_workspace_id, trying workspace_members...');

      const { data: membership, error: membershipError } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      console.log('📊 Membership check:', {
        found: !!membership,
        workspaceId: membership?.workspace_id,
        error: membershipError?.message
      });

      if (membership?.workspace_id) {
        workspaceId = membership.workspace_id;
        console.log('✅ Using workspace from memberships:', workspaceId);

        // Update user's current workspace for next time
        await supabase
          .from('users')
          .update({ current_workspace_id: membership.workspace_id })
          .eq('id', user.id);

        console.log('💾 Updated user current_workspace_id');
      }
    }

    if (!workspaceId) {
      console.error('❌ No workspace found for user:', user.id);
      return NextResponse.json({
        success: false,
        error: 'No workspace found. Please create or join a workspace first.',
        debug: {
          userId: user.id,
          userEmail: user.email,
          hadCurrentWorkspace: !!userProfile?.current_workspace_id,
          checkedMemberships: true
        }
      }, { status: 400 });
    }

    console.log('✅ Final workspace ID:', workspaceId);

    // Get LinkedIn account from workspace_accounts table
    // Get any workspace member's LinkedIn account (can be shared across team)
    const { data: linkedinAccounts } = await supabase
      .from('workspace_accounts')
      .select('unipile_account_id, account_name, account_identifier')
      .eq('workspace_id', workspaceId)
      .eq('account_type', 'linkedin')
      .eq('connection_status', 'connected');

    console.log('🔵 LinkedIn accounts found:', linkedinAccounts?.length || 0);

    if (!linkedinAccounts || linkedinAccounts.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No active LinkedIn account found. Please connect a LinkedIn account to your workspace first.',
        action: 'connect_linkedin'
      }, { status: 400 });
    }

    // Use the first available LinkedIn account
    const linkedinAccount = linkedinAccounts[0];
    console.log('✅ Using LinkedIn account:', linkedinAccount.account_name || linkedinAccount.account_identifier);

    // Auto-detect LinkedIn capabilities
    let api = 'classic';
    try {
      // UNIPILE_DSN format: "api6.unipile.com:13670" - already includes domain and port
      const accountInfoUrl = `https://${process.env.UNIPILE_DSN}/api/v1/accounts/${linkedinAccount.unipile_account_id}`;
      const accountInfoResponse = await fetch(accountInfoUrl, {
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
      console.warn('Could not detect LinkedIn capabilities, using classic');
    }

    console.log(`📊 Using LinkedIn API: ${api}`);

    // Validate Unipile configuration
    if (!process.env.UNIPILE_DSN || !process.env.UNIPILE_API_KEY) {
      console.error('❌ Missing Unipile credentials:', {
        hasDSN: !!process.env.UNIPILE_DSN,
        hasAPIKey: !!process.env.UNIPILE_API_KEY
      });
      return NextResponse.json({
        success: false,
        error: 'LinkedIn integration not configured. Please contact support.',
        debug: {
          missingUnipileDSN: !process.env.UNIPILE_DSN,
          missingUnipileAPIKey: !process.env.UNIPILE_API_KEY
        }
      }, { status: 500 });
    }

    // Call Unipile directly
    let searchUrl;
    try {
      // UNIPILE_DSN format: "api6.unipile.com:13670" - already includes domain and port
      const unipileBaseUrl = `https://${process.env.UNIPILE_DSN}/api/v1/linkedin/search`;
      searchUrl = new URL(unipileBaseUrl);
      searchUrl.searchParams.append('account_id', linkedinAccount.unipile_account_id);
      searchUrl.searchParams.append('limit', limitedTarget.toString());
      console.log(`🔗 Unipile URL: ${searchUrl.toString().substring(0, 80)}...`);
    } catch (urlError) {
      console.error('❌ Failed to construct Unipile URL:', urlError);
      return NextResponse.json({
        success: false,
        error: 'Invalid URL configuration',
        debug: {
          error: urlError instanceof Error ? urlError.message : String(urlError),
          unipileDSN: process.env.UNIPILE_DSN?.substring(0, 10) + '...',
          accountId: linkedinAccount.unipile_account_id?.substring(0, 10) + '...'
        }
      }, { status: 500 });
    }

    const searchPayload = {
      ...search_criteria,
      api
    };

    console.log(`🚀 Calling Unipile with payload:`, JSON.stringify(searchPayload).substring(0, 200));

    const unipileResponse = await fetch(searchUrl.toString(), {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.UNIPILE_API_KEY!,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(searchPayload)
    });

    if (!unipileResponse.ok) {
      const errorData = await unipileResponse.json().catch(() => ({}));
      console.error('❌ Unipile API error:', errorData);
      return NextResponse.json({
        success: false,
        error: `LinkedIn search failed: ${unipileResponse.status} - ${JSON.stringify(errorData)}`,
        debug: {
          status: unipileResponse.status,
          api: api,
          search_criteria: search_criteria
        }
      }, { status: 500 });
    }

    const data = await unipileResponse.json();
    const items = data.items || [];

    console.log(`✅ Found ${items.length} prospects from Unipile`);

    // Helper function to clean LinkedIn URLs
    const cleanLinkedInUrl = (url: string): string => {
      if (!url) return '';
      try {
        const urlObj = new URL(url);
        // Remove all query parameters (miniProfileUrn, etc.)
        urlObj.search = '';
        // Remove trailing slash
        let cleanUrl = urlObj.toString().replace(/\/$/, '');
        // Extract just the profile identifier
        if (cleanUrl.includes('linkedin.com/in/')) {
          const match = cleanUrl.match(/linkedin\.com\/in\/([^/?#]+)/);
          if (match) {
            return `https://www.linkedin.com/in/${match[1]}`;
          }
        }
        return cleanUrl;
      } catch (error) {
        console.error('Error cleaning LinkedIn URL:', url, error);
        return url;
      }
    };

    // Transform prospects to our format
    const prospects = items.map((item: any) => ({
      // Basic info
      name: item.name || `${item.first_name || ''} ${item.last_name || ''}`.trim(),
      firstName: item.first_name,
      lastName: item.last_name,
      headline: item.headline,

      // Professional info
      title: item.title || item.headline,
      company: item.company_name || item.current_company,
      industry: item.industry,

      // LinkedIn specific - CRITICAL FIX
      // Store provider_id (authoritative LinkedIn user ID that doesn't change)
      // and cleaned LinkedIn URL (remove query parameters)
      providerId: item.provider_id,
      linkedinUrl: cleanLinkedInUrl(item.profile_url),
      publicIdentifier: item.public_identifier,

      // Location
      location: item.location,
      country: item.country,

      // Connection info
      connectionDegree: item.network_distance || item.connection_degree,

      // Metadata
      source: 'linkedin_search',
      searchApi: api,
      searchedAt: new Date().toISOString()
    }));

    // If requested, save to prospect approval system
    let sessionId = null;
    if (save_to_approval && prospects.length > 0) {
      console.log(`💾 Saving ${prospects.length} prospects to approval system...`);

      // Generate campaign name and tag
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const campaignName = `${today}-LinkedIn-Search`;
      const campaignTag = search_criteria.keywords || search_criteria.title || 'LinkedIn Search';

      try {
        // Step 1: Create approval session
        const { data: session, error: sessionError } = await supabase
          .from('prospect_approval_sessions')
          .insert({
            user_id: user.id,
            workspace_id: workspaceId,
            campaign_name: campaignName,
            campaign_tag: campaignTag,
            status: 'active',
            total_prospects: prospects.length,
            pending_count: prospects.length,
            approved_count: 0,
            rejected_count: 0,
            source: 'linkedin_direct_search',
            icp_criteria: search_criteria,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (sessionError) {
          console.error('❌ Failed to create approval session:', sessionError);
          throw sessionError;
        }

        sessionId = session.id;
        console.log(`✅ Created approval session: ${sessionId.substring(0, 8)}`);

        // Step 2: Insert prospects into approval_data
        const prospectsToInsert = prospects.map((p, index) => ({
          session_id: sessionId,
          prospect_id: `linkedin_${p.publicIdentifier || index}_${Date.now()}`,
          name: p.name,
          title: p.title,
          company: p.company,
          location: p.location,
          profile_image: null, // LinkedIn doesn't provide images via search API
          contact: {
            linkedin: p.linkedinUrl,
            linkedin_provider_id: p.providerId, // Store authoritative LinkedIn ID
            public_identifier: p.publicIdentifier,
            email: null // Not available from search
          },
          recent_activity: p.headline,
          connection_degree: p.connectionDegree || 'Unknown',
          enrichment_score: 50, // Default score
          source: 'linkedin_direct_search',
          enriched_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        }));

        const { data: insertedProspects, error: insertError } = await supabase
          .from('prospect_approval_data')
          .insert(prospectsToInsert)
          .select();

        if (insertError) {
          console.error('❌ Failed to save prospects to approval_data:', insertError);
          // Clean up session on failure
          await supabase
            .from('prospect_approval_sessions')
            .delete()
            .eq('id', sessionId);
          throw insertError;
        }

        console.log(`✅ Saved ${insertedProspects?.length || 0} prospects to approval system (session: ${sessionId.substring(0, 8)})`);

      } catch (saveError) {
        console.error('❌ Error saving to approval system:', saveError);
        // Don't fail the request - we still have the data
      }
    }

    return NextResponse.json({
      success: true,
      prospects: prospects,
      count: prospects.length,
      api: api,
      saved_to_approval: save_to_approval,
      session_id: sessionId,
      message: `Found ${prospects.length} prospects${save_to_approval ? ' and saved to Data Approval' : ''}`
    });

  } catch (error) {
    console.error('❌ Direct search error:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search LinkedIn',
      debug: {
        error_type: error instanceof Error ? error.constructor.name : typeof error,
        error_stack: error instanceof Error ? error.stack?.split('\n')[0] : 'No stack',
        user_authenticated: true // We got past auth to reach here
      }
    }, { status: 500 });
  }
}
