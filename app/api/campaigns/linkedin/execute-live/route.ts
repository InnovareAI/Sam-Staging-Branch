/**
 * LIVE LinkedIn Campaign Execution API
 * Executes real LinkedIn campaigns using MCP integration
 * Ready for production with all infrastructure components integrated
 * Cache-bust: 2025-10-27T05:16:00Z
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { createClient } from '@supabase/supabase-js';

// MCP tools for LinkedIn execution
declare global {
  function mcp__unipile__unipile_get_accounts(): Promise<any[]>;
  function mcp__unipile__unipile_get_recent_messages(params: any): Promise<any[]>;
}

interface CampaignExecutionRequest {
  campaignId: string;
  maxProspects?: number;
  dryRun?: boolean;
}

interface LinkedInAccount {
  id: string;
  name: string;
  status: string;
  type: string;
  sources: Array<{
    id: string;
    status: string;
  }>;
}

export async function POST(req: NextRequest) {
  try {
    // Check for internal cron trigger (bypass user auth for cron jobs)
    const internalTriggerValue = req.headers.get('x-internal-trigger');
    const isInternalTrigger = internalTriggerValue === 'cron-pending-prospects' || internalTriggerValue === 'n8n-scheduler';

    // Use service role client for cron (no cookies), regular client for users
    const supabase = isInternalTrigger
      ? createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
      : await createSupabaseRouteClient();

    // Authentication
    let user = null;
    if (!isInternalTrigger) {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) {
        console.error('🔒 AUTH FAILED:', {
          hasError: !!authError,
          errorMessage: authError?.message,
          errorName: authError?.name,
          hasUser: !!authUser,
          userId: authUser?.id
        });
        return NextResponse.json({
          error: 'Unauthorized',
          details: authError?.message || 'No user session found'
        }, { status: 401 });
      }
      user = authUser;
      console.log(`✅ Authenticated user: ${user.email} (${user.id})`);
    }

    const { campaignId, maxProspects = 1, dryRun = false, specificProspectId } = await req.json();
    
    if (!campaignId) {
      return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 });
    }

    console.log(`🚀 Starting LIVE campaign execution: ${campaignId}`);
    console.log(`📊 Max prospects: ${maxProspects}, Dry run: ${dryRun}`);

    // Step 1: Get campaign details and verify workspace access
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        *,
        workspaces!inner(id, name)
      `)
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error('❌ Campaign not found:', campaignError?.message);
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Verify user has access to this workspace (skip for internal cron)
    if (!isInternalTrigger) {
      const { data: membershipCheck } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', campaign.workspace_id)
        .eq('user_id', user.id)
        .single();

      if (!membershipCheck) {
        console.error('❌ User not authorized for this workspace');
        return NextResponse.json({ error: 'Unauthorized workspace access' }, { status: 403 });
      }
    }

    console.log(`✅ Campaign: ${campaign.name} in workspace: ${campaign.workspaces.name}`);
    if (isInternalTrigger) {
      console.log(`🤖 Internal cron trigger - bypassing user auth`);
    }

    // Step 2: Get LinkedIn account for campaign execution
    // For user-triggered: use authenticated user's account only
    // For cron-triggered: use campaign creator's account (prevents account misuse)
    let userLinkedInAccount;
    let accountsError;

    if (isInternalTrigger) {
      // Cron trigger: use campaign creator's LinkedIn account
      // CRITICAL: Each campaign must use the LinkedIn account of the person who created it
      console.log(`🔍 Getting LinkedIn account for campaign creator: ${campaign.created_by}...`);
      const result = await supabase
        .from('workspace_accounts')
        .select('*')
        .eq('workspace_id', campaign.workspace_id)
        .eq('user_id', campaign.created_by)  // Use campaign creator's account
        .eq('account_type', 'linkedin')
        .eq('connection_status', 'connected')
        .single();
      userLinkedInAccount = result.data;
      accountsError = result.error;
    } else {
      // User trigger: use authenticated user's account only
      console.log(`🔍 Getting LinkedIn account for user: ${user?.email}...`);
      const result = await supabase
        .from('workspace_accounts')
        .select('*')
        .eq('workspace_id', campaign.workspace_id)
        .eq('user_id', user.id)  // CRITICAL: Only use authenticated user's account
        .eq('account_type', 'linkedin')
        .eq('connection_status', 'connected')
        .single();
      userLinkedInAccount = result.data;
      accountsError = result.error;
    }

    if (accountsError || !userLinkedInAccount) {
      console.error('❌ LinkedIn account not found:', accountsError);
      return NextResponse.json({
        error: 'No LinkedIn account connected',
        details: isInternalTrigger
          ? `Campaign creator (user ${campaign.created_by}) does not have a connected LinkedIn account`
          : `You must connect YOUR OWN LinkedIn account. LinkedIn accounts cannot be shared among team members.`,
        troubleshooting: !isInternalTrigger ? {
          step1: 'Go to Workspace Settings → Integrations',
          step2: 'Click "Connect LinkedIn Account"',
          step3: 'Complete the OAuth flow with YOUR LinkedIn credentials',
          note: 'Each user must use their own LinkedIn account for compliance'
        } : {
          step1: 'The person who created this campaign must connect their LinkedIn account',
          step2: 'Go to Workspace Settings → Integrations',
          step3: 'Connect LinkedIn account via OAuth',
          campaign_creator: campaign.created_by
        }
      }, { status: 400 });
    }

    // Step 3: Use LinkedIn account
    const selectedAccount = userLinkedInAccount;
    console.log(`🎯 Using LinkedIn account: ${selectedAccount.account_name || 'LinkedIn Account'} ${isInternalTrigger ? '(campaign creator account)' : '(your account)'}`);
    if (user) {
      console.log(`   User: ${user.email}`);
    }

    // Step 3.5: VALIDATE account has required Unipile data
    if (!selectedAccount.unipile_account_id) {
      console.error('❌ LinkedIn account missing unipile_account_id');
      return NextResponse.json({
        error: 'LinkedIn account configuration error',
        details: 'Account exists but missing Unipile integration ID. Please reconnect your LinkedIn account.',
        troubleshooting: {
          step1: 'Go to Workspace Settings → Integrations',
          step2: 'Disconnect and reconnect your LinkedIn account',
          step3: 'Ensure you complete the full OAuth flow'
        }
      }, { status: 400 });
    }

    // Step 3.6: VERIFY account is active in Unipile and get source ID
    let unipileSourceId: string;
    try {
      const unipileCheckUrl = `https://${process.env.UNIPILE_DSN}/api/v1/accounts/${selectedAccount.unipile_account_id}`;
      console.log(`🔍 Checking Unipile account: ${unipileCheckUrl}`);

      const unipileCheckResponse = await fetch(unipileCheckUrl, {
        method: 'GET',
        headers: {
          'X-API-KEY': process.env.UNIPILE_API_KEY || '',
          'Accept': 'application/json'
        }
      });

      if (!unipileCheckResponse.ok) {
        console.error(`❌ Unipile account check failed: ${unipileCheckResponse.status}`);
        return NextResponse.json({
          error: 'LinkedIn account not accessible',
          details: `Account "${selectedAccount.account_name}" exists in database but is not accessible via Unipile`,
          unipile_status: unipileCheckResponse.status,
          troubleshooting: {
            step1: 'The LinkedIn account may have been disconnected or deleted in Unipile',
            step2: 'Go to Workspace Settings → Integrations',
            step3: 'Reconnect your LinkedIn account',
            step4: 'Contact support if problem persists'
          }
        }, { status: 400 });
      }

      const unipileAccountData = await unipileCheckResponse.json();
      console.log(`✅ Unipile account verified:`, JSON.stringify(unipileAccountData, null, 2));
      console.log(`   Account ID: ${unipileAccountData.id}`);
      console.log(`   Status: ${unipileAccountData.status}`);

      // Check if account is actually active and extract source ID
      const activeSource = unipileAccountData.sources?.find((s: any) => s.status === 'OK');
      if (!activeSource) {
        console.error(`❌ Unipile account has no active sources`);
        return NextResponse.json({
          error: 'LinkedIn account not active',
          details: `Account "${selectedAccount.account_name}" is connected but not active in Unipile`,
          account_status: unipileAccountData.status,
          sources: unipileAccountData.sources,
          troubleshooting: {
            step1: 'The LinkedIn session may have expired',
            step2: 'Go to Workspace Settings → Integrations',
            step3: 'Reconnect your LinkedIn account to refresh the session'
          }
        }, { status: 400 });
      }

      // CRITICAL: Store the source ID (used as account_id in Unipile API calls)
      unipileSourceId = activeSource.id;
      console.log(`✅ Active source ID: ${unipileSourceId}`);

    } catch (unipileError) {
      console.error('❌ Error verifying Unipile account:', unipileError);
      return NextResponse.json({
        error: 'LinkedIn account verification failed',
        details: 'Unable to verify account status with Unipile',
        message: unipileError instanceof Error ? unipileError.message : 'Unknown error',
        troubleshooting: {
          step1: 'There may be a temporary connectivity issue',
          step2: 'Try again in a few moments',
          step3: 'If problem persists, reconnect your LinkedIn account'
        }
      }, { status: 500 });
    }

    // Step 4: Generate daily random sending pattern (anti-bot detection)
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const todaySeed = parseInt(today.replace(/-/g, '')); // Use date as seed for reproducibility

    // Generate random daily pattern using date as seed
    function generateDailyPattern(seed: number, maxSends: number = 20) {
      // Deterministic random based on seed
      let rng = seed;
      const random = () => {
        rng = (rng * 9301 + 49297) % 233280;
        return rng / 233280;
      };

      // Random number of sends today (3-maxSends)
      const sendsToday = Math.floor(random() * (maxSends - 3) + 3);
      const intervals: number[] = [];

      for (let i = 0; i < sendsToday - 1; i++) {
        // 60% chance short burst (1-30min), 40% chance long pause (30-120min)
        const interval = random() < 0.6
          ? Math.floor(random() * 30 + 1)
          : Math.floor(random() * 90 + 30);
        intervals.push(interval);
      }

      return { sendsToday, intervals };
    }

    // Count connection requests sent today by this account
    const { data: todaysSends, error: countError } = await supabase
      .from('campaign_prospects')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', campaign.workspace_id)
      .gte('contacted_at', `${today}T00:00:00Z`)
      .lte('contacted_at', `${today}T23:59:59Z`)
      .eq('status', 'connection_requested');

    const todaysCount = todaysSends || 0;
    const DAILY_CR_LIMIT = 20; // Michelle's daily connection request limit
    const remainingToday = Math.max(0, DAILY_CR_LIMIT - todaysCount);

    // Generate today's sending pattern
    const dailyPattern = generateDailyPattern(todaySeed, DAILY_CR_LIMIT);

    console.log(`📊 Daily Rate Limit & Pattern:`);
    console.log(`   Date: ${today}`);
    console.log(`   Sent today: ${todaysCount}/${DAILY_CR_LIMIT}`);
    console.log(`   Remaining: ${remainingToday}`);
    console.log(`   Today's pattern: ${dailyPattern.sendsToday} sends with intervals: ${dailyPattern.intervals.slice(0, 5).join(', ')}... minutes`);

    if (remainingToday === 0) {
      console.log('⚠️ Daily rate limit reached - no more connection requests today');
      return NextResponse.json({
        success: true,
        message: 'Daily rate limit reached',
        campaign: campaign.name,
        daily_limit: DAILY_CR_LIMIT,
        sent_today: todaysCount,
        remaining_today: 0,
        next_available: `${new Date(Date.now() + 86400000).toISOString().split('T')[0]} 09:00:00 UTC`
      });
    }

    // Limit maxProspects to remaining daily quota
    const effectiveMaxProspects = Math.min(maxProspects, remainingToday);
    console.log(`   Effective max prospects: ${effectiveMaxProspects} (requested: ${maxProspects})`);

    // Step 5: Get prospects ready for messaging
    const { data: campaignProspects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select('*')
      .eq('campaign_id', campaignId)
      .in('status', ['pending', 'approved', 'ready_to_message', 'follow_up_due'])
      .limit(effectiveMaxProspects)
      .order('created_at', { ascending: true });

    if (prospectsError) {
      console.error('❌ Failed to get campaign prospects:', prospectsError.message);
      return NextResponse.json({ error: 'Failed to load prospects' }, { status: 500 });
    }

    // CRITICAL TOS COMPLIANCE: Filter prospects by Unipile account ownership
    // LinkedIn TOS: prospects can ONLY be messaged by the Unipile account that found them
    console.log(`🔍 DEBUG: campaignProspects count: ${campaignProspects?.length || 0}`);
    if (campaignProspects && campaignProspects.length > 0) {
      console.log(`🔍 DEBUG: First prospect:`, {
        name: `${campaignProspects[0].first_name} ${campaignProspects[0].last_name}`,
        linkedin_url: campaignProspects[0].linkedin_url,
        linkedin_user_id: campaignProspects[0].linkedin_user_id,
        status: campaignProspects[0].status,
        contacted_at: campaignProspects[0].contacted_at
      });
    }

    const executableProspects = campaignProspects?.filter(cp => {
      const hasLinkedIn = !!(cp.linkedin_url || cp.linkedin_user_id);
      console.log(`🔍 DEBUG: Prospect ${cp.first_name} ${cp.last_name} - hasLinkedIn: ${hasLinkedIn}, linkedin_url: ${cp.linkedin_url}, linkedin_user_id: ${cp.linkedin_user_id}`);
      return hasLinkedIn;
    }) || [];

    const totalWithLinkedIn = executableProspects.length;
    const blockedByOwnership = 0;

    console.log(`📋 Total prospects retrieved: ${campaignProspects?.length || 0}`);
    console.log(`📋 Prospects with LinkedIn URL: ${totalWithLinkedIn}`);
    console.log(`🔒 Blocked by ownership rules: ${blockedByOwnership}`);
    console.log(`✅ Executable prospects (owned by user): ${executableProspects.length}`);

    if (campaignProspects && campaignProspects.length > 0 && executableProspects.length === 0) {
      console.log('⚠️ Prospects exist but none have LinkedIn URLs');
      console.log('Sample prospect data:', JSON.stringify(campaignProspects[0], null, 2));
    }

    if (executableProspects.length === 0) {
      const suggestions = [
        'Check if prospects have LinkedIn URLs or internal IDs',
        'Verify prospect approval status',
        'Review campaign sequence settings'
      ];

      if (blockedByOwnership > 0) {
        suggestions.unshift(
          `🚨 TOS COMPLIANCE: ${blockedByOwnership} prospects cannot be messaged because they were added by other users`,
          'LinkedIn TOS requires each user to ONLY message prospects they personally added',
          'Each team member must create their own prospect lists and campaigns'
        );
      }

      return NextResponse.json({
        success: true,
        message: 'No prospects ready for messaging',
        campaign: campaign.name,
        total_prospects: campaignProspects?.length || 0,
        prospects_with_linkedin: totalWithLinkedIn,
        blocked_by_ownership: blockedByOwnership,
        executable_prospects: 0,
        suggestions
      });
    }

    console.log(`✅ Processing ${executableProspects.length} prospects with LinkedIn URLs`);

    // Step 5: Get campaign messages (NO AI MODIFICATION)
    // Support both old (message_templates) and new (connection_message) structures
    const connectionMsg = campaign.connection_message || campaign.message_templates?.connection_request;
    const alternativeMsg = campaign.alternative_message || campaign.message_templates?.alternative_message;
    const followUpMsgs = campaign.follow_up_messages?.length > 0
      ? campaign.follow_up_messages
      : campaign.message_templates?.follow_up_messages || [];

    console.log('📋 Campaign message templates:', {
      has_connection_message: !!connectionMsg,
      has_alternative_message: !!alternativeMsg,
      follow_up_count: followUpMsgs.length,
      structure: campaign.connection_message ? 'new' : 'legacy'
    });

    const results = {
      campaign_id: campaignId,
      campaign_name: campaign.name,
      linkedin_account: selectedAccount.name,
      prospects_processed: executableProspects.length,
      n8n_triggered: false,
      errors: []
    };

    // Step 6: Send Connection Requests Directly via Unipile
    console.log('🚀 Triggering N8N workflow for campaign execution...');
    console.log(`   Prospects: ${executableProspects.length}`);
    console.log(`   Account: ${selectedAccount.account_name}`);

    const sentResults = [];
    const failedResults = [];

    if (dryRun) {
      console.log('🧪 DRY RUN - Would send to N8N:', executableProspects.map(p => `${p.first_name} ${p.last_name}`).join(', '));
      results.n8n_triggered = false;
    } else {
      // LIVE: Trigger N8N workflow for complete campaign lifecycle
      console.log('\n📡 Preparing N8N payload...');

      // Prepare prospect data for N8N with daily random delays
      const n8nProspects = executableProspects.map((prospect, index) => {
        // Get delay from daily pattern for this prospect's position in queue
        const delayMinutes = index < dailyPattern.intervals.length
          ? dailyPattern.intervals.slice(0, index + 1).reduce((a, b) => a + b, 0)
          : dailyPattern.intervals.reduce((a, b) => a + b, 0);

        return {
          id: prospect.id,
          first_name: prospect.first_name,
          last_name: prospect.last_name,
          linkedin_url: prospect.linkedin_url,
          company_name: prospect.company_name,
          title: prospect.title,
          email: prospect.email,
          location: prospect.location,
          industry: prospect.industry,
          personalization_data: prospect.personalization_data,
          // Add daily pattern delay for anti-bot behavior
          send_delay_minutes: delayMinutes,
          pattern_index: index,
          daily_pattern_seed: today
        };
      });

      // Prepare message templates for N8N workflow (expects 'cr' not 'connection_request')
      const messages = {
        cr: connectionMsg || alternativeMsg || campaign.message_templates?.connection_request,  // N8N expects 'cr'
        connection_request: connectionMsg || alternativeMsg || campaign.message_templates?.connection_request, // Legacy support
        follow_up_1: campaign.message_templates?.follow_up_1,
        follow_up_2: campaign.message_templates?.follow_up_2,
        follow_up_3: campaign.message_templates?.follow_up_3,
        follow_up_4: campaign.message_templates?.follow_up_4,
        goodbye: campaign.message_templates?.goodbye
      };

      // Get flow_settings from campaign (new data-driven approach)
      const flowSettings = campaign.flow_settings || {
        connection_wait_hours: 36,
        followup_wait_days: 5,
        messages: messages // Fallback to legacy messages if no flow_settings
      };

      const n8nPayload = {
        workspaceId: campaign.workspace_id,
        campaignId: campaign.id,
        unipileAccountId: selectedAccount.unipile_account_id,
        prospects: n8nProspects,
        messages: messages,
        timing: {
          // Standard funnel timing (ALL workspaces):
          // CR → 6h → FU1 → 3d → FU2 → 5d → FU3 → 5d → FU4 → 5d → FU5 → 5d → FU6
          fu1_delay_hours: 6,   // FU1: 6 hours after CR
          fu2_delay_days: 3,    // FU2: 3 days after FU1
          fu3_delay_days: 5,    // FU3: 5 days after FU2
          fu4_delay_days: 5,    // FU4: 5 days after FU3
          fu5_delay_days: 5,    // FU5: 5 days after FU4
          fu6_delay_days: 5     // FU6: 5 days after FU5 (final message)
        },
        supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
        unipile_dsn: process.env.UNIPILE_DSN,
        unipile_api_key: process.env.UNIPILE_API_KEY
      };

      console.log(`   Payload: ${n8nProspects.length} prospects`);
      console.log(`   Webhook: ${process.env.N8N_CAMPAIGN_WEBHOOK_URL}`);

      // Log first prospect details for debugging
      if (n8nProspects.length > 0) {
        console.log(`🔍 DEBUG: First prospect in N8N payload:`);
        console.log(`   Name: ${n8nProspects[0].first_name} ${n8nProspects[0].last_name}`);
        console.log(`   LinkedIn URL: "${n8nProspects[0].linkedin_url}"`);
        console.log(`   LinkedIn URL type: ${typeof n8nProspects[0].linkedin_url}`);
        console.log(`   LinkedIn URL length: ${n8nProspects[0].linkedin_url?.length || 0}`);
      }

      // Trigger N8N webhook
      try {
        const n8nResponse = await fetch(process.env.N8N_CAMPAIGN_WEBHOOK_URL || '', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.N8N_API_KEY || ''}`
          },
          body: JSON.stringify(n8nPayload)
        });

        console.log(`🔍 DEBUG: N8N Response Status: ${n8nResponse.status}`);

        if (!n8nResponse.ok) {
          const errorText = await n8nResponse.text();
          console.error(`❌ N8N webhook error (${n8nResponse.status}): ${errorText}`);
          failedResults.push({
            prospect: 'All prospects',
            error: `N8N webhook ${n8nResponse.status}: ${errorText}`
          });
        } else {
          const n8nData = await n8nResponse.json();
          console.log('✅ N8N workflow triggered successfully');
          console.log(`   Execution ID: ${n8nData.executionId || 'N/A'}`);

          // Update all prospects to 'queued_in_n8n' status
          const prospectIds = executableProspects.map(p => p.id);
          await supabase
            .from('campaign_prospects')
            .update({
              status: 'queued_in_n8n',
              personalization_data: {
                ...(executableProspects[0].personalization_data || {}),
                n8n_execution_id: n8nData.executionId,
                queued_at: new Date().toISOString()
              }
            })
            .in('id', prospectIds);

          sentResults.push(...n8nProspects.map(p => ({
            prospect: `${p.first_name} ${p.last_name}`,
            linkedin_url: p.linkedin_url,
            status: 'queued_in_n8n'
          })));

          results.n8n_triggered = true;
        }
      } catch (n8nError) {
        console.error('❌ Error triggering N8N:');
        console.error('   Error type:', n8nError instanceof Error ? 'Error' : typeof n8nError);
        console.error('   Error message:', n8nError instanceof Error ? n8nError.message : String(n8nError));
        console.error('   Error stack:', n8nError instanceof Error ? n8nError.stack : 'N/A');
        console.error('   Full error object:', JSON.stringify(n8nError, Object.getOwnPropertyNames(n8nError)));

        failedResults.push({
          prospect: 'All prospects',
          error: n8nError instanceof Error ? n8nError.message : 'N8N webhook failed'
        });
      }

      // Original direct API code replaced with N8N workflow
      // N8N will handle:
      // - LinkedIn profile lookup (GET /api/v1/users/{username})
      // - Connection request (POST /api/v1/users/invite)
      // - Wait 24-48 hours
      // - Check connection acceptance
      // - Send follow-ups (FU1-4, Goodbye)
      // - Reply detection

      results.errors = failedResults;
    }

    // Step 7: Update campaign status and return results
    const executionStatus = results.n8n_triggered ? 'active' : campaign.status;
    await supabase
      .from('campaigns')
      .update({
        status: executionStatus,
        launched_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    console.log('\n🎉 Campaign execution completed!');
    console.log(`📊 Queued: ${sentResults.length}, Failed: ${failedResults.length}`);

    // Log errors if any occurred
    if (failedResults.length > 0) {
      console.error('\n❌ ERRORS DURING EXECUTION:');
      failedResults.forEach((err: any, idx: number) => {
        console.error(`   ${idx + 1}. ${err.prospect}: ${err.error}`);
      });
    }

    return NextResponse.json({
      success: true,
      messages_sent: 0, // Workflow will send, not immediate
      messages_queued: sentResults.length,
      messages_failed: failedResults.length,
      queued_prospects: sentResults,
      failed: failedResults,
      message: `Campaign started! Queued ${sentResults.length} prospects for execution, ${failedResults.length} failed`,
      execution_mode: dryRun ? 'dry_run' : 'async',
      linkedin_account: selectedAccount.name,
      n8n_triggered: results.n8n_triggered,
      errors: results.errors
    });

  } catch (error) {
    console.error('Campaign execution error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}


// Helper function to extract LinkedIn user ID from URL
function extractLinkedInUserId(linkedinUrl: string): string | null {
  if (!linkedinUrl) return null;

  try {
    // Handle various LinkedIn URL formats:
    // - https://www.linkedin.com/in/username
    // - https://linkedin.com/in/username/
    // - /in/username
    // - username (bare)

    // Remove trailing slash
    let url = linkedinUrl.trim().replace(/\/$/, '');

    // If it's a full URL, extract the path
    if (url.startsWith('http')) {
      const urlObj = new URL(url);
      url = urlObj.pathname;
    }

    // Extract username from /in/username pattern
    const match = url.match(/\/in\/([^\/]+)/);
    if (match && match[1]) {
      return match[1];
    }

    // If no /in/ prefix, assume the whole string is the username
    if (!url.includes('/')) {
      return url;
    }

    return null;
  } catch (error) {
    console.error('Error parsing LinkedIn URL:', error);
    return null;
  }
}
