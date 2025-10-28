/**
 * Cron Job: Execute Scheduled LinkedIn Campaigns
 *
 * Runs every 5 minutes to check for campaigns that are due for execution.
 * Implements 30-90 minute randomized delays between connection requests for LinkedIn safety.
 *
 * Setup: Configure in Netlify:
 * - Path: /.netlify/functions/api/cron/execute-scheduled-campaigns
 * - Schedule: every 5 minutes (cron: star-slash-5 * * * *)
 * - Method: POST
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    console.log('⏰ Cron: Checking for scheduled campaigns...');

    // Verify cron secret (optional security)
    const cronSecret = req.headers.get('x-cron-secret');
    if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
      console.error('❌ Invalid cron secret');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service role for cron operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Find campaigns that are due for execution
    const now = new Date().toISOString();
    const { data: scheduledCampaigns, error: queryError } = await supabase
      .from('campaigns')
      .select('id, name, workspace_id, next_execution_time')
      .eq('status', 'scheduled')
      .eq('auto_execute', true)
      .lte('next_execution_time', now)
      .not('next_execution_time', 'is', null)
      .limit(10); // Process up to 10 campaigns per run

    if (queryError) {
      console.error('❌ Error querying campaigns:', queryError);
      return NextResponse.json({ error: 'Query failed', details: queryError.message }, { status: 500 });
    }

    if (!scheduledCampaigns || scheduledCampaigns.length === 0) {
      console.log('✅ No campaigns due for execution');
      return NextResponse.json({
        success: true,
        message: 'No campaigns due',
        checked_at: now
      });
    }

    console.log(`📊 Found ${scheduledCampaigns.length} campaigns due for execution`);

    const results = [];

    // Execute each campaign
    for (const campaign of scheduledCampaigns) {
      try {
        console.log(`\n🚀 Executing campaign: ${campaign.name} (${campaign.id})`);

        // Get the user who created the campaign (to use their LinkedIn account)
        const { data: campaignOwner } = await supabase
          .from('workspace_members')
          .select('user_id, users(email)')
          .eq('workspace_id', campaign.workspace_id)
          .eq('role', 'owner')
          .single();

        if (!campaignOwner) {
          console.error(`❌ No owner found for campaign ${campaign.id}`);
          results.push({
            campaign_id: campaign.id,
            campaign_name: campaign.name,
            status: 'error',
            error: 'No campaign owner found'
          });
          continue;
        }

        // Trigger the execute-live API
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const response = await fetch(`${baseUrl}/api/campaigns/linkedin/execute-live`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-trigger': 'cron'
          },
          body: JSON.stringify({
            campaignId: campaign.id,
            maxProspects: 1, // Process 1 prospect at a time
            dryRun: false
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Execution failed for ${campaign.name}:`, errorText);
          results.push({
            campaign_id: campaign.id,
            campaign_name: campaign.name,
            status: 'error',
            error: errorText
          });
          continue;
        }

        const result = await response.json();
        console.log(`✅ Executed ${campaign.name}: ${result.message}`);

        results.push({
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          status: 'success',
          message: result.message,
          messages_sent: result.results?.messages_sent || 0,
          remaining_prospects: result.remaining_prospects || 0
        });

      } catch (campaignError) {
        console.error(`❌ Error executing campaign ${campaign.id}:`, campaignError);
        results.push({
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          status: 'error',
          error: campaignError instanceof Error ? campaignError.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    console.log(`\n🎉 Cron execution completed: ${successCount} successful, ${errorCount} errors`);

    return NextResponse.json({
      success: true,
      message: `Executed ${successCount} campaigns, ${errorCount} errors`,
      campaigns_processed: results.length,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Cron error:', error);
    return NextResponse.json({
      error: 'Cron execution failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Allow GET for testing
export async function GET(req: NextRequest) {
  return NextResponse.json({
    name: 'Execute Scheduled Campaigns Cron',
    description: 'Executes LinkedIn campaigns with 30-90 minute randomized delays',
    schedule: 'Every 5 minutes',
    endpoint: '/api/cron/execute-scheduled-campaigns',
    method: 'POST'
  });
}
