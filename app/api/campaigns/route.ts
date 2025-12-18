import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { apiError, handleApiError, apiSuccess } from '@/lib/api-error-handler';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';

// Helper to normalize LinkedIn URL to hash (vanity name only)
function normalizeLinkedInUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // Extract vanity name from LinkedIn URL
  const match = url.match(/linkedin\.com\/in\/([^\/\?#]+)/i);
  if (match) {
    return match[1].toLowerCase().trim();
  }
  // If no match, assume it's already a vanity name - just clean it up
  return url.replace(/^\/+|\/+$/g, '').toLowerCase().trim();
}

export async function GET(req: NextRequest) {
  console.log('🚀 [CAMPAIGNS API] ===== REQUEST START =====');
  try {
    const supabase = await createSupabaseRouteClient();

    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('👤 [CAMPAIGNS API] Auth check:', {
      hasUser: !!user,
      userId: user?.id,
      email: user?.email,
      authError: authError?.message
    });

    if (authError || !user) {
      console.error('❌ [CAMPAIGNS API] Auth failed:', authError);
      throw apiError.unauthorized();
    }

    // Get workspace_id from URL params or user metadata
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspace_id') || user.user_metadata.workspace_id;
    console.log('🏢 [CAMPAIGNS API] Workspace ID:', workspaceId, 'from URL:', searchParams.get('workspace_id'));

    if (!workspaceId) {
      console.error('❌ [CAMPAIGNS API] No workspace ID');
      throw apiError.validation('Workspace ID required');
    }

    // CRITICAL FIX: Use service role to bypass RLS for campaign queries
    // RLS policies are blocking legitimate users from seeing their campaigns
    const cookieStore = await cookies();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.log('🔑 [CAMPAIGNS API] Service role key exists:', !!serviceRoleKey, 'length:', serviceRoleKey?.length);

    const supabaseAdmin = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey!,
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
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    console.log('👥 [CAMPAIGNS API] Membership check:', {
      found: !!membership,
      membershipId: membership?.id,
      error: membershipError?.message
    });

    if (!membership) {
      console.error('❌ [CAMPAIGNS API] User not a member of workspace:', { userId: user.id, workspaceId });
      throw apiError.forbidden('Not a member of this workspace');
    }

    // Get campaigns for this workspace with prospect counts
    console.log('📊 [CAMPAIGNS API] Fetching campaigns for workspace:', workspaceId, 'user:', user.id, user.email);

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

    console.log('📊 [CAMPAIGNS API] Query result:', {
      campaignCount: campaigns?.length || 0,
      error: error?.message,
      firstCampaign: campaigns?.[0]?.name,
      allNames: campaigns?.map(c => c.name)
    });

    if (error) {
      throw apiError.database('fetch campaigns', error);
    }

    // PERFORMANCE FIX (Nov 27): Return campaigns immediately without N+1 enrichment
    // Previous code ran 4 queries per campaign causing timeouts
    // Get all prospect counts in a single query using GROUP BY
    const campaignIds = campaigns.map(c => c.id);

    const { data: prospectCounts } = await supabaseAdmin
      .from('campaign_prospects')
      .select('campaign_id')
      .in('campaign_id', campaignIds);

    // Count prospects per campaign from the results
    const prospectCountMap: Record<string, number> = {};
    const sentCountMap: Record<string, number> = {};

    prospectCounts?.forEach((p: { campaign_id: string }) => {
      prospectCountMap[p.campaign_id] = (prospectCountMap[p.campaign_id] || 0) + 1;
    });

    // Get all prospects with their statuses for detailed counts (including A/B variant)
    const { data: allProspects } = await supabaseAdmin
      .from('campaign_prospects')
      .select('campaign_id, status, responded_at, ab_variant')
      .in('campaign_id', campaignIds);

    // Build detailed count maps
    const connectedCountMap: Record<string, number> = {};
    const repliedCountMap: Record<string, number> = {};
    const failedCountMap: Record<string, number> = {};

    // A/B Testing stats: { campaignId: { a_sent, a_connected, b_sent, b_connected } }
    const abStatsMap: Record<string, { a_sent: number; a_connected: number; b_sent: number; b_connected: number }> = {};

    allProspects?.forEach((p: { campaign_id: string; status: string; responded_at: string | null; ab_variant?: string | null }) => {
      // Count sent (CR sent or beyond)
      const sentStatuses = ['processing', 'cr_sent', 'connection_request_sent', 'fu1_sent', 'fu2_sent', 'fu3_sent', 'fu4_sent', 'fu5_sent', 'completed', 'connection_requested', 'contacted', 'connected', 'messaging', 'replied', 'follow_up_sent'];
      if (sentStatuses.includes(p.status)) {
        sentCountMap[p.campaign_id] = (sentCountMap[p.campaign_id] || 0) + 1;
      }

      // Count connected
      if (p.status === 'connected' || p.status === 'messaging' || p.status === 'replied' || p.status === 'follow_up_sent') {
        connectedCountMap[p.campaign_id] = (connectedCountMap[p.campaign_id] || 0) + 1;
      }

      // Count replied (has responded_at OR status is 'replied')
      if (p.responded_at || p.status === 'replied') {
        repliedCountMap[p.campaign_id] = (repliedCountMap[p.campaign_id] || 0) + 1;
      }

      // Count failed (includes errors, already invited, rate limited, etc.)
      const failedStatuses = ['failed', 'error', 'already_invited', 'invitation_declined', 'rate_limited', 'rate_limited_cr', 'rate_limited_message', 'bounced'];
      if (failedStatuses.includes(p.status)) {
        failedCountMap[p.campaign_id] = (failedCountMap[p.campaign_id] || 0) + 1;
      }

      // A/B Testing stats
      if (p.ab_variant === 'A' || p.ab_variant === 'B') {
        if (!abStatsMap[p.campaign_id]) {
          abStatsMap[p.campaign_id] = { a_sent: 0, a_connected: 0, b_sent: 0, b_connected: 0 };
        }

        const isSent = sentStatuses.includes(p.status);
        const isConnected = p.status === 'connected' || p.status === 'messaging' || p.status === 'replied' || p.status === 'follow_up_sent';

        if (p.ab_variant === 'A') {
          if (isSent) abStatsMap[p.campaign_id].a_sent++;
          if (isConnected) abStatsMap[p.campaign_id].a_connected++;
        } else if (p.ab_variant === 'B') {
          if (isSent) abStatsMap[p.campaign_id].b_sent++;
          if (isConnected) abStatsMap[p.campaign_id].b_connected++;
        }
      }
    });

    // Transform campaigns with counts
    const enrichedCampaigns = campaigns.map((campaign: any) => {
      const total = prospectCountMap[campaign.id] || 0;
      const sent = sentCountMap[campaign.id] || 0;
      const connections = connectedCountMap[campaign.id] || 0;
      const replied = repliedCountMap[campaign.id] || 0;
      const failed = failedCountMap[campaign.id] || 0;
      const responseRate = sent > 0 ? Math.round((replied / sent) * 100) : 0;

      return {
        ...campaign,
        type: campaign.campaign_type || campaign.type,
        prospects: total,
        sent: sent,
        opened: 0, // Not tracked for LinkedIn
        replied: replied,
        connections: connections,
        replies: replied,
        failed: failed,
        response_rate: responseRate,
        // A/B Testing stats (if enabled)
        ab_stats: abStatsMap[campaign.id] || null
      };
    });

    console.log('✅ [CAMPAIGNS API] Returning', enrichedCampaigns.length, 'campaigns');
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
      follow_up_messages = [],
      // A/B Testing fields
      ab_testing_enabled,
      connection_request_b,
      alternative_message_b,
      email_body_b,
      initial_subject_b
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
      use_threaded_replies: use_threaded_replies ?? message_templates.use_threaded_replies ?? false,
      // A/B Testing fields
      ab_testing_enabled: ab_testing_enabled || message_templates.ab_testing_enabled || false,
      connection_request_b: isEmailCampaign ? '' : (connection_request_b || message_templates.connection_request_b || ''),
      alternative_message_b: isEmailCampaign ? '' : (alternative_message_b || message_templates.alternative_message_b || ''),
      email_body_b: isEmailCampaign ? (email_body_b || message_templates.email_body_b || '') : '',
      initial_subject_b: initial_subject_b || message_templates.initial_subject_b || ''
    };

    console.log('📧 Campaign message_templates:', {
      has_initial_subject: !!finalMessageTemplates.initial_subject,
      initial_subject: finalMessageTemplates.initial_subject,
      follow_up_subjects_count: finalMessageTemplates.follow_up_subjects?.length || 0,
      use_threaded_replies: finalMessageTemplates.use_threaded_replies,
      // A/B Testing logging
      ab_testing_enabled: finalMessageTemplates.ab_testing_enabled,
      has_variant_b: !!(finalMessageTemplates.connection_request_b || finalMessageTemplates.alternative_message_b || finalMessageTemplates.email_body_b)
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
    // CRITICAL FIX (Dec 16): Fail fast if no account is configured instead of silently proceeding
    // FIX (Dec 18): Check BOTH workspace_accounts AND user_unipile_accounts tables
    // FIX (Dec 18): Validate account provider matches campaign type
    let linkedinAccountId = null;
    if (campaign_type === 'connector' || campaign_type === 'messenger') {
      // LinkedIn campaigns - assign LinkedIn account
      // FIX (Dec 18): Use .limit(1) instead of .single() to handle workspaces with multiple accounts
      // First try workspace_accounts
      const { data: linkedinAccounts, error: accountError } = await supabase
        .from('workspace_accounts')
        .select('id, account_name')
        .eq('workspace_id', workspace_id)
        .eq('account_type', 'linkedin')
        .in('connection_status', VALID_CONNECTION_STATUSES)
        .eq('is_active', true)
        .limit(1);

      let linkedinAccount = linkedinAccounts?.[0];

      // FIX (Dec 18): Fallback to user_unipile_accounts if workspace_accounts doesn't have it
      if (!linkedinAccount) {
        console.log('⚠️ No LinkedIn account in workspace_accounts, checking user_unipile_accounts...');
        const { data: unipileAccounts, error: unipileError } = await supabase
          .from('user_unipile_accounts')
          .select('id, account_name, connection_status, provider')
          .eq('workspace_id', workspace_id)
          .eq('provider', 'LINKEDIN')
          .in('connection_status', ['connected', 'active'])
          .limit(1);

        if (unipileAccounts?.[0]) {
          // FIX (Dec 18): Validate provider is actually LINKEDIN
          if (unipileAccounts[0].provider !== 'LINKEDIN') {
            console.error('❌ Account type mismatch: LinkedIn campaign requires LINKEDIN provider, got:', unipileAccounts[0].provider);
            await supabase.from('campaigns').delete().eq('id', campaignId);
            return NextResponse.json({
              success: false,
              error: 'Invalid account type',
              details: `LinkedIn campaigns require a LinkedIn account, not ${unipileAccounts[0].provider}. Please connect a LinkedIn account in Settings → Integrations.`
            }, { status: 400 });
          }
          linkedinAccount = {
            id: unipileAccounts[0].id,
            account_name: unipileAccounts[0].account_name
          };
          console.log('✅ Found LinkedIn account in user_unipile_accounts:', linkedinAccount.account_name);
        } else {
          console.error('❌ No LinkedIn account found in either table for workspace:', workspace_id);
        }
      }

      if (accountError || !linkedinAccount) {
        console.error('❌ No LinkedIn account found for workspace:', workspace_id, accountError?.message);
        // Delete the campaign we just created since it's unusable
        await supabase.from('campaigns').delete().eq('id', campaignId);
        return NextResponse.json({
          success: false,
          error: 'LinkedIn account not configured',
          details: 'Please connect a LinkedIn account in Settings → Integrations before creating a campaign.'
        }, { status: 400 });
      }

      linkedinAccountId = linkedinAccount.id;
      console.log('✅ Auto-assigned LinkedIn account:', linkedinAccount.account_name, linkedinAccountId);
    } else if (campaign_type === 'email') {
      // Email campaigns - assign email account
      const { data: emailAccount, error: accountError } = await supabase
        .from('workspace_accounts')
        .select('id, account_name')
        .eq('workspace_id', workspace_id)
        .eq('account_type', 'email')
        .in('connection_status', VALID_CONNECTION_STATUSES)
        .eq('is_active', true)
        .single();

      if (accountError || !emailAccount) {
        console.error('❌ No email account found for workspace:', workspace_id, accountError?.message);
        // Delete the campaign we just created since it's unusable
        await supabase.from('campaigns').delete().eq('id', campaignId);
        return NextResponse.json({
          success: false,
          error: 'Email account not configured',
          details: 'Please connect an email account in Settings → Integrations before creating an email campaign.'
        }, { status: 400 });
      }

      linkedinAccountId = emailAccount.id;
      console.log('📧 Auto-assigned email account:', emailAccount.account_name, linkedinAccountId);
    }

    // Update status AND flow_settings.messages from message_templates
    // CRITICAL FIX: Copy messages from message_templates to flow_settings for N8N execution
    const flowSettings = {
      campaign_type: campaign_type === 'email' ? 'email' : 'linkedin_connection',
      connection_wait_hours: 36,
      followup_wait_days: 5,
      message_wait_days: 5,
      messages: {
        // CRITICAL FIX (Dec 12): Correct message mapping for campaign_performance_summary
        // connection_request = Message 1 (Connection Request)
        // alternative_message = Separate optional message for 1st degree connections (NOT a follow-up)
        // follow_up_1 through follow_up_5 = Follow-up messages (Message 2-6)
        connection_request: finalMessageTemplates.connection_request || null,
        follow_up_1: finalMessageTemplates.follow_up_messages?.[0] || null,  // Message 2
        follow_up_2: finalMessageTemplates.follow_up_messages?.[1] || null,  // Message 3
        follow_up_3: finalMessageTemplates.follow_up_messages?.[2] || null,  // Message 4
        follow_up_4: finalMessageTemplates.follow_up_messages?.[3] || null,  // Message 5
        follow_up_5: finalMessageTemplates.follow_up_messages?.[4] || null,  // Message 6
        goodbye: finalMessageTemplates.follow_up_messages?.[5] || null,      // Message 7 (if exists)
        // Store alternative_message separately (not part of follow-up sequence)
        alternative: finalMessageTemplates.alternative_message || null
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
        linkedin_account_id: linkedinAccountId,
        // CRITICAL FIX (Dec 9): Default to Pacific Time for all IA accounts
        timezone: 'America/Los_Angeles',
        country_code: 'US',
        working_hours_start: 7,
        working_hours_end: 18,
        skip_weekends: true,
        skip_holidays: true,
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

      // CRITICAL FIX (Dec 16): Link the session to this campaign so bulk-approve works later
      await supabase
        .from('prospect_approval_sessions')
        .update({ campaign_id: campaignId })
        .eq('id', session_id);
      console.log(`✅ Linked session ${session_id} to campaign ${campaignId}`);

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
        // FIX (Dec 18): Check both workspace_accounts and user_unipile_accounts
        let unipileAccountId: string | null = null;

        // First try workspace_accounts
        const { data: linkedInAccount } = await supabase
          .from('workspace_accounts')
          .select('unipile_account_id')
          .eq('workspace_id', workspace_id)
          .eq('user_id', user.id)
          .eq('account_type', 'linkedin')
          .in('connection_status', VALID_CONNECTION_STATUSES)
          .single();

        unipileAccountId = linkedInAccount?.unipile_account_id || null;

        // Fallback to user_unipile_accounts if not found
        if (!unipileAccountId) {
          const { data: userUnipileAccount } = await supabase
            .from('user_unipile_accounts')
            .select('unipile_account_id')
            .eq('workspace_id', workspace_id)
            .eq('platform', 'LINKEDIN')
            .in('connection_status', ['connected', 'active'])
            .limit(1);

          if (userUnipileAccount?.[0]) {
            unipileAccountId = userUnipileAccount[0].unipile_account_id;
            console.log('✅ Found unipile_account_id from user_unipile_accounts:', unipileAccountId);
          }
        }

        // ============================================================
        // DATABASE-FIRST: Upsert to workspace_prospects (master table)
        // ============================================================
        console.log(`📦 STEP 1: Upserting ${approvedProspects.length} prospects to workspace_prospects (master table)...`);

        // Map to track linkedin_url_hash -> master_prospect_id
        const masterProspectIds: Map<string, string> = new Map();

        for (const prospect of approvedProspects) {
          const contact = prospect.contact || {};
          const linkedinUrl = contact.linkedin_url || contact.linkedinUrl || prospect.linkedin_url || null;
          const linkedinUrlHash = normalizeLinkedInUrl(linkedinUrl);

          // Parse name
          const fullName = prospect.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
          let firstName = 'Unknown';
          let lastName = 'User';
          if (fullName && fullName.trim() !== '') {
            const nameParts = fullName.trim().split(/\s+/);
            if (nameParts.length >= 2) {
              firstName = nameParts[0];
              lastName = nameParts.slice(1).join(' ');
            } else if (nameParts.length === 1) {
              firstName = nameParts[0];
              lastName = '';
            }
          }

          // Prepare workspace_prospects record
          const workspaceProspectData = {
            workspace_id,
            linkedin_url: linkedinUrl,
            linkedin_url_hash: linkedinUrlHash,
            email: contact.email || null,
            first_name: firstName,
            last_name: lastName,
            company: prospect.company?.name || contact.company || contact.companyName || '',
            title: prospect.title || contact.title || contact.headline || '',
            location: prospect.location || contact.location || null,
            source: 'approval_session',
            approval_status: 'approved',
            approved_by: user.id,
            approved_at: new Date().toISOString(),
            active_campaign_id: campaignId,
            linkedin_provider_id: prospect.provider_id || contact.provider_id || null,
            connection_degree: prospect.connection_degree || prospect.connectionDegree || contact.connection_degree || contact.connectionDegree || null,
            enrichment_data: {
              industry: prospect.company?.industry?.[0] || 'Not specified',
              session_id: session_id,
              approval_data_id: prospect.id
            }
          };

          // Upsert to workspace_prospects
          const { data: upsertedProspect, error: upsertError } = await supabase
            .from('workspace_prospects')
            .upsert(workspaceProspectData, {
              onConflict: 'workspace_id,linkedin_url_hash',
              ignoreDuplicates: false
            })
            .select('id')
            .single();

          if (upsertError) {
            console.error(`❌ Failed to upsert prospect ${linkedinUrl}:`, upsertError.message);
          } else if (upsertedProspect && linkedinUrlHash) {
            masterProspectIds.set(linkedinUrlHash, upsertedProspect.id);
          }
        }

        console.log(`✅ Upserted ${masterProspectIds.size} prospects to workspace_prospects`);

        // ============================================================
        // STEP 2: Insert to campaign_prospects WITH master_prospect_id
        // ============================================================
        console.log(`📤 STEP 2: Inserting prospects into campaign_prospects with master_prospect_id FK...`);

        const campaignProspects = approvedProspects.map(prospect => {
          const contact = prospect.contact || {};
          const linkedinUrl = contact.linkedin_url || contact.linkedinUrl || prospect.linkedin_url || null;
          const linkedinUrlHash = normalizeLinkedInUrl(linkedinUrl);

          // Parse name
          const fullName = prospect.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
          let firstName = 'Unknown';
          let lastName = 'User';
          if (fullName && fullName.trim() !== '') {
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
            master_prospect_id: linkedinUrlHash ? masterProspectIds.get(linkedinUrlHash) : null,
            first_name: firstName,
            last_name: lastName,
            email: contact.email || null,
            company_name: prospect.company?.name || contact.company || contact.companyName || '',
            linkedin_url: linkedinUrl,
            linkedin_user_id: prospect.linkedin_user_id || contact.linkedin_user_id || prospect.provider_id || contact.provider_id || null,
            title: prospect.title || contact.title || contact.headline || '',
            location: prospect.location || contact.location || null,
            industry: prospect.company?.industry?.[0] || 'Not specified',
            connection_degree: prospect.connection_degree || prospect.connectionDegree || contact.connection_degree || contact.connectionDegree || null,
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

        // ============================================================
        // AUTO-RESOLVE LinkedIn IDs for prospects missing them
        // This prevents Messenger campaigns from failing at launch
        // ============================================================
        const unipileDsn = process.env.UNIPILE_DSN || 'api6.unipile.com:13670';
        const unipileApiKey = process.env.UNIPILE_API_KEY;

        if (unipileApiKey && unipileAccountId) {
          const prospectsNeedingResolution = campaignProspects.filter(
            p => p.linkedin_url && !p.linkedin_user_id
          );

          if (prospectsNeedingResolution.length > 0) {
            console.log(`🔍 AUTO-RESOLVE: ${prospectsNeedingResolution.length} prospects need LinkedIn ID resolution`);

            await Promise.all(prospectsNeedingResolution.map(async (prospect) => {
              try {
                // Extract vanity from URL
                const vanityMatch = prospect.linkedin_url?.match(/linkedin\.com\/in\/([^\/\?#]+)/i);
                if (!vanityMatch) return;

                const vanity = vanityMatch[1];
                const response = await fetch(
                  `https://${unipileDsn}/api/v1/users/${vanity}?account_id=${unipileAccountId}`,
                  { headers: { 'X-API-KEY': unipileApiKey, 'Accept': 'application/json' } }
                );

                if (response.ok) {
                  const data = await response.json();
                  if (data.provider_id) {
                    prospect.linkedin_user_id = data.provider_id;
                    console.log(`   ✅ Resolved ${prospect.first_name} ${prospect.last_name}: ${data.provider_id}`);
                  }
                }
              } catch (err) {
                console.warn(`   ⚠️ Failed to resolve ${prospect.first_name} ${prospect.last_name}:`, err);
              }
            }));

            const resolved = campaignProspects.filter(p => p.linkedin_user_id).length;
            console.log(`✅ AUTO-RESOLVE complete: ${resolved}/${campaignProspects.length} prospects have LinkedIn IDs`);
          }
        }

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
          console.log(`   Master prospect IDs linked: ${masterProspectIds.size}`);

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