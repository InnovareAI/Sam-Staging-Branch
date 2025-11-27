import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { apiError, handleApiError, apiSuccess } from '@/lib/api-error-handler';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();

    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw apiError.unauthorized();
    }

    // Get workspace_id from URL params or user metadata
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspace_id') || user.user_metadata.workspace_id;

    if (!workspaceId) {
      throw apiError.validation('Workspace ID required');
    }

    // CRITICAL FIX: Use service role to bypass RLS for campaign queries
    // RLS policies are blocking legitimate users from seeing their campaigns
    const cookieStore = await cookies();
    const supabaseAdmin = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          }
        }
      }
    );

    // Verify user is a member of this workspace before returning campaigns
    const { data: membership } = await supabaseAdmin
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (!membership) {
      console.error('❌ User not a member of workspace:', { userId: user.id, workspaceId });
      throw apiError.forbidden('Not a member of this workspace');
    }

    // Get campaigns for this workspace with prospect counts
    const { data: campaigns, error } = await supabaseAdmin
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
      throw apiError.database('fetch campaigns', error);
    }

    // Enrich campaigns with prospect counts and metrics (using admin client to bypass RLS)
    const enrichedCampaigns = await Promise.all(campaigns.map(async (campaign: any) => {
      // Get prospect count
      const { count: prospectCount } = await supabaseAdmin
        .from('campaign_prospects')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id);

      // CRITICAL FIX: Count LinkedIn connection requests from campaign_prospects
      // LinkedIn campaigns update campaign_prospects, not campaign_messages
      // Include: All sent statuses (processing, cr_sent, fu1-5_sent, completed) + legacy (connection_requested, contacted)
      // NOTE: 'failed' is NOT included - failed means no message was actually sent
      const { count: linkedinSent } = await supabaseAdmin
        .from('campaign_prospects')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .in('status', ['processing', 'cr_sent', 'connection_request_sent', 'fu1_sent', 'fu2_sent', 'fu3_sent', 'fu4_sent', 'fu5_sent', 'completed', 'connection_requested', 'contacted', 'connected', 'messaging', 'replied']);

      // Get message stats from campaign_messages (for email campaigns)
      const { data: messages } = await supabaseAdmin
        .from('campaign_messages')
        .select('id, status')
        .eq('campaign_id', campaign.id);

      const emailSent = messages?.length || 0;
      const connected = messages?.filter((m: any) => m.status === 'accepted' || m.status === 'connected').length || 0;

      // Total sent = LinkedIn connection requests + email messages
      const totalSent = (linkedinSent || 0) + emailSent;

      // Get reply count
      const { count: replyCount } = await supabaseAdmin
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

    return apiSuccess({ campaigns: enrichedCampaigns });

  } catch (error) {
    return handleApiError(error, 'campaigns_get');
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw apiError.unauthorized();
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
      session_id, // Optional: if provided, auto-transfer approved prospects from this session
      // Email subject line fields
      initial_subject,
      follow_up_subjects = [],
      use_threaded_replies = false,
      // Legacy fields that may be passed directly
      connection_message,
      alternative_message,
      follow_up_messages = []
    } = await req.json();

    if (!workspace_id || !name) {
      throw apiError.validation('Workspace ID and campaign name are required');
    }

    // CRITICAL: For email campaigns, validate email body and subject exist
    // Email campaigns use email_body field (NOT connection_request - that's LinkedIn)
    if (campaign_type === 'email') {
      const emailBody = message_templates?.email_body || message_templates?.alternative_message;
      const emailSubject = initial_subject || message_templates?.initial_subject ||
                          message_templates?.email_subject;

      if (!emailBody || emailBody.trim() === '') {
        throw apiError.validation('Email campaigns require an email body', 'Please add email content');
      }

      if (!emailSubject || emailSubject.trim() === '') {
        throw apiError.validation('Email campaigns require a subject line', 'Please add an email subject');
      }

      console.log('✅ Email campaign validation passed:');
      console.log('   Subject:', emailSubject.substring(0, 50) + '...');
      console.log('   Body length:', emailBody.length, 'chars');
    }

    // Build message_templates - email uses email_body, LinkedIn uses connection_request
    const isEmailCampaign = campaign_type === 'email';
    const finalMessageTemplates = {
      ...message_templates,
      // LinkedIn fields - empty for email campaigns
      connection_request: isEmailCampaign ? '' : (connection_message || message_templates.connection_request || ''),
      alternative_message: isEmailCampaign ? '' : (alternative_message || message_templates.alternative_message || ''),
      // Email field - email_body for email campaigns
      email_body: isEmailCampaign ? (message_templates.email_body || alternative_message || '') : '',
      // Shared fields
      follow_up_messages: follow_up_messages.length > 0 ? follow_up_messages : (message_templates.follow_up_messages || []),
      initial_subject: initial_subject || message_templates.initial_subject || '',
      follow_up_subjects: follow_up_subjects.length > 0 ? follow_up_subjects : (message_templates.follow_up_subjects || []),
      use_threaded_replies: use_threaded_replies ?? message_templates.use_threaded_replies ?? false
    };

    console.log('📧 Campaign message_templates:', {
      has_initial_subject: !!finalMessageTemplates.initial_subject,
      initial_subject: finalMessageTemplates.initial_subject,
      follow_up_subjects_count: finalMessageTemplates.follow_up_subjects?.length || 0,
      use_threaded_replies: finalMessageTemplates.use_threaded_replies
    });

    // Create campaign using database function
    const { data: campaignId, error } = await supabase
      .rpc('create_campaign', {
        p_workspace_id: workspace_id,
        p_name: name,
        p_description: description,
        p_campaign_type: campaign_type,
        p_target_icp: target_icp,
        p_ab_test_variant: ab_test_variant,
        p_message_templates: finalMessageTemplates
      });

    if (error) {
      console.error('Failed to create campaign:', error);
      return NextResponse.json({
        error: 'Failed to create campaign',
        details: error.message
      }, { status: 500 });
    }

    // Auto-assign account based on campaign type
    // Note: linkedin_account_id column is used for BOTH LinkedIn and email accounts
    let linkedinAccountId = null;
    if (campaign_type === 'connector' || campaign_type === 'messenger') {
      // LinkedIn campaigns - assign LinkedIn account
      const { data: linkedinAccount } = await supabase
        .from('workspace_accounts')
        .select('id')
        .eq('workspace_id', workspace_id)
        .eq('account_type', 'linkedin')
        .eq('connection_status', 'connected')
        .eq('is_active', true)
        .single();

      linkedinAccountId = linkedinAccount?.id || null;
    } else if (campaign_type === 'email') {
      // Email campaigns - assign email account
      const { data: emailAccount } = await supabase
        .from('workspace_accounts')
        .select('id')
        .eq('workspace_id', workspace_id)
        .eq('account_type', 'email')
        .eq('connection_status', 'connected')
        .eq('is_active', true)
        .single();

      linkedinAccountId = emailAccount?.id || null;
      console.log('📧 Auto-assigned email account for email campaign:', linkedinAccountId);
    }

    // Update status AND flow_settings.messages from message_templates
    // CRITICAL FIX: Copy messages from message_templates to flow_settings for N8N execution
    const flowSettings = {
      campaign_type: campaign_type === 'email' ? 'email' : 'linkedin_connection',
      connection_wait_hours: 36,
      followup_wait_days: 5,
      message_wait_days: 5,
      messages: {
        connection_request: finalMessageTemplates.connection_request || null,
        follow_up_1: finalMessageTemplates.alternative_message || finalMessageTemplates.follow_up_messages?.[0] || null,
        follow_up_2: finalMessageTemplates.follow_up_messages?.[0] || null,
        follow_up_3: finalMessageTemplates.follow_up_messages?.[1] || null,
        follow_up_4: finalMessageTemplates.follow_up_messages?.[2] || null,
        follow_up_5: finalMessageTemplates.follow_up_messages?.[3] || null,
        goodbye: finalMessageTemplates.follow_up_messages?.[4] || null
      },
      // Email subject configuration
      subjects: {
        initial: finalMessageTemplates.initial_subject || null,
        follow_ups: finalMessageTemplates.follow_up_subjects || [],
        use_threaded_replies: finalMessageTemplates.use_threaded_replies || false
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

          // Mark prospects as transferred to campaign in approval database
          const prospectIds = approvedProspects.map((p: any) => p.prospect_id);
          await supabase
            .from('prospect_approval_data')
            .update({
              approval_status: 'transferred_to_campaign',
              transferred_at: new Date().toISOString(),
              transferred_to_campaign_id: campaignId
            })
            .in('prospect_id', prospectIds)
            .eq('session_id', session_id);

          console.log(`✅ Marked ${prospectIds.length} prospects as transferred to campaign in approval database`);
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
      success: true,
      message: 'Campaign created successfully',
      data: { campaign, prospects_transferred: prospectsTransferred },
      timestamp: new Date().toISOString()
    }, { status: 201 });

  } catch (error) {
    return handleApiError(error, 'campaigns_post');
  }
}