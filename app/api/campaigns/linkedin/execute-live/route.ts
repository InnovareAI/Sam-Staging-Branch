/**
 * LIVE LinkedIn Campaign Execution API
 * Executes real LinkedIn campaigns using MCP integration
 * Ready for production with all infrastructure components integrated
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import CostControlledPersonalization from '@/lib/llm/cost-controlled-personalization';

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
    const supabase = await createSupabaseRouteClient();
    
    // Authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { campaignId, maxProspects = 1, dryRun = false } = await req.json();
    
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

    // Verify user has access to this workspace
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

    console.log(`✅ Campaign: ${campaign.name} in workspace: ${campaign.workspaces.name}`);

    // Step 2: Get authenticated user's LinkedIn account (NEVER use other team members' accounts)
    console.log(`🔍 Getting LinkedIn account for user: ${user.email}...`);
    const { data: userLinkedInAccount, error: accountsError } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', campaign.workspace_id)
      .eq('user_id', user.id)  // CRITICAL: Only use authenticated user's account
      .eq('account_type', 'linkedin')
      .eq('connection_status', 'connected')
      .single();

    if (accountsError || !userLinkedInAccount) {
      console.error('❌ User LinkedIn account not found:', accountsError);
      return NextResponse.json({
        error: 'No LinkedIn account connected',
        details: `You must connect YOUR OWN LinkedIn account. LinkedIn accounts cannot be shared among team members.`,
        troubleshooting: {
          step1: 'Go to Workspace Settings → Integrations',
          step2: 'Click "Connect LinkedIn Account"',
          step3: 'Complete the OAuth flow with YOUR LinkedIn credentials',
          note: 'Each user must use their own LinkedIn account for compliance'
        }
      }, { status: 400 });
    }

    // Step 3: Use authenticated user's LinkedIn account
    const selectedAccount = userLinkedInAccount;
    console.log(`🎯 Using YOUR LinkedIn account: ${selectedAccount.account_name || 'Your Account'}`);
    console.log(`   User: ${user.email}`);

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

    const executableProspects = campaignProspects?.filter(cp =>
      cp.linkedin_url || cp.linkedin_user_id
    ) || [];

    console.log(`📋 Total prospects retrieved: ${campaignProspects?.length || 0}`);
    console.log(`📋 Executable prospects (with LinkedIn URL): ${executableProspects.length}`);

    if (campaignProspects && campaignProspects.length > 0 && executableProspects.length === 0) {
      console.log('⚠️ Prospects exist but none have LinkedIn URLs');
      console.log('Sample prospect data:', JSON.stringify(campaignProspects[0], null, 2));
    }

    if (executableProspects.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No prospects ready for messaging',
        campaign: campaign.name,
        total_prospects: campaignProspects?.length || 0,
        executable_prospects: 0,
        suggestions: [
          'Check if prospects have LinkedIn URLs or internal IDs',
          'Verify prospect approval status',
          'Review campaign sequence settings'
        ]
      });
    }

    console.log(`✅ Processing ${executableProspects.length} prospects with LinkedIn URLs`);

    // Step 5: Initialize cost-controlled personalization
    const personalizer = new CostControlledPersonalization();
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

        // Determine message type based on sequence step (stored in personalization_data)
        const sequenceStep = (prospect.personalization_data as any)?.sequence_step || 0;
        let templateType: 'connection_request' | 'follow_up_1' | 'follow_up_2' = 'connection_request';
        if (sequenceStep === 1) templateType = 'follow_up_1';
        else if (sequenceStep >= 2) templateType = 'follow_up_2';

        // Personalize message using cost-controlled LLM
        const personalizationRequest = {
          templateType,
          campaignType: 'sales_outreach' as const,
          prospectData: {
            firstName: prospect.first_name || 'there',
            company: prospect.company_name || 'your company',
            title: prospect.title || 'Professional',
            industry: prospect.industry || 'Business'
          },
          personalizationLevel: 'standard' as const
        };

        const personalizedResult = await personalizer.personalizeMessage(personalizationRequest);
        results.personalization_cost += personalizedResult.cost;

        console.log(`💬 Message: "${personalizedResult.message.substring(0, 100)}..."`);
        console.log(`💰 Cost: $${personalizedResult.cost.toFixed(4)}, Model: ${personalizedResult.model}`);

        if (dryRun) {
          console.log('🧪 DRY RUN - Message would be sent');
          results.messages.push({
            prospect: `${prospect.first_name || 'Unknown'} ${prospect.last_name || 'Unknown'}`,
            message: personalizedResult.message,
            cost: personalizedResult.cost,
            model: personalizedResult.model,
            linkedin_target: prospect.linkedin_url || prospect.linkedin_user_id,
            status: 'dry_run'
          });
        } else {
          // LIVE EXECUTION: Send via Unipile API
          try {
            console.log(`🚀 LIVE: Sending connection request from account ${selectedAccount.account_name}`);
            console.log(`🎯 Target: ${prospect.linkedin_url || prospect.linkedin_user_id}`);
            console.log(`💬 Message: ${personalizedResult.message.substring(0, 100)}...`);

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

            // STEP 2: Send invitation using internal ID
            const requestBody: any = {
              provider_id: profileData.provider_id,  // CRITICAL: Use provider_id from profile response
              account_id: unipileSourceId,  // CRITICAL: Use SOURCE ID for sending invitations (base ID for lookups)
              message: personalizedResult.message  // Connection request message
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
            console.log(`   Account ID (source): ${requestBody.account_id}`);
            console.log(`   Message length: ${personalizedResult.message.length} chars`);
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
                  message: personalizedResult.message,
                  cost: personalizedResult.cost,
                  model: personalizedResult.model,
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
                  message: personalizedResult.message,
                  cost: personalizedResult.cost,
                  model: personalizedResult.model,
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
              message: personalizedResult.message,
              cost: personalizedResult.cost,
              model: personalizedResult.model,
              linkedin_target: prospect.linkedin_url || prospect.linkedin_user_id,
              status: 'sent'
            });

            console.log('✅ Connection request sent successfully');

          } catch (sendError) {
            const prospectName = `${prospect.first_name || 'Unknown'} ${prospect.last_name || 'Unknown'}`;
            console.error(`❌ SEND ERROR for ${prospectName}:`, sendError);
            console.error(`   Prospect LinkedIn URL: ${prospect.linkedin_url}`);
            console.error(`   Error details:`, sendError instanceof Error ? sendError.stack : sendError);

            results.errors.push({
              prospect: prospectName,
              linkedin_url: prospect.linkedin_url,
              error: sendError instanceof Error ? sendError.message : 'Unknown error',
              error_stack: sendError instanceof Error ? sendError.stack : undefined
            });
          }
        }

        // Rate limiting: Wait 2-5 seconds between messages
        const delay = Math.random() * 3000 + 2000; // 2-5 seconds
        console.log(`⏳ Waiting ${Math.round(delay/1000)}s before next message...`);
        await new Promise(resolve => setTimeout(resolve, delay));

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

    // If more prospects remain, trigger next batch asynchronously (fire-and-forget)
    if (hasMoreProspects && !dryRun) {
      console.log(`🔄 ${remainingCount} prospects remaining, triggering next batch...`);

      // Fire async request without waiting
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:3000`;
      fetch(`${baseUrl}/api/campaigns/linkedin/execute-live`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-trigger': 'true'  // Mark as internal
        },
        body: JSON.stringify({
          campaignId,
          maxProspects: 1,  // Process 1 prospect per batch to avoid 26s timeout
          dryRun: false
        })
      }).catch(err => {
        console.error('⚠️ Failed to trigger next batch:', err.message);
      });
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
      cost_summary: personalizer.getCostStats(),
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