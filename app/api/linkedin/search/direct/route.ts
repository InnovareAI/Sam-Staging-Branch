import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

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

    // Get user's workspace
    const { data: userProfile } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', user.id)
      .single();

    const workspaceId = userProfile?.current_workspace_id;

    if (!workspaceId) {
      return NextResponse.json({
        success: false,
        error: 'No workspace found. Please create or join a workspace first.'
      }, { status: 400 });
    }

    // Get user's LinkedIn account
    const { data: linkedinAccount } = await supabase
      .from('user_unipile_accounts')
      .select('unipile_account_id')
      .eq('user_id', user.id)
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

    // Auto-detect LinkedIn capabilities
    let api = 'classic';
    try {
      const accountInfoResponse = await fetch(
        `https://${process.env.UNIPILE_DSN}.unipile.com:13443/api/v1/accounts/${linkedinAccount.unipile_account_id}`,
        {
          headers: {
            'X-API-KEY': process.env.UNIPILE_API_KEY!,
            'Accept': 'application/json'
          }
        }
      );

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

    // Call Unipile directly
    const searchUrl = new URL(`https://${process.env.UNIPILE_DSN}.unipile.com:13443/api/v1/linkedin/search`);
    searchUrl.searchParams.append('account_id', linkedinAccount.unipile_account_id);
    searchUrl.searchParams.append('limit', limitedTarget.toString());

    const searchPayload = {
      ...search_criteria,
      api
    };

    console.log(`🚀 Calling Unipile: ${searchUrl.toString()}`);

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

      // LinkedIn specific
      linkedinUrl: item.profile_url,
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
    if (save_to_approval && prospects.length > 0) {
      console.log(`💾 Saving ${prospects.length} prospects to approval system...`);

      // Generate campaign name
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const campaignName = `${today}-LinkedIn-Search`;

      // Save to workspace_prospects table for approval
      const prospectsToInsert = prospects.map(p => ({
        workspace_id: workspaceId,
        name: p.name,
        first_name: p.firstName,
        last_name: p.lastName,
        title: p.title,
        company: p.company,
        linkedin_url: p.linkedinUrl,
        location: p.location,
        headline: p.headline,
        industry: p.industry,
        connection_degree: p.connectionDegree,
        source: p.source,
        campaign_name: campaignName,
        approval_status: 'pending',
        created_at: new Date().toISOString()
      }));

      const { data: insertedProspects, error: insertError } = await supabase
        .from('workspace_prospects')
        .insert(prospectsToInsert)
        .select();

      if (insertError) {
        console.error('❌ Failed to save prospects:', insertError);
        // Don't fail the request - we still have the data
      } else {
        console.log(`✅ Saved ${insertedProspects?.length || 0} prospects to approval system`);
      }
    }

    return NextResponse.json({
      success: true,
      prospects: prospects,
      count: prospects.length,
      api: api,
      saved_to_approval: save_to_approval,
      message: `Found ${prospects.length} prospects${save_to_approval ? ' and saved to Data Approval' : ''}`
    });

  } catch (error) {
    console.error('❌ Direct search error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search LinkedIn',
      debug: {
        error_type: error instanceof Error ? error.constructor.name : typeof error
      }
    }, { status: 500 });
  }
}
