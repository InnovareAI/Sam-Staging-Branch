import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace_id from URL params or user metadata
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspace_id') || user.user_metadata.workspace_id;

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 });
    }

    // Get campaigns for this workspace with prospect counts
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select(`
        id,
        name,
        description,
        campaign_type,
        type,
        status,
        launched_at,
        created_at,
        updated_at,
        message_templates,
        execution_preferences,
        connection_message,
        alternative_message,
        follow_up_messages
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch campaigns:', error);
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
    }

    // Enrich campaigns with prospect counts and metrics
    const enrichedCampaigns = await Promise.all(campaigns.map(async (campaign: any) => {
      // Get prospect count
      const { count: prospectCount } = await supabase
        .from('campaign_prospects')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id);

      // CRITICAL FIX: Count LinkedIn connection requests from campaign_prospects
      // LinkedIn campaigns update campaign_prospects, not campaign_messages
      // Include: All sent statuses (processing, cr_sent, fu1-5_sent, completed) + legacy (connection_requested, contacted)
      // NOTE: 'failed' is NOT included - failed means no message was actually sent
      const { count: linkedinSent } = await supabase
        .from('campaign_prospects')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .in('status', ['processing', 'cr_sent', 'connection_request_sent', 'fu1_sent', 'fu2_sent', 'fu3_sent', 'fu4_sent', 'fu5_sent', 'completed', 'connection_requested', 'contacted', 'connected', 'messaging', 'replied']);

      // Get message stats from campaign_messages (for email campaigns)
      const { data: messages } = await supabase
        .from('campaign_messages')
        .select('id, status')
        .eq('campaign_id', campaign.id);

      const emailSent = messages?.length || 0;
      const connected = messages?.filter((m: any) => m.status === 'accepted' || m.status === 'connected').length || 0;

      // Total sent = LinkedIn connection requests + email messages
      const totalSent = (linkedinSent || 0) + emailSent;

      // Get reply count
      const { count: replyCount } = await supabase
        .from('campaign_replies')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id);

      return {
        ...campaign,
        type: campaign.campaign_type || campaign.type, // Use campaign_type as type for consistency
        prospects: prospectCount || 0,
        sent: totalSent,
        opened: 0, // TODO: Implement opened tracking
        replied: replyCount || 0,
        connections: connected,
        replies: replyCount || 0,
        response_rate: totalSent > 0 ? ((replyCount || 0) / totalSent * 100).toFixed(1) : 0
      };
    }));

    return NextResponse.json({ campaigns: enrichedCampaigns });

  } catch (error: any) {
    console.error('Campaign fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaigns', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      workspace_id,
      name,
      description,
      campaign_type = 'multi_channel',
      target_icp = {},
      ab_test_variant,
      message_templates = {},
      status = 'draft', // Default to 'draft' - campaigns must be explicitly activated
      session_id // Optional: if provided, auto-transfer approved prospects from this session
    } = await req.json();

    if (!workspace_id || !name) {
      return NextResponse.json({
        error: 'Workspace ID and campaign name are required'
      }, { status: 400 });
    }

    // Create campaign using database function
    const { data: campaignId, error } = await supabase
      .rpc('create_campaign', {
        p_workspace_id: workspace_id,
        p_name: name,
        p_description: description,
        p_campaign_type: campaign_type,
        p_target_icp: target_icp,
        p_ab_test_variant: ab_test_variant,
        p_message_templates: message_templates
      });

    if (error) {
      console.error('Failed to create campaign:', error);
      return NextResponse.json({
        error: 'Failed to create campaign',
        details: error.message
      }, { status: 500 });
    }

    // Auto-assign LinkedIn account for LinkedIn campaigns
    let linkedinAccountId = null;
    if (campaign_type === 'connector' || campaign_type === 'messenger') {
      const { data: linkedinAccount } = await supabase
        .from('workspace_accounts')
        .select('id')
        .eq('workspace_id', workspace_id)
        .eq('account_type', 'linkedin')
        .eq('connection_status', 'connected')
        .eq('is_active', true)
        .single();

      linkedinAccountId = linkedinAccount?.id || null;
    }

    // Update status AND flow_settings.messages from message_templates
    // CRITICAL FIX: Copy messages from message_templates to flow_settings for N8N execution
    const flowSettings = {
      campaign_type: campaign_type === 'email' ? 'email' : 'linkedin_connection',
      connection_wait_hours: 36,
      followup_wait_days: 5,
      message_wait_days: 5,
      messages: {
        connection_request: message_templates.connection_request || null,
        follow_up_1: message_templates.alternative_message || message_templates.follow_up_messages?.[0] || null,
        follow_up_2: message_templates.follow_up_messages?.[0] || null,
        follow_up_3: message_templates.follow_up_messages?.[1] || null,
        follow_up_4: message_templates.follow_up_messages?.[2] || null,
        follow_up_5: message_templates.follow_up_messages?.[3] || null,
        goodbye: message_templates.follow_up_messages?.[4] || null
      }
    };

    const { error: statusError } = await supabase
      .from('campaigns')
      .update({
        status,
        flow_settings: flowSettings,
        linkedin_account_id: linkedinAccountId
      })
      .eq('id', campaignId);

    if (statusError) {
      console.error('Failed to update campaign status and flow_settings:', statusError);
    }

    // AUTO-TRANSFER: If session_id provided, automatically transfer approved prospects
    let prospectsTransferred = 0;
    if (session_id) {
      console.log(`📦 ===== AUTO-TRANSFER PROSPECTS =====`);
      console.log(`Session ID: ${session_id}`);
      console.log(`Campaign ID: ${campaignId}`);
      console.log(`Workspace ID: ${workspace_id}`);

      // Get approved prospects from the session
      // First get approved prospect IDs from decisions table
      const { data: decisions, error: decisionsError } = await supabase
        .from('prospect_approval_decisions')
        .select('prospect_id')
        .eq('session_id', session_id)
        .eq('decision', 'approved');

      if (decisionsError) {
        console.error('❌ Error querying prospect_approval_decisions:', decisionsError);
      }

      if (!decisions || decisions.length === 0) {
        console.log('⚠️  No approved decisions found in prospect_approval_decisions for session:', session_id);
        console.log('   Will attempt to get ALL prospects from prospect_approval_data (backwards compatibility)');
      } else {
        console.log(`✅ Found ${decisions.length} approved prospects in decisions table`);
      }

      const approvedProspectIds = decisions?.map(d => d.prospect_id) || [];

      // Get the prospect data for approved prospects
      let query = supabase
        .from('prospect_approval_data')
        .select('*')
        .eq('session_id', session_id);

      // If we have approved IDs, filter by them, otherwise get all (for backwards compatibility)
      if (approvedProspectIds.length > 0) {
        query = query.in('prospect_id', approvedProspectIds);
      }

      const { data: approvedProspects, error: prospectsError } = await query;

      if (prospectsError) {
        console.error('❌ Error querying prospect_approval_data:', prospectsError);
        console.error('   Message:', prospectsError.message);
        console.error('   Code:', prospectsError.code);
        console.error('   Details:', prospectsError.details);
      }

      if (!approvedProspects || approvedProspects.length === 0) {
        console.error('❌ NO PROSPECTS FOUND IN prospect_approval_data');
        console.error('   Session ID:', session_id);
        console.error('   Approved IDs:', approvedProspectIds);
        console.error('   This means prospects were never uploaded or session ID is wrong');
      } else {
        console.log(`✅ Found ${approvedProspects.length} prospects in prospect_approval_data`);
      }

      if (approvedProspects && approvedProspects.length > 0) {
        // Get LinkedIn account for prospect ownership
        const { data: linkedInAccount } = await supabase
          .from('workspace_accounts')
          .select('unipile_account_id')
          .eq('workspace_id', workspace_id)
          .eq('user_id', user.id)
          .eq('account_type', 'linkedin')
          .eq('connection_status', 'connected')
          .single();

        const unipileAccountId = linkedInAccount?.unipile_account_id || null;

        // Transform and insert prospects
        const campaignProspects = approvedProspects.map(prospect => {
          const contact = prospect.contact || {};
          const linkedinUrl = contact.linkedin_url || contact.linkedinUrl || prospect.linkedin_url || null;

          // FIXED: Use prospect.name field and parse it properly
          // prospect_approval_data has "name" field, NOT contact.firstName/lastName
          const fullName = prospect.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim();

          // Parse the full name properly (remove titles, credentials, etc.)
          let firstName = 'Unknown';
          let lastName = 'User';

          if (fullName && fullName.trim() !== '') {
            // Split on first space: "Hyelim Kim" -> firstName: "Hyelim", lastName: "Kim"
            const nameParts = fullName.trim().split(/\s+/);
            if (nameParts.length >= 2) {
              firstName = nameParts[0];
              lastName = nameParts.slice(1).join(' ');
            } else if (nameParts.length === 1) {
              firstName = nameParts[0];
              lastName = '';
            }
          }

          return {
            campaign_id: campaignId,
            workspace_id,
            first_name: firstName,
            last_name: lastName,
            email: contact.email || null,
            company_name: prospect.company?.name || contact.company || contact.companyName || '',
            linkedin_url: linkedinUrl,
            title: prospect.title || contact.title || contact.headline || '',
            location: prospect.location || contact.location || null,
            industry: prospect.company?.industry?.[0] || 'Not specified',
            connection_degree: prospect.connectionDegree || contact.connectionDegree || null,
            status: 'approved',
            notes: null,
            added_by_unipile_account: unipileAccountId,
            personalization_data: {
              source: 'approval_session',
              session_id: session_id,
              approval_data_id: prospect.id,
              approved_at: new Date().toISOString()
            }
          };
        });

        console.log(`📤 Inserting ${campaignProspects.length} prospects into campaign_prospects table...`);

        const { data: inserted, error: insertError } = await supabase
          .from('campaign_prospects')
          .insert(campaignProspects)
          .select();

        if (insertError) {
          console.error('❌ FAILED TO AUTO-TRANSFER PROSPECTS');
          console.error('   Error message:', insertError.message);
          console.error('   Error code:', insertError.code);
          console.error('   Error details:', insertError.details);
          console.error('   Error hint:', insertError.hint);
          console.error('   First prospect data sample:', campaignProspects[0]);
        } else {
          prospectsTransferred = inserted.length;
          console.log(`✅ ✅ ✅ AUTO-TRANSFERRED ${prospectsTransferred} PROSPECTS TO CAMPAIGN`);
          console.log(`   Campaign ID: ${campaignId}`);
          console.log(`   Session ID: ${session_id}`);
        }
      } else {
        console.log('📋 ===== AUTO-TRANSFER SUMMARY =====');
        console.log('   Result: NO PROSPECTS TO TRANSFER');
        console.log(`   Session ID: ${session_id}`);
        console.log('   Reason: No prospects found in prospect_approval_data');
      }
    }

    // Get the created campaign with details
    const { data: campaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (fetchError) {
      console.error('Failed to fetch created campaign:', fetchError);
      return NextResponse.json({
        error: 'Campaign created but failed to fetch details',
        campaign_id: campaignId,
        prospects_transferred: prospectsTransferred
      }, { status: 201 });
    }

    // PERMANENT SESSIONS: Do NOT delete sessions after campaign creation
    // Sessions are permanent and can be reused across browsers/devices
    // Users may want to create multiple campaigns from the same prospect list

    return NextResponse.json({
      message: 'Campaign created successfully',
      campaign,
      prospects_transferred: prospectsTransferred
    }, { status: 201 });

  } catch (error: any) {
    console.error('Campaign creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create campaign', details: error.message },
      { status: 500 }
    );
  }
}