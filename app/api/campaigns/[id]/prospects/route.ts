import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

// Service role client for bypassing RLS on prospect_approval_data queries
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🔍 [PROSPECTS API] Request started for campaign:', params.id);

    // Use route client that handles auth headers properly
    const supabase = await createSupabaseRouteClient();
    console.log('✅ [PROSPECTS API] Supabase client created');

    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('🔐 [PROSPECTS API] Auth check:', { hasUser: !!user, authError: authError?.message });

    if (authError || !user) {
      console.error('❌ [PROSPECTS API] Auth failed:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaignId = params.id;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    console.log('📋 [PROSPECTS API] Query params:', { campaignId, status, limit, offset });

    // Verify campaign exists and user has access
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('workspace_id')
      .eq('id', campaignId)
      .single();

    console.log('🏢 [PROSPECTS API] Campaign lookup:', {
      found: !!campaign,
      workspaceId: campaign?.workspace_id,
      error: campaignError?.message
    });

    if (campaignError || !campaign) {
      console.error('❌ [PROSPECTS API] Campaign not found:', campaignError);
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    console.log('📊 Fetching prospects for campaign:', campaignId, 'workspace:', campaign.workspace_id);

    // Build query for campaign prospects
    // Note: campaign_prospects has all prospect data directly (first_name, last_name, etc.)
    // IMPORTANT: Include workspace_id to ensure RLS policies work correctly
    let query = supabase
      .from('campaign_prospects')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('workspace_id', campaign.workspace_id);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: prospects, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('❌ Failed to fetch campaign prospects:', error);
      return NextResponse.json({
        error: 'Failed to fetch campaign prospects',
        details: error.message
      }, { status: 500 });
    }

    console.log('✅ Found', prospects?.length || 0, 'prospects for campaign', campaignId);

    // Map company_name to company for frontend compatibility
    const mappedProspects = (prospects || []).map(p => ({
      ...p,
      company: p.company_name || p.company || null
    }));

    // Get total count
    const { count, error: countError } = await supabase
      .from('campaign_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId);

    return NextResponse.json({
      prospects: mappedProspects,
      total: count || 0,
      limit,
      offset
    });

  } catch (error: any) {
    console.error('❌ [PROSPECTS API] Fatal error:', error);
    console.error('❌ [PROSPECTS API] Error stack:', error.stack);
    console.error('❌ [PROSPECTS API] Error details:', {
      name: error.name,
      message: error.message,
      cause: error.cause
    });
    return NextResponse.json(
      {
        error: 'Failed to fetch campaign prospects',
        details: error.message,
        errorName: error.name
      },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Use route client that handles auth headers properly
    const supabase = await createSupabaseRouteClient();

    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaignId = params.id;
    const body = await req.json();

    // Verify campaign exists and user has access
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('workspace_id')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Handle two modes: prospect_ids (existing prospects) or prospects (new prospect data)
    if (body.prospect_ids && Array.isArray(body.prospect_ids)) {
      // Mode 1: Add existing prospects to campaign
      // These can be from workspace_prospects (UUIDs) or prospect_approval_data (string IDs like csv_xxx)
      const { prospect_ids } = body;

      console.log(`📋 Add to campaign: Received ${prospect_ids.length} prospect IDs`);
      console.log(`📋 Sample IDs:`, prospect_ids.slice(0, 3));
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(prospect_ids[0]);
      console.log(`📋 ID format check: First ID is UUID? ${isUUID}`);

      // First, try to find prospects in prospect_approval_data (from CSV approval flow)
      // CRITICAL: Use supabaseAdmin to bypass RLS - prospect_approval_data has restrictive RLS policies
      let approvalProspects: any[] = [];

      if (isUUID) {
        // Try UUID lookup first (new flow)
        const { data, error } = await supabaseAdmin
          .from('prospect_approval_data')
          .select('*')
          .in('id', prospect_ids);

        console.log(`📋 Found in prospect_approval_data by UUID: ${data?.length || 0}`);
        if (error) console.error('UUID lookup error:', error);
        if (data) approvalProspects = data;
      }

      // Also try matching by prospect_id (csv_xxx format) if UUID lookup fails or IDs aren't UUIDs
      if (approvalProspects.length === 0) {
        console.log(`📋 Trying prospect_id field lookup...`);
        const { data, error } = await supabaseAdmin
          .from('prospect_approval_data')
          .select('*')
          .in('prospect_id', prospect_ids);

        console.log(`📋 Found by prospect_id: ${data?.length || 0}`);
        if (error) console.error('prospect_id lookup error:', error);
        if (data && data.length > 0) approvalProspects = data;
      }

      // If we found prospects in approval data, add them directly to campaign_prospects
      if (approvalProspects && approvalProspects.length > 0) {
        console.log(`Found ${approvalProspects.length} prospects in prospect_approval_data`);

        const campaignProspects = approvalProspects.map((prospect: any) => {
          // Extract name parts
          const nameParts = prospect.name?.split(' ') || ['Unknown'];
          const firstName = nameParts[0] || 'Unknown';
          const lastName = nameParts.slice(1).join(' ') || '';

          // Extract LinkedIn URL from contact object
          const linkedinUrl = prospect.contact?.linkedin_url || null;

          return {
            campaign_id: campaignId,
            workspace_id: campaign.workspace_id,
            first_name: firstName,
            last_name: lastName,
            email: prospect.contact?.email || null,
            company_name: prospect.company?.name || '',
            title: prospect.title || '',
            location: prospect.location || null,
            linkedin_url: linkedinUrl,
            linkedin_user_id: prospect.linkedin_user_id || null,
            connection_degree: prospect.connection_degree ? String(prospect.connection_degree) : null,
            status: 'approved',
            personalization_data: {
              source: 'approval_flow',
              original_prospect_id: prospect.prospect_id,
              approved_at: new Date().toISOString()
            },
            created_at: new Date().toISOString()
          };
        });

        const { data: addedProspects, error: insertError } = await supabaseAdmin
          .from('campaign_prospects')
          .insert(campaignProspects)
          .select('id');

        if (insertError) {
          console.error('Failed to add prospects to campaign:', insertError);
          return NextResponse.json({
            error: 'Failed to add prospects to campaign',
            details: insertError.message
          }, { status: 500 });
        }

        // Mark as transferred in approval data
        await supabaseAdmin
          .from('prospect_approval_data')
          .update({
            approval_status: 'transferred_to_campaign',
            transferred_at: new Date().toISOString(),
            transferred_to_campaign_id: campaignId
          })
          .in('id', prospect_ids);

        return NextResponse.json({
          message: 'Prospects added to campaign successfully',
          added_prospects: addedProspects?.length || 0,
          total_requested: prospect_ids.length
        }, { status: 201 });
      }

      // Fallback: Try workspace_prospects table (original behavior for UUID prospect IDs)
      const { data: existingProspects, error: prospectsError } = await supabase
        .from('workspace_prospects')
        .select('id')
        .eq('workspace_id', campaign.workspace_id)
        .in('id', prospect_ids);

      if (prospectsError) {
        console.error('Failed to verify prospects:', prospectsError);
        return NextResponse.json({
          error: 'Failed to verify prospects',
          details: prospectsError.message,
          hint: 'Prospects may not exist in workspace_prospects table. Try using the approval flow.'
        }, { status: 500 });
      }

      const validProspectIds = existingProspects?.map(p => p.id) || [];
      const invalidIds = prospect_ids.filter(id => !validProspectIds.includes(id));

      if (invalidIds.length > 0) {
        return NextResponse.json({
          error: 'Some prospect IDs are invalid',
          invalid_ids: invalidIds
        }, { status: 400 });
      }

      // Add prospects to campaign (with conflict handling)
      const campaignProspects = prospect_ids.map(prospectId => ({
        campaign_id: campaignId,
        prospect_id: prospectId,
        workspace_id: campaign.workspace_id,
        status: 'pending',
        created_at: new Date().toISOString()
      }));

      const { data: addedProspects, error: insertError } = await supabase
        .from('campaign_prospects')
        .upsert(campaignProspects, {
          onConflict: 'campaign_id,prospect_id',
          ignoreDuplicates: true
        })
        .select();

      if (insertError) {
        console.error('Failed to add prospects to campaign:', insertError);
        return NextResponse.json({
          error: 'Failed to add prospects to campaign',
          details: insertError.message
        }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Prospects added to campaign successfully',
        added_prospects: addedProspects?.length || 0,
        total_requested: prospect_ids.length
      }, { status: 201 });

    } else if (body.prospects && Array.isArray(body.prospects)) {
      // Mode 2: Create new prospects directly in campaign_prospects table
      const { prospects } = body;

      if (prospects.length === 0) {
        return NextResponse.json({
          error: 'prospects array cannot be empty'
        }, { status: 400 });
      }

      // CRITICAL: Check if any prospects are already in active campaigns
      const linkedinUrls = prospects
        .map(p => p.linkedin_url || p.linkedin_profile_url || p.contact?.linkedin_url)
        .filter(Boolean)
        .map(url => url.toLowerCase().trim().replace(/\/$/, ''))

      const emails = prospects
        .map(p => p.email)
        .filter(Boolean)
        .map(email => email.toLowerCase().trim())

      if (linkedinUrls.length > 0 || emails.length > 0) {
        const { data: existingProspects } = await supabase
          .from('campaign_prospects')
          .select(`
            id,
            first_name,
            last_name,
            linkedin_url,
            email,
            status,
            campaign_id,
            campaigns!inner(name, status)
          `)
          .eq('workspace_id', campaign.workspace_id)
          .neq('campaign_id', campaignId)
          .in('status', ['pending', 'approved', 'processing', 'cr_sent', 'fu1_sent', 'fu2_sent', 'fu3_sent', 'fu4_sent', 'fu5_sent', 'connection_requested', 'connected', 'messaging', 'completed'])
          .or(`linkedin_url.in.(${linkedinUrls.length > 0 ? linkedinUrls.map(u => `"${u}"`).join(',') : '""'}),email.in.(${emails.length > 0 ? emails.map(e => `"${e}"`).join(',') : '""'})`)

        const conflictingProspects = (existingProspects || []).filter(p => {
          return p.campaigns?.status === 'active' || p.campaigns?.status === 'draft'
        })

        if (conflictingProspects.length > 0) {
          const conflictDetails = conflictingProspects.map(p => ({
            name: `${p.first_name} ${p.last_name}`,
            linkedin_url: p.linkedin_url,
            current_campaign: p.campaigns?.name || 'Unknown',
            status: p.status
          }))

          return NextResponse.json({
            error: 'campaign_conflict',
            message: `${conflictingProspects.length} prospect(s) are already in active campaigns. Remove them from existing campaigns before adding to this one.`,
            conflicts: conflictDetails
          }, { status: 409 })
        }
      }

      // Insert prospects directly into campaign_prospects
      // FIX (Dec 11, 2025): Handle multiple company name formats from different data sources
      const campaignProspects = prospects.map(prospect => ({
        campaign_id: campaignId,
        first_name: prospect.first_name || '',
        last_name: prospect.last_name || '',
        email: prospect.email || prospect.contact?.email || null,
        // FIX: Handle nested company object from Sales Navigator data
        company_name: prospect.company_name || prospect.company?.name || prospect.company || null,
        linkedin_url: prospect.linkedin_url || prospect.linkedin_profile_url || prospect.contact?.linkedin_url || null,
        title: prospect.title || null,
        phone: prospect.phone || prospect.contact?.phone || null,
        location: prospect.location || null,
        industry: prospect.industry || prospect.company?.industry?.[0] || null,
        status: prospect.status || 'approved',
        personalization_data: {
          ...(prospect.personalization_data || {}),
          source: prospect.personalization_data?.source || 'direct_add',
          added_at: new Date().toISOString()
        },
        created_at: new Date().toISOString()
      }));

      const { data: addedProspects, error: insertError } = await supabase
        .from('campaign_prospects')
        .insert(campaignProspects)
        .select();

      if (insertError) {
        console.error('Failed to add prospects to campaign:', insertError);
        return NextResponse.json({
          error: 'Failed to add prospects to campaign',
          details: insertError.message
        }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Prospects created and added to campaign successfully',
        added_prospects: addedProspects?.length || 0,
        total_requested: prospects.length
      }, { status: 201 });

    } else {
      return NextResponse.json({
        error: 'Either prospect_ids or prospects array is required'
      }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Add prospects to campaign error:', error);
    return NextResponse.json(
      { error: 'Failed to add prospects to campaign', details: error.message },
      { status: 500 }
    );
  }
}