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

    const { campaignId, maxProspects = 10, dryRun = false } = await req.json();
    
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

    // Step 2: Get workspace LinkedIn accounts from database
    console.log('🔍 Getting workspace LinkedIn accounts...');
    const { data: linkedinAccounts, error: accountsError } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', campaign.workspace_id)
      .eq('account_type', 'linkedin')
      .eq('connection_status', 'connected');

    if (accountsError || !linkedinAccounts || linkedinAccounts.length === 0) {
      console.error('❌ No LinkedIn accounts found:', accountsError);
      return NextResponse.json({
        error: 'No LinkedIn accounts connected',
        details: 'Please connect a LinkedIn account in workspace settings first'
      }, { status: 400 });
    }

    // Step 3: Select primary LinkedIn account
    const selectedAccount = linkedinAccounts[0];
    console.log(`🎯 Using LinkedIn account: ${selectedAccount.account_name || 'Primary Account'}`);

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

    // Step 3.6: VERIFY account is active in Unipile
    try {
      const unipileCheckUrl = `https://${process.env.UNIPILE_DSN}/api/v1/accounts/${selectedAccount.unipile_account_id}`;
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
      console.log(`✅ Unipile account verified: ${unipileAccountData.id}, status: ${unipileAccountData.status}`);

      // Check if account is actually active
      const hasActiveSource = unipileAccountData.sources?.some((s: any) => s.status === 'OK');
      if (!hasActiveSource) {
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

    console.log(`📋 Found ${executableProspects.length} prospects ready for execution`);

    if (executableProspects.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No prospects ready for messaging',
        campaign: campaign.name,
        suggestions: [
          'Check if prospects have LinkedIn URLs or internal IDs',
          'Verify prospect approval status',
          'Review campaign sequence settings'
        ]
      });
    }

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

        // Determine message type based on sequence step (default to 0 if not set)
        const sequenceStep = prospect.sequence_step || 0;
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
            const unipileResponse = await fetch(`${process.env.UNIPILE_DSN}/api/v1/users/${selectedAccount.unipile_account_id}/messages`, {
              method: 'POST',
              headers: {
                'X-API-KEY': process.env.UNIPILE_API_KEY || '',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                attendees: [{ identifier: prospect.linkedin_url }],
                provider_id: 'LINKEDIN',
                text: personalizedResult.message,
                type: 'INVITATION'
              })
            });

            if (!unipileResponse.ok) {
              const errorData = await unipileResponse.json().catch(() => ({}));
              throw new Error(`Unipile API error: ${errorData.message || unipileResponse.statusText}`);
            }

            const unipileData = await unipileResponse.json();
            console.log('✅ Unipile response:', unipileData);

            // Update prospect status
            await supabase
              .from('campaign_prospects')
              .update({
                status: 'connection_requested',
                sequence_step: sequenceStep + 1,
                contacted_at: new Date().toISOString(),
                personalization_data: {
                  message: personalizedResult.message,
                  cost: personalizedResult.cost,
                  model: personalizedResult.model,
                  unipile_message_id: unipileData.object?.id
                }
              })
              .eq('id', prospect.id);

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
            console.error(`❌ Failed to send connection request to ${prospect.first_name}:`, sendError);
            results.errors.push({
              prospect: `${prospect.first_name || 'Unknown'} ${prospect.last_name || 'Unknown'}`,
              error: sendError instanceof Error ? sendError.message : 'Unknown error'
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
          maxProspects: 2,
          dryRun: false
        })
      }).catch(err => {
        console.error('⚠️ Failed to trigger next batch:', err.message);
      });
    }

    return NextResponse.json({
      success: true,
      message: `Campaign executed: ${results.messages_sent} connection requests sent${hasMoreProspects ? `. Processing ${remainingCount} more in background.` : ''}`,
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