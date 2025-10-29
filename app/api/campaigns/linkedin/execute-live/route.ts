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

    // CRITICAL TOS COMPLIANCE: Filter prospects by ownership
    // Users can ONLY message prospects they personally added
    const executableProspects = campaignProspects?.filter(cp => {
      const hasLinkedIn = cp.linkedin_url || cp.linkedin_user_id;
      const isOwnedByUser = cp.added_by === selectedAccount.user_id;

      if (hasLinkedIn && !isOwnedByUser) {
        console.warn(`⚠️ TOS VIOLATION PREVENTED: Prospect ${cp.first_name} ${cp.last_name} owned by ${cp.added_by}, cannot message from ${selectedAccount.user_id}'s account`);
      }

      return hasLinkedIn && isOwnedByUser;
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
      prospects_processed: 0,
      messages_sent: 0,
      personalization_cost: 0,
      errors: [],
      messages: []
    };

    // Step 6: Execute campaign for each prospect
    console.log('🎯 Starting prospect processing...');

    for (const prospect of executableProspects) {
      results.prospects_processed++;

      try {
        console.log(`\n📧 Processing: ${prospect.first_name || 'Unknown'} ${prospect.last_name || 'Unknown'} at ${prospect.company_name || 'Unknown Company'}`);

        // Determine message type based on sequence step
        const sequenceStep = (prospect.personalization_data as any)?.sequence_step || 0;
        let messageTemplate: string;

        if (sequenceStep === 0) {
          // First message: use connection_message
          messageTemplate = connectionMsg || alternativeMsg || '';
        } else if (sequenceStep >= 1 && followUpMsgs.length > 0) {
          // Follow-up: use appropriate follow-up message
          const followUpIndex = Math.min(sequenceStep - 1, followUpMsgs.length - 1);
          messageTemplate = followUpMsgs[followUpIndex] || '';
        } else {
          // Fallback to connection message
          messageTemplate = connectionMsg || '';
        }

        if (!messageTemplate || messageTemplate.trim().length === 0) {
          console.error(`❌ No message template found for sequence step ${sequenceStep}`);
          results.errors.push({
            prospect: `${prospect.first_name || 'Unknown'} ${prospect.last_name || 'Unknown'}`,
            error: 'No message template configured for this sequence step'
          });
          continue;
        }

        // 🚨 CRITICAL VALIDATION: NEVER send without names 🚨
        // This prevents sending generic "Hi there" messages
        if (!prospect.first_name || prospect.first_name.trim() === '') {
          console.error(`🚨 BLOCKED: Missing first name for ${prospect.linkedin_url}`);
          results.errors.push({
            prospect: `${prospect.linkedin_url}`,
            error: 'BLOCKED: Cannot send message without first name. Names are required for all messages.'
          });

          // Mark prospect as failed so it doesn't get retried without fixing
          await supabase
            .from('campaign_prospects')
            .update({
              status: 'failed',
              error_message: 'Missing first name - cannot send personalized message',
              updated_at: new Date().toISOString()
            })
            .eq('id', prospect.id);

          continue;
        }

        if (!prospect.last_name || prospect.last_name.trim() === '') {
          console.error(`🚨 BLOCKED: Missing last name for ${prospect.first_name} ${prospect.linkedin_url}`);
          results.errors.push({
            prospect: `${prospect.first_name} (${prospect.linkedin_url})`,
            error: 'BLOCKED: Cannot send message without last name. Names are required for all messages.'
          });

          // Mark prospect as failed so it doesn't get retried without fixing
          await supabase
            .from('campaign_prospects')
            .update({
              status: 'failed',
              error_message: 'Missing last name - cannot send personalized message',
              updated_at: new Date().toISOString()
            })
            .eq('id', prospect.id);

          continue;
        }

        console.log(`✅ Name validation passed: ${prospect.first_name} ${prospect.last_name}`);

        // CRITICAL: Simple variable replacement ONLY - NO AI MODIFICATION
        // Note: Fallbacks removed - validation above ensures names exist
        const personalizedMessage = messageTemplate
          .replace(/\{first_name\}/gi, prospect.first_name)
          .replace(/\{last_name\}/gi, prospect.last_name)
          .replace(/\{company_name\}/gi, prospect.company_name || 'your company')
          .replace(/\{job_title\}/gi, prospect.title || prospect.job_title || 'your role')
          .replace(/\{title\}/gi, prospect.title || prospect.job_title || 'your role')
          .replace(/\{industry\}/gi, prospect.industry || 'Business')
          .replace(/\{location\}/gi, prospect.location || '');

        console.log(`💬 Message (EXACT from campaign): "${personalizedMessage.substring(0, 100)}..."`);
        console.log(`📏 Message length: ${personalizedMessage.length} characters`);

        if (dryRun) {
          console.log('🧪 DRY RUN - Message would be sent');
          results.messages.push({
            prospect: `${prospect.first_name || 'Unknown'} ${prospect.last_name || 'Unknown'}`,
            message: personalizedMessage,
            cost: 0,  // No AI cost - simple variable replacement
            model: 'none',
            linkedin_target: prospect.linkedin_url || prospect.linkedin_user_id,
            status: 'dry_run'
          });
        } else {
          // LIVE EXECUTION: Send via Unipile API
          try {
            console.log(`🚀 LIVE: Sending connection request from account ${selectedAccount.account_name}`);
            console.log(`🎯 Target: ${prospect.linkedin_url || prospect.linkedin_user_id}`);
            console.log(`💬 Message: ${personalizedMessage.substring(0, 100)}...`);

            // Send LinkedIn connection request via Unipile API
            // CORRECT ENDPOINT: /api/v1/users/invite (as per Unipile documentation)
            const inviteEndpoint = `https://${process.env.UNIPILE_DSN}/api/v1/users/invite`;

            // STEP 1: Retrieve profile to get internal Unipile ID
            // Extract LinkedIn identifier from URL (e.g., "lee-furnival" from "/in/lee-furnival")
            const linkedinIdentifier = extractLinkedInUserId(prospect.linkedin_url);
            if (!linkedinIdentifier) {
              throw new Error(`Invalid LinkedIn profile URL: ${prospect.linkedin_url}`);
            }

            console.log(`🔍 Step 1: Retrieving profile for ${linkedinIdentifier}`);
            console.log(`   Using BASE account ID: ${selectedAccount.unipile_account_id}`);

            const profileUrl = `https://${process.env.UNIPILE_DSN}/api/v1/users/${linkedinIdentifier}?account_id=${selectedAccount.unipile_account_id}`;
            console.log(`   Profile URL: ${profileUrl}`);

            const profileResponse = await fetch(
              profileUrl,
              {
                method: 'GET',
                headers: {
                  'X-API-KEY': process.env.UNIPILE_API_KEY || '',
                  'Accept': 'application/json'
                }
              }
            );

            console.log(`   Profile response status: ${profileResponse.status} ${profileResponse.statusText}`);

            if (!profileResponse.ok) {
              const errorText = await profileResponse.text();
              console.error(`❌ Profile retrieval failed for URL: ${profileUrl}`);
              console.error(`   Status: ${profileResponse.status}`);
              console.error(`   Response: ${errorText}`);
              console.error(`   Account ID used: ${selectedAccount.unipile_account_id}`);
              console.error(`   LinkedIn ID: ${linkedinIdentifier}`);
              throw new Error(`Could not retrieve LinkedIn profile: ${profileResponse.statusText}`);
            }

            const profileData = await profileResponse.json();
            console.log(`✅ Profile retrieved:`, JSON.stringify(profileData, null, 2));

            // EXTRACT AND UPDATE MISSING NAMES from profile data
            if ((!prospect.first_name || !prospect.last_name) && profileData) {
              let extractedFirstName = prospect.first_name || '';
              let extractedLastName = prospect.last_name || '';

              // Try to get name from various profile fields
              if (profileData.first_name) {
                extractedFirstName = profileData.first_name;
              }
              if (profileData.last_name) {
                extractedLastName = profileData.last_name;
              }

              // If still missing, try splitting the full name
              if ((!extractedFirstName || !extractedLastName) && profileData.name) {
                const nameParts = profileData.name.split(' ');
                if (!extractedFirstName && nameParts.length > 0) {
                  extractedFirstName = nameParts[0];
                }
                if (!extractedLastName && nameParts.length > 1) {
                  extractedLastName = nameParts.slice(1).join(' ');
                }
              }

              // Update prospect record if we extracted names
              if (extractedFirstName || extractedLastName) {
                console.log(`📝 Updating missing names: ${extractedFirstName} ${extractedLastName}`);
                await supabase
                  .from('campaign_prospects')
                  .update({
                    first_name: extractedFirstName,
                    last_name: extractedLastName,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', prospect.id);

                // Update local prospect object for message personalization
                prospect.first_name = extractedFirstName;
                prospect.last_name = extractedLastName;
              }
            }

            // CHECK: Handle first-degree connections differently
            if (profileData.network_distance === 'FIRST_DEGREE') {
              console.log(`🔗 First-degree connection detected - sending direct message instead of invitation`);

              try {
                // Send direct message via Unipile (creates chat if needed)
                const messageResponse = await fetch(
                  `https://${process.env.UNIPILE_DSN}/api/v1/messages`,
                  {
                    method: 'POST',
                    headers: {
                      'X-API-KEY': process.env.UNIPILE_API_KEY || '',
                      'Content-Type': 'application/json',
                      'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                      account_id: selectedAccount.unipile_account_id,
                      provider: 'LINKEDIN',
                      text: personalizedMessage,
                      attendees: [{
                        messaging_id: profileData.public_identifier || linkedinIdentifier
                      }]
                    })
                  }
                );

                if (!messageResponse.ok) {
                  const errorText = await messageResponse.text();
                  console.error(`❌ Failed to send direct message:`, errorText);
                  throw new Error(`Direct message failed: ${messageResponse.statusText}`);
                }

                const messageData = await messageResponse.json();
                console.log(`✅ Direct message sent successfully:`, messageData);

                // Update prospect status to messaged
                await supabase
                  .from('campaign_prospects')
                  .update({
                    status: 'messaged',
                    contacted_at: new Date().toISOString(),
                    personalization_data: {
                      message: personalizedMessage,
                      chat_id: messageData.chat_id,
                      message_id: messageData.id,
                      network_distance: 'FIRST_DEGREE',
                      cost: 0,
                      model: 'none'
                    }
                  })
                  .eq('id', prospect.id);

                results.prospects_processed++;
                results.messages_sent++;
                results.messages.push({
                  prospect: `${prospect.first_name || 'Unknown'} ${prospect.last_name || 'Unknown'}`,
                  message: personalizedMessage,
                  cost: 0,
                  model: 'none',
                  linkedin_target: prospect.linkedin_url || prospect.linkedin_user_id,
                  status: 'messaged'
                });

                console.log(`✅ Successfully messaged first-degree connection: ${prospect.first_name} ${prospect.last_name}`);
                continue; // Skip invitation logic, move to next prospect
              } catch (messageError) {
                console.error(`❌ Error sending message to first-degree connection:`, messageError);
                results.errors.push({
                  prospect: `${prospect.first_name || 'Unknown'} ${prospect.last_name || 'Unknown'}`,
                  error: messageError instanceof Error ? messageError.message : 'Unknown error sending direct message'
                });
                continue; // Skip this prospect
              }
            }

            // CHECK: Skip if invitation already pending
            if (profileData.invitation?.type === 'SENT' && profileData.invitation?.status === 'PENDING') {
              console.log(`⏳ Invitation already pending - skipping`);

              await supabase
                .from('campaign_prospects')
                .update({
                  status: 'invitation_pending',
                  contacted_at: new Date().toISOString(),
                  personalization_data: {
                    note: 'Invitation already sent and pending'
                  }
                })
                .eq('id', prospect.id);

              continue; // Skip to next prospect
            }

            // STEP 2: Send invitation using internal ID (for non-connected prospects)
            const requestBody: any = {
              provider_id: profileData.provider_id,  // CRITICAL: Use provider_id from profile response
              account_id: selectedAccount.unipile_account_id,  // CRITICAL: Use BASE ID for both lookups AND invitations
              message: personalizedMessage  // EXACT message from campaign template (no AI modification)
            };

            // Validate required fields
            if (!requestBody.provider_id) {
              console.error(`❌ Missing provider_id in profile data:`, profileData);
              throw new Error('Profile data missing provider_id field');
            }
            if (!requestBody.account_id) {
              console.error(`❌ Missing account_id`);
              throw new Error('Missing Unipile account ID');
            }

            // Add email if available (optional but recommended by Unipile)
            if (prospect.email) {
              requestBody.user_email = prospect.email;
            }

            console.log(`📤 Step 2: Sending invitation to Unipile`);
            console.log(`   Endpoint: ${inviteEndpoint}`);
            console.log(`   Provider ID: ${requestBody.provider_id}`);
            console.log(`   Account ID (base): ${requestBody.account_id}`);
            console.log(`   Message length: ${personalizedMessage.length} chars`);
            console.log(`   Has email: ${!!requestBody.user_email}`);
            console.log(`   Full request body:`, JSON.stringify(requestBody, null, 2));

            const unipileResponse = await fetch(inviteEndpoint, {
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
              console.error(`❌ Unipile API error response:`, errorText);
              console.error(`❌ Unipile status: ${unipileResponse.status} ${unipileResponse.statusText}`);

              let errorData;
              try {
                errorData = JSON.parse(errorText);
                console.error(`❌ Parsed error details:`, JSON.stringify(errorData, null, 2));
              } catch {
                console.error(`❌ Raw error (not JSON):`, errorText);
                errorData = { raw: errorText };
              }

              // Handle 422 "already_invited_recently" gracefully - this is not a fatal error
              if (unipileResponse.status === 422 && errorData.type === 'errors/already_invited_recently') {
                console.log('⚠️  Invitation already sent recently to this prospect - skipping');

                // Mark prospect as already invited
                await supabase
                  .from('campaign_prospects')
                  .update({
                    status: 'already_invited',
                    contacted_at: new Date().toISOString(),
                    personalization_data: {
                      error: 'already_invited_recently',
                      detail: errorData.detail
                    }
                  })
                  .eq('id', prospect.id);

                results.messages.push({
                  prospect: `${prospect.first_name || 'Unknown'} ${prospect.last_name || 'Unknown'}`,
                  message: personalizedMessage,
                  cost: 0,
                  model: 'none',
                  linkedin_target: prospect.linkedin_url || prospect.linkedin_user_id,
                  status: 'already_invited'
                });

                // Continue to next prospect instead of throwing error
                continue;
              }

              // Build detailed error message for other errors
              const errorMessage = errorData.message || errorData.error || errorData.statusMessage || errorData.raw || unipileResponse.statusText;
              const detailMessage = errorData.details ? `\nDetails: ${JSON.stringify(errorData.details)}` : '';

              throw new Error(`Unipile API error (${unipileResponse.status}): ${errorMessage}${detailMessage}`);
            }

            const unipileData = await unipileResponse.json();
            console.log('✅ Unipile response:', JSON.stringify(unipileData, null, 2));

            // CRITICAL: Validate that we got a message ID from Unipile
            // Try multiple possible locations in response structure
            const unipileMessageId =
              unipileData.object?.id ||       // Expected structure: { object: { id: "..." } }
              unipileData.id ||                // Alternative: { id: "..." }
              unipileData.data?.id ||          // Alternative: { data: { id: "..." } }
              unipileData.message_id ||        // Alternative: { message_id: "..." }
              unipileData.invitation_id ||     // Alternative: { invitation_id: "..." }
              null;

            if (!unipileMessageId) {
              console.error('❌ Unipile response missing message ID!');
              console.error('   Full response structure:', JSON.stringify(unipileData, null, 2));
              console.error('   Tried: object.id, id, data.id, message_id, invitation_id');

              // Log for debugging but DON'T fail - invitation may have been sent
              console.warn('⚠️  WARNING: Cannot track message (no ID), but invitation may have been sent');
              console.warn('⚠️  Marking prospect as connection_requested anyway');

              // Use a fallback tracking ID
              const fallbackId = `untracked_${Date.now()}_${prospect.id}`;
              console.log(`📝 Using fallback tracking ID: ${fallbackId}`);
            }

            const trackingId = unipileMessageId || `untracked_${Date.now()}_${prospect.id}`;
            console.log(`✅ Got Unipile message ID: ${trackingId}`);

            // Update prospect status
            const { error: updateError } = await supabase
              .from('campaign_prospects')
              .update({
                status: 'connection_requested',
                contacted_at: new Date().toISOString(),
                personalization_data: {
                  message: personalizedMessage,  // EXACT message sent (no AI modification)
                  cost: 0,  // No AI cost - simple variable replacement
                  model: 'none',  // No AI model used
                  unipile_message_id: trackingId,
                  unipile_response: unipileMessageId ? null : unipileData,  // Store full response if ID missing
                  sequence_step: sequenceStep + 1
                }
              })
              .eq('id', prospect.id);

            if (updateError) {
              console.error('⚠️  Failed to update prospect status:', updateError);
            } else {
              console.log('✅ Prospect status updated to connection_requested');
            }

            results.messages_sent++;
            results.messages.push({
              prospect: `${prospect.first_name || 'Unknown'} ${prospect.last_name || 'Unknown'}`,
              message: personalizedMessage,
              cost: 0,
              model: 'none',
              linkedin_target: prospect.linkedin_url || prospect.linkedin_user_id,
              status: 'sent'
            });

            console.log('✅ Connection request sent successfully');

          } catch (sendError) {
            const prospectName = `${prospect.first_name || 'Unknown'} ${prospect.last_name || 'Unknown'}`;
            console.error(`❌ SEND ERROR for ${prospectName}:`, sendError);
            console.error(`   Prospect LinkedIn URL: ${prospect.linkedin_url}`);
            console.error(`   Error details:`, sendError instanceof Error ? sendError.stack : sendError);

            // Extract detailed debugging info
            const linkedinIdentifier = extractLinkedInUserId(prospect.linkedin_url);
            const profileUrl = `https://${process.env.UNIPILE_DSN}/api/v1/users/${linkedinIdentifier}?account_id=${selectedAccount.unipile_account_id}`;

            results.errors.push({
              prospect: prospectName,
              linkedin_url: prospect.linkedin_url,
              linkedin_identifier: linkedinIdentifier,
              error: sendError instanceof Error ? sendError.message : 'Unknown error',
              error_stack: sendError instanceof Error ? sendError.stack : undefined,
              debug_info: {
                account_name: selectedAccount.account_name,
                account_id_base: selectedAccount.unipile_account_id,
                account_id_source: selectedAccount.unipile_sources?.find((s: any) => s.status === 'OK')?.id,
                unipile_dsn: process.env.UNIPILE_DSN,
                profile_url_used: profileUrl,
                has_api_key: !!process.env.UNIPILE_API_KEY
              }
            });
          }
        }

        // No delay needed here - each batch processes only 1 prospect
        // Delay between batches is handled by scheduled next batch trigger below

      } catch (prospectError) {
        console.error(`❌ Error processing prospect ${prospect.first_name}:`, prospectError);
        results.errors.push({
          prospect: `${prospect.first_name || 'Unknown'} ${prospect.last_name || 'Unknown'}`,
          error: prospectError instanceof Error ? prospectError.message : 'Processing error'
        });
      }
    }

    // Step 7: Update campaign status and return results
    const executionStatus = results.messages_sent > 0 ? 'active' : campaign.status;
    await supabase
      .from('campaigns')
      .update({
        status: executionStatus,
        launched_at: new Date().toISOString()
      })
      .eq('id', campaignId);

    console.log('\n🎉 Campaign execution batch completed!');
    console.log(`📊 Results: ${results.messages_sent} sent, ${results.errors.length} errors`);
    console.log(`💰 Total cost: $${results.personalization_cost.toFixed(4)}`);

    // Log errors if any occurred
    if (results.errors.length > 0) {
      console.error('\n❌ ERRORS DURING EXECUTION:');
      results.errors.forEach((err, idx) => {
        console.error(`   ${idx + 1}. ${err.prospect}: ${err.error}`);
        if (err.linkedin_url) {
          console.error(`      LinkedIn: ${err.linkedin_url}`);
        }
      });
    }

    // Check if there are more prospects to process
    const { count: remainingCount } = await supabase
      .from('campaign_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .in('status', ['pending', 'approved', 'ready_to_message', 'follow_up_due']);

    const hasMoreProspects = (remainingCount || 0) > 0;

    // If more prospects remain, mark campaign for scheduled execution
    // A cron job will pick this up and execute the next batch after 2-30 minutes
    if (hasMoreProspects && !dryRun) {
      console.log(`🔄 ${remainingCount} prospects remaining`);

      // Calculate next execution time (2-30 minutes from now)
      const minDelayMs = 2 * 60 * 1000; // 2 minutes
      const maxDelayMs = 30 * 60 * 1000; // 30 minutes
      const delayMs = Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1)) + minDelayMs;
      const nextExecutionTime = new Date(Date.now() + delayMs);
      const delayMinutes = Math.round(delayMs / 60000);

      console.log(`⏰ Next batch scheduled for ${nextExecutionTime.toISOString()} (in ${delayMinutes} minutes)`);

      // Update campaign with next_execution_time for cron job to pick up
      await supabase
        .from('campaigns')
        .update({
          next_execution_time: nextExecutionTime.toISOString(),
          status: 'scheduled' // Mark as scheduled for auto-execution
        })
        .eq('id', campaignId);
    }

    // Include error summary in message if there were failures
    let message = `Campaign executed: ${results.messages_sent} connection requests sent`;
    if (results.errors.length > 0) {
      const firstError = results.errors[0];
      message += `. ${results.errors.length} failed: ${firstError.error}`;
    }
    if (hasMoreProspects) {
      message += `. Processing ${remainingCount} more in background.`;
    }

    return NextResponse.json({
      success: true,
      message,
      execution_mode: dryRun ? 'dry_run' : 'live',
      campaign_name: campaign.name,
      linkedin_account: selectedAccount.account_name || 'Primary Account',
      results,
      has_more_prospects: hasMoreProspects,
      remaining_prospects: remainingCount || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Campaign execution failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Campaign execution failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Helper function to extract LinkedIn user ID from profile URL
function extractLinkedInUserId(profileUrl: string | null | undefined): string | null {
  if (!profileUrl) return null;

  // Extract from various LinkedIn URL formats
  const patterns = [
    /linkedin\.com\/in\/([^\/\?]+)/,  // Standard: linkedin.com/in/john-doe
    /linkedin\.com\/pub\/[^\/]+\/[^\/]+\/[^\/]+\/([^\/\?]+)/,  // Old pub format
    /linkedin\.com\/profile\/view\?id=([^&]+)/  // Legacy profile view
  ];

  for (const pattern of patterns) {
    const match = profileUrl.match(pattern);
    if (match && match[1]) {
      // Clean up trailing slashes or query parameters
      return match[1].replace(/\/$/, '');
    }
  }

  return null;
}

// GET endpoint for campaign status and execution history
export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get('campaignId');
    
    if (!campaignId) {
      return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 });
    }

    // Get campaign execution status
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .select(`
        id,
        name,
        status,
        last_executed_at,
        workspaces!inner(name)
      `)
      .eq('id', campaignId)
      .single();

    if (error || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Get prospect execution status
    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select('*')
      .eq('campaign_id', campaignId);

    const executionStats = {
      total_prospects: prospects?.length || 0,
      pending: prospects?.filter(p => p.status === 'pending' || p.status === 'approved').length || 0,
      in_progress: prospects?.filter(p => ['connection_requested', 'follow_up_sent'].includes(p.status)).length || 0,
      completed: prospects?.filter(p => p.status === 'completed').length || 0,
      last_execution: campaign.launched_at
    };

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        workspace: campaign.workspaces.name
      },
      execution_stats: executionStats,
      prospects: prospects?.map(p => ({
        name: `${p.first_name || 'Unknown'} ${p.last_name || 'Unknown'}`,
        company: p.company_name,
        status: p.status,
        sequence_step: p.sequence_step || 0,
        last_contact: p.contacted_at
      }))
    });

  } catch (error) {
    console.error('Failed to get campaign status:', error);
    return NextResponse.json({ error: 'Failed to get campaign status' }, { status: 500 });
  }
}