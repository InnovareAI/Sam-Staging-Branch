/**
 * Cron Job: Process Pending Campaign Prospects
 *
 * Runs every 5 minutes to process prospects that were queued for background execution.
 * Handles the "Processing in background" message from campaign execution.
 *
 * Setup: Configure in Netlify:
 * - Path: /.netlify/functions/api/cron/process-pending-prospects
 * - Schedule: every 5 minutes (star-slash-5 star star star star)
 * - Method: POST
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    console.log('⏰ Cron: Processing pending prospects...');

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

    // Find pending prospects with LinkedIn URLs (ready to contact)
    // Only process prospects from active or scheduled campaigns
    const { data: pendingProspects, error: queryError } = await supabase
      .from('campaign_prospects')
      .select(`
        id,
        campaign_id,
        first_name,
        last_name,
        company_name,
        linkedin_url,
        created_at,
        campaigns!inner (
          id,
          name,
          campaign_name,
          status,
          workspace_id
        )
      `)
      .in('status', ['pending', 'approved', 'ready_to_message'])
      .not('linkedin_url', 'is', null)
      .in('campaigns.status', ['active', 'scheduled'])
      .limit(10); // Process 10 prospects per run

    if (queryError) {
      console.error('❌ Error querying prospects:', queryError);
      return NextResponse.json({ error: 'Query failed', details: queryError.message }, { status: 500 });
    }

    if (!pendingProspects || pendingProspects.length === 0) {
      console.log('✅ No pending prospects to process');
      return NextResponse.json({
        success: true,
        message: 'No pending prospects',
        checked_at: new Date().toISOString()
      });
    }

    console.log(`📊 Found ${pendingProspects.length} pending prospects to process`);

    // Group prospects by campaign for efficient processing
    const prospectsByCampaign = pendingProspects.reduce((acc, prospect) => {
      const campaignId = prospect.campaign_id;
      if (!acc[campaignId]) {
        acc[campaignId] = {
          campaign: prospect.campaigns,
          prospects: []
        };
      }
      acc[campaignId].prospects.push(prospect);
      return acc;
    }, {} as Record<string, { campaign: any; prospects: any[] }>);

    const results = [];
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Process each campaign's prospects
    for (const [campaignId, { campaign, prospects }] of Object.entries(prospectsByCampaign)) {
      try {
        if (!campaign) {
          console.error(`❌ Campaign data missing for campaign ID: ${campaignId}`);
          results.push({
            campaign_id: campaignId,
            campaign_name: 'Unknown',
            status: 'campaign_error',
            error: 'Campaign data not found in database'
          });
          continue;
        }

        const campaignName = campaign.campaign_name || campaign.name || 'Unknown Campaign';
        console.log(`\n🔍 Processing ${prospects.length} prospects for campaign: ${campaignName}`);

        // Process prospects one at a time to avoid rate limits
        for (const prospect of prospects) {
          try {
            const prospectName = `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim() || 'Unknown';
            console.log(`  → ${prospectName} at ${prospect.company_name || 'Unknown company'}`);

            // Call direct Unipile API to send connection request
            const response = await fetch(`${baseUrl}/api/campaigns/direct/send-connection-requests`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-internal-trigger': 'cron-pending-prospects'
              },
              body: JSON.stringify({
                campaignId: campaignId
              })
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error(`    ❌ Failed to process ${prospectName}:`, errorText);
              results.push({
                prospect_id: prospect.id,
                prospect_name: prospectName,
                campaign_id: campaignId,
                campaign_name: campaign.name,
                status: 'error',
                error: errorText
              });
              continue;
            }

            const result = await response.json();
            console.log(`    ✅ Processed ${prospectName}`);

            results.push({
              prospect_id: prospect.id,
              prospect_name: prospectName,
              campaign_id: campaignId,
              campaign_name: campaign.name,
              status: 'success',
              message: result.message
            });

            // Add a small delay between prospects to avoid rate limits (1-2 seconds)
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

          } catch (prospectError) {
            console.error(`    ❌ Error processing prospect ${prospect.id}:`, prospectError);
            results.push({
              prospect_id: prospect.id,
              prospect_name: `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim(),
              campaign_id: campaignId,
              campaign_name: campaign.name,
              status: 'error',
              error: prospectError instanceof Error ? prospectError.message : 'Unknown error'
            });
          }
        }

      } catch (campaignError) {
        console.error(`❌ Error processing campaign ${campaignId}:`, campaignError);
        results.push({
          campaign_id: campaignId,
          campaign_name: campaign?.name || 'Unknown',
          status: 'campaign_error',
          error: campaignError instanceof Error ? campaignError.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    console.log(`\n🎉 Cron execution completed: ${successCount} successful, ${errorCount} errors`);

    return NextResponse.json({
      success: true,
      message: `Processed ${successCount} prospects, ${errorCount} errors`,
      prospects_processed: results.length,
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
    name: 'Process Pending Prospects Cron',
    description: 'Processes prospects queued for background execution',
    schedule: 'Every 5 minutes',
    endpoint: '/api/cron/process-pending-prospects',
    method: 'POST',
    test_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/cron/process-pending-prospects`
  });
}
