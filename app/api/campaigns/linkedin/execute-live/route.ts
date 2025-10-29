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
    const isInternalTrigger = req.headers.get('x-internal-trigger') === 'cron-pending-prospects';

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
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      user = authUser;
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

    // Step 4: Get prospects ready for messaging
    const { data: campaignProspects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select('*')
      .eq('campaign_id', campaignId)
      .in('status', ['pending', 'approved', 'ready_to_message', 'follow_up_due'])
      .limit(maxProspects)
      .order('created_at', { ascending: true });

    if (prospectsError) {
      console.error('❌ Failed to get campaign prospects:', prospectsError.message);
      return NextResponse.json({ error: 'Failed to load prospects' }, { status: 500 });
    }

    // CRITICAL TOS COMPLIANCE: Filter prospects by Unipile account ownership
    // LinkedIn TOS: prospects can ONLY be messaged by the Unipile account that found them
    const executableProspects = campaignProspects?.filter(cp => {
      const hasLinkedIn = cp.linkedin_url || cp.linkedin_user_id;

      // Check Unipile account ownership
      // Allow if:
      // 1. Prospect found by THIS Unipile account
      // 2. Prospect has no Unipile owner (legacy) AND campaign created by current user
      const ownedByThisUnipileAccount = cp.added_by_unipile_account === selectedAccount.unipile_account_id;
      const isLegacyProspect = cp.added_by_unipile_account === null && campaign.created_by === selectedAccount.user_id;

      const canMessage = ownedByThisUnipileAccount || isLegacyProspect;

      // ONLY block if prospect is explicitly owned by ANOTHER Unipile account
      const ownedByOtherUnipileAccount =
        cp.added_by_unipile_account !== null &&
        cp.added_by_unipile_account !== selectedAccount.unipile_account_id;

      if (hasLinkedIn && ownedByOtherUnipileAccount) {
        console.warn(`⚠️ TOS VIOLATION PREVENTED: Prospect ${cp.first_name} ${cp.last_name} found by Unipile account ${cp.added_by_unipile_account}, cannot message from ${selectedAccount.unipile_account_id}`);
      }

      return hasLinkedIn && canMessage;
    }) || [];

    const totalWithLinkedIn = campaignProspects?.filter(cp => cp.linkedin_url || cp.linkedin_user_id).length || 0;
    const blockedByOwnership = totalWithLinkedIn - executableProspects.length;

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
    console.log('🚀 Sending connection requests directly via Unipile...');
    console.log(`   Prospects: ${executableProspects.length}`);
    console.log(`   Account: ${selectedAccount.account_name} (${unipileSourceId})`);

    const sentResults = [];
    const failedResults = [];

    if (dryRun) {
      console.log('🧪 DRY RUN - Would send CRs to:', executableProspects.map(p => `${p.first_name} ${p.last_name}`).join(', '));
      results.n8n_triggered = false;
    } else {
      // LIVE: Send connection requests via Unipile
      for (const prospect of executableProspects) {
        try {
          const prospectName = `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim() || 'Unknown';
          console.log(`\n📤 Sending CR to: ${prospectName}`);
          console.log(`   LinkedIn: ${prospect.linkedin_url}`);

          // STEP 1: Get LinkedIn profile to retrieve provider_id
          const linkedinUsername = prospect.linkedin_url.split('/in/')[1]?.split('?')[0]?.replace('/', '');
          if (!linkedinUsername) {
            console.error(`❌ Invalid LinkedIn URL: ${prospect.linkedin_url}`);
            failedResults.push({
              prospect: prospectName,
              error: 'Invalid LinkedIn URL format'
            });
            continue;
          }

          const profileUrl = `https://${process.env.UNIPILE_DSN}/api/v1/users/${linkedinUsername}?account_id=${selectedAccount.unipile_account_id}`;
          console.log(`   🔍 Fetching profile: ${linkedinUsername}`);

          const profileResponse = await fetch(profileUrl, {
            method: 'GET',
            headers: {
              'X-API-KEY': process.env.UNIPILE_API_KEY || '',
              'Accept': 'application/json'
            }
          });

          if (!profileResponse.ok) {
            const errorText = await profileResponse.text();
            console.error(`❌ Profile fetch error (${profileResponse.status}): ${errorText}`);
            failedResults.push({
              prospect: prospectName,
              error: `Profile fetch ${profileResponse.status}: ${errorText}`
            });
            continue;
          }

          const profileData = await profileResponse.json();
          console.log(`   🔍 LinkedIn profile response:`, JSON.stringify(profileData, null, 2));

          const providerId = profileData.provider_id;

          if (!providerId) {
            console.error(`❌ No provider_id in profile response`);
            failedResults.push({
              prospect: prospectName,
              error: 'No provider_id in profile'
            });
            continue;
          }

          console.log(`   ✅ Got provider_id: ${providerId}`);

          // ENRICHMENT FALLBACK: Extract name from LinkedIn profile if missing in database
          let enrichedFirstName = prospect.first_name;
          let enrichedLastName = prospect.last_name;

          if (!enrichedFirstName || !enrichedLastName) {
            // Unipile returns first_name and last_name directly - use them!
            enrichedFirstName = enrichedFirstName || profileData.first_name || '';
            enrichedLastName = enrichedLastName || profileData.last_name || '';

            if (enrichedFirstName || enrichedLastName) {
              console.log(`   📝 Enriched name from LinkedIn: ${enrichedFirstName} ${enrichedLastName}`);
            } else {
              // Fallback: try to build from other fields if direct fields not available
              const displayName = profileData.display_name ||
                                 profileData.name ||
                                 profileData.full_name ||
                                 '';

              if (displayName) {
                const nameParts = displayName.trim().split(' ');
                enrichedFirstName = enrichedFirstName || nameParts[0] || '';
                enrichedLastName = enrichedLastName || nameParts.slice(1).join(' ') || '';
                console.log(`   📝 Enriched name from display_name: ${enrichedFirstName} ${enrichedLastName}`);
              } else {
                console.log(`   ⚠️ WARNING: Could not find name in LinkedIn profile, will send with empty name`);
              }
            }
          }

          // STEP 2: Send invitation using provider_id
          // Re-personalize message with enriched names
          let finalPersonalizedMsg = (connectionMsg || alternativeMsg || '')
            .replace(/\{first_name\}/gi, enrichedFirstName || '')
            .replace(/\{last_name\}/gi, enrichedLastName || '')
            .replace(/\{company\}/gi, prospect.company_name || '')
            .replace(/\{company_name\}/gi, prospect.company_name || '')
            .replace(/\{industry\}/gi, prospect.industry || '')
            .replace(/\{title\}/gi, prospect.job_title || prospect.title || '');

          // CRITICAL: LinkedIn has 300 character limit for connection messages
          // Replace multiple newlines with single space for cleaner messages
          finalPersonalizedMsg = finalPersonalizedMsg.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();

          if (finalPersonalizedMsg.length > 300) {
            console.log(`   ⚠️ Message too long (${finalPersonalizedMsg.length} chars), truncating to 300...`);
            // Truncate at word boundary for cleaner messages
            finalPersonalizedMsg = finalPersonalizedMsg.substring(0, 297).trim();
            const lastSpace = finalPersonalizedMsg.lastIndexOf(' ');
            if (lastSpace > 250) {
              finalPersonalizedMsg = finalPersonalizedMsg.substring(0, lastSpace) + '...';
            } else {
              finalPersonalizedMsg = finalPersonalizedMsg + '...';
            }
          }

          const inviteUrl = `https://${process.env.UNIPILE_DSN}/api/v1/users/invite`;
          const requestBody: any = {
            provider_id: providerId,
            account_id: selectedAccount.unipile_account_id,
            message: finalPersonalizedMsg
          };

          if (prospect.email) {
            requestBody.user_email = prospect.email;
          }

          console.log(`   🚀 Sending invitation...`);

          const unipileResponse = await fetch(inviteUrl, {
            method: 'POST',
            headers: {
              'X-API-KEY': process.env.UNIPILE_API_KEY || '',
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(requestBody)
          });

          if (!unipileResponse.ok) {
            const errorText = await unipileResponse.text();
            console.error(`❌ Unipile API error (${unipileResponse.status}): ${errorText}`);
            failedResults.push({
              prospect: prospectName,
              error: `Unipile API ${unipileResponse.status}: ${errorText}`
            });
            continue;
          }

          const unipileData = await unipileResponse.json();
          console.log(`✅ CR sent successfully to ${prospectName}`);

          // Update prospect status
          await supabase
            .from('campaign_prospects')
            .update({
              status: 'connection_requested',
              contacted_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              personalization_data: {
                unipile_invitation_id: unipileData.invitation_id || unipileData.object?.id || unipileData.id,
                sent_at: new Date().toISOString(),
                campaign_id: campaignId,
                provider_id: providerId
              }
            })
            .eq('id', prospect.id);

          sentResults.push({
            prospect: prospectName,
            linkedin_url: prospect.linkedin_url
          });

        } catch (prospectError) {
          console.error(`❌ Error sending to ${prospect.first_name} ${prospect.last_name}:`, prospectError);
          failedResults.push({
            prospect: `${prospect.first_name} ${prospect.last_name}`,
            error: prospectError instanceof Error ? prospectError.message : 'Unknown error'
          });
        }
      }

      results.n8n_triggered = sentResults.length > 0;
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
    console.log(`📊 Sent: ${sentResults.length}, Failed: ${failedResults.length}`);

    // Log errors if any occurred
    if (failedResults.length > 0) {
      console.error('\n❌ ERRORS DURING EXECUTION:');
      failedResults.forEach((err: any, idx: number) => {
        console.error(`   ${idx + 1}. ${err.prospect}: ${err.error}`);
      });
    }

    return NextResponse.json({
      success: true,
      messages_sent: sentResults.length,
      messages_failed: failedResults.length,
      sent_to: sentResults,
      failed: failedResults,
      message: `Sent ${sentResults.length} connection requests, ${failedResults.length} failed`,
      execution_mode: dryRun ? 'dry_run' : 'live',
      linkedin_account: selectedAccount.name,
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
