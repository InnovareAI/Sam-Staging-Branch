import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Import prospects from a LinkedIn Sales Navigator saved search
 * POST /api/linkedin/import-saved-search
 */
export async function POST(request: NextRequest) {
  console.log('🔍 SAVED SEARCH IMPORT START');

  try {
    // Check for internal auth headers (when called from SAM)
    const internalAuth = request.headers.get('X-Internal-Auth');
    const internalUserId = request.headers.get('X-User-Id');
    const internalWorkspaceId = request.headers.get('X-Workspace-Id');

    let user: any = null;
    let workspaceId: string | null = null;

    if (internalAuth === 'true' && internalUserId) {
      // Internal call from SAM - use service role to verify user exists
      console.log('🔐 Internal auth detected from SAM');
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('id, email, current_workspace_id')
        .eq('id', internalUserId)
        .single();

      if (userData) {
        user = userData;
        workspaceId = internalWorkspaceId || userData.current_workspace_id;
        console.log(`✅ Internal auth successful: ${user.email}, workspace: ${workspaceId}`);
      }
    }

    // Fall back to cookie-based auth if internal auth not used
    if (!user) {
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

      const { data: { user: cookieUser } } = await supabase.auth.getUser();
      if (!cookieUser) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      user = cookieUser;
    }

    const { saved_search_url, campaign_name } = await request.json();

    if (!saved_search_url) {
      return NextResponse.json({
        success: false,
        error: 'saved_search_url is required'
      }, { status: 400 });
    }

    console.log(`🔍 Importing from saved search URL: ${saved_search_url}`);

    // Get workspace if not already set
    if (!workspaceId) {
      const { data: userProfile } = await supabaseAdmin
        .from('users')
        .select('current_workspace_id')
        .eq('id', user.id)
        .single();

      workspaceId = userProfile?.current_workspace_id || null;
    }

    if (!workspaceId) {
      return NextResponse.json({
        success: false,
        error: 'No workspace found'
      }, { status: 400 });
    }

    // Get LinkedIn account
    const { data: linkedInAccounts } = await supabaseAdmin
      .from('workspace_accounts')
      .select('unipile_account_id, account_name')
      .eq('workspace_id', workspaceId)
      .eq('account_type', 'linkedin')
      .eq('connection_status', 'connected');

    if (!linkedInAccounts || linkedInAccounts.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No LinkedIn account connected. Please connect your LinkedIn account first.'
      }, { status: 400 });
    }

    const linkedInAccount = linkedInAccounts[0];
    console.log(`✅ Using LinkedIn account: ${linkedInAccount.account_name}`);

    // Call Unipile API to fetch prospects from saved search
    const UNIPILE_DSN = process.env.UNIPILE_DSN || 'api6';
    const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

    if (!UNIPILE_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'Unipile API not configured'
      }, { status: 500 });
    }

    const searchUrl = UNIPILE_DSN.includes('.')
      ? `https://${UNIPILE_DSN}/api/v1/linkedin/search`
      : `https://${UNIPILE_DSN}.unipile.com:13443/api/v1/linkedin/search`;

    const params = new URLSearchParams({
      account_id: linkedInAccount.unipile_account_id,
      limit: '50' // Max 50 for saved searches
    });

    const searchPayload = {
      url: saved_search_url
    };

    console.log('🌐 Calling Unipile:', `${searchUrl}?${params}`);
    console.log('📦 Payload:', JSON.stringify(searchPayload, null, 2));

    const searchResponse = await fetch(`${searchUrl}?${params}`, {
      method: 'POST',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(searchPayload)
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('❌ Unipile search failed:', errorText);
      return NextResponse.json({
        success: false,
        error: `Unipile API error: ${searchResponse.status} ${searchResponse.statusText}`
      }, { status: 500 });
    }

    const searchData = await searchResponse.json();
    const prospects = searchData.items || [];

    console.log(`✅ Retrieved ${prospects.length} prospects from saved search`);

    // Extract savedSearchId from URL early for use in messages
    const searchIdMatch = saved_search_url.match(/savedSearchId=(\d+)/);
    const savedSearchId = searchIdMatch ? searchIdMatch[1] : Date.now().toString().slice(-6);

    if (prospects.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        campaign_name: campaign_name || `Saved Search ${savedSearchId}`,
        message: 'No prospects found in this saved search'
      });
    }

    // Create prospect approval session
    const sessionId = uuidv4();
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');

    // Get workspace for company code
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('name')
      .eq('id', workspaceId)
      .single();

    const companyCode = workspace?.name?.substring(0, 3).toUpperCase() || 'IAI';

    const finalCampaignName = campaign_name || `${today}-${companyCode}-SavedSearch-${savedSearchId}`;

    // Get next batch number
    const { data: existingSessions } = await supabaseAdmin
      .from('prospect_approval_sessions')
      .select('batch_number')
      .eq('user_id', user.id)
      .eq('workspace_id', workspaceId)
      .order('batch_number', { ascending: false })
      .limit(1);

    const nextBatchNumber = (existingSessions?.[0]?.batch_number || 0) + 1;

    // Create session
    const { error: sessionError } = await supabaseAdmin
      .from('prospect_approval_sessions')
      .insert({
        id: sessionId,
        batch_number: nextBatchNumber,
        user_id: user.id,
        workspace_id: workspaceId,
        campaign_name: finalCampaignName,
        campaign_tag: `saved_search_${savedSearchId}`,
        total_prospects: prospects.length,
        approved_count: 0,
        rejected_count: 0,
        pending_count: prospects.length,
        session_status: 'active',
        created_at: new Date().toISOString()
      });

    if (sessionError) {
      console.error('❌ Session creation failed:', sessionError);
      return NextResponse.json({
        success: false,
        error: 'Failed to create approval session'
      }, { status: 500 });
    }

    // Insert prospects into prospect_approval_data
    const approvalProspects = prospects.map((item: any, index: number) => ({
      id: uuidv4(),
      session_id: sessionId,
      workspace_id: workspaceId,
      prospect_order: index + 1,
      full_name: item.name || `${item.first_name || ''} ${item.last_name || ''}`.trim(),
      first_name: item.first_name,
      last_name: item.last_name,
      title: item.headline || item.current_positions?.[0]?.role,
      company: item.current_positions?.[0]?.company,
      location: item.location || item.geo_region,
      linkedin_url: item.profile_url || item.public_profile_url,
      profile_photo_url: item.profile_picture_url,
      headline: item.headline,
      summary: item.summary,
      raw_data: item,
      created_at: new Date().toISOString()
    }));

    const { error: prospectsError } = await supabaseAdmin
      .from('prospect_approval_data')
      .insert(approvalProspects);

    if (prospectsError) {
      console.error('❌ Prospects insert failed:', prospectsError);
      return NextResponse.json({
        success: false,
        error: 'Failed to save prospects'
      }, { status: 500 });
    }

    console.log(`✅ Imported ${prospects.length} prospects successfully`);

    return NextResponse.json({
      success: true,
      count: prospects.length,
      campaign_name: finalCampaignName,
      session_id: sessionId
    });

  } catch (error) {
    console.error('❌ Import saved search error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
