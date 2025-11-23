/**
 * Cron Job: Execute Scheduled LinkedIn Campaigns
 *
 * This cron job runs every 2 minutes to check for campaigns that are due for execution.
 * It respects working hours, timezone, and other campaign execution preferences.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Set Netlify function timeout to 5 minutes (campaigns can take time to execute)
export const maxDuration = 300;

// Helper function to check if execution should proceed based on campaign settings
function shouldExecuteNow(campaign: any): { allowed: boolean; reason?: string } {
  const {
    timezone = 'UTC',
    working_hours_start = 7,
    working_hours_end = 18,
    skip_weekends = true,
    skip_holidays = true,
    country_code = 'US'
  } = campaign;

  // Get current time in campaign's timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
    weekday: 'short'
  });

  const parts = formatter.formatToParts(now);
  const currentHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const currentDay = parts.find(p => p.type === 'weekday')?.value;

  // Check working hours
  if (currentHour < working_hours_start || currentHour >= working_hours_end) {
    return {
      allowed: false,
      reason: `Outside working hours (${working_hours_start}:00-${working_hours_end}:00 ${timezone})`
    };
  }

  // Check weekends
  if (skip_weekends && (currentDay === 'Sat' || currentDay === 'Sun')) {
    return {
      allowed: false,
      reason: 'Weekend - campaign configured to skip weekends'
    };
  }

  // TODO: Check holidays (requires holiday calendar integration)
  // For now, skip_holidays is noted but not enforced

  return { allowed: true };
}

export async function POST(req: NextRequest) {
  try {
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
    // INCLUDES:
    // 1. 'scheduled' campaigns with next_execution_time <= now
    // 2. 'active' campaigns with pending prospects (auto-execute if never run)
    const now = new Date().toISOString();

    // Query 1: Scheduled campaigns
    const { data: scheduledCampaigns, error: queryError } = await supabase
      .from('campaigns')
      .select('id, name, workspace_id, next_execution_time, timezone, working_hours_start, working_hours_end, skip_weekends, skip_holidays, country_code, n8n_execution_id')
      .eq('status', 'scheduled')
      .eq('auto_execute', true)
      .lte('next_execution_time', now)
      .not('next_execution_time', 'is', null)
      .limit(10); // Process up to 10 campaigns per run

    // Query 2: Active campaigns that were never executed
    const { data: activeCampaigns, error: activeError } = await supabase
      .from('campaigns')
      .select('id, name, workspace_id, timezone, working_hours_start, working_hours_end, skip_weekends, skip_holidays, country_code, n8n_execution_id')
      .eq('status', 'active')
      .eq('auto_execute', true)
      .is('n8n_execution_id', null)
      .limit(5); // Process up to 5 never-executed campaigns

    const allCampaigns = [...(scheduledCampaigns || []), ...(activeCampaigns || [])];

    if (queryError) {
      console.error('❌ Error querying scheduled campaigns:', queryError);
      return NextResponse.json({ error: 'Query failed', details: queryError.message }, { status: 500 });
    }

    if (activeError) {
      console.error('❌ Error querying active campaigns:', activeError);
    }

    if (allCampaigns.length === 0) {
      console.log('✅ No campaigns due for execution');
      return NextResponse.json({
        success: true,
        message: 'No campaigns due',
        checked_at: now
      });
    }

    console.log(`📊 Found ${allCampaigns.length} campaigns due for execution (${scheduledCampaigns?.length || 0} scheduled, ${activeCampaigns?.length || 0} active)`);

    const results = [];

    // Execute each campaign with randomized delays to avoid robotic patterns
    for (let i = 0; i < allCampaigns.length; i++) {
      const campaign = allCampaigns[i];

      // Add random delay between campaigns (0-10 minutes)
      // This makes campaign starts look more natural and human-like
      if (i > 0) {
        const randomDelay = Math.floor(Math.random() * 10 * 60 * 1000); // 0-10 minutes in ms
        console.log(`⏱️  Adding ${Math.floor(randomDelay / 60000)} minute random delay before campaign ${i + 1}`);
        await new Promise(resolve => setTimeout(resolve, randomDelay));
      }

      try {
        console.log(`\n🔍 Checking campaign: ${campaign.name} (${campaign.id})`);

        // Check if current time is within working hours and allowed days
        const executionCheck = shouldExecuteNow(campaign);
        if (!executionCheck.allowed) {
          console.log(`⏸️  Skipping execution: ${executionCheck.reason}`);

          // Reschedule for next opportunity (30 minutes from now)
          const nextCheckTime = new Date(Date.now() + 30 * 60 * 1000);
          await supabase
            .from('campaigns')
            .update({ next_execution_time: nextCheckTime.toISOString() })
            .eq('id', campaign.id);

          results.push({
            campaign_id: campaign.id,
            campaign_name: campaign.name,
            status: 'rescheduled',
            reason: executionCheck.reason,
            next_check: nextCheckTime.toISOString()
          });
          continue;
        }

        console.log(`🚀 Executing campaign: ${campaign.name} (within working hours)`);

        // Get the user who created the campaign (to use their LinkedIn account)
        const { data: campaignOwner, error: ownerError } = await supabase
          .from('workspace_members')
          .select('user_id, role')
          .eq('workspace_id', campaign.workspace_id)
          .eq('role', 'owner')
          .single();

        if (!campaignOwner || ownerError) {
          console.error(`❌ No owner found for campaign ${campaign.id}:`, ownerError?.message);
          results.push({
            campaign_id: campaign.id,
            campaign_name: campaign.name,
            status: 'error',
            error: ownerError?.message || 'No campaign owner found'
          });
          continue;
        }

        // Trigger the direct Unipile API
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const response = await fetch(`${baseUrl}/api/campaigns/direct/send-connection-requests`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-trigger': 'cron'
          },
          body: JSON.stringify({
            campaignId: campaign.id
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
    description: 'Executes LinkedIn campaigns with 2-30 minute randomized delays',
    schedule: 'Every 2 minutes',
    endpoint: '/api/cron/execute-scheduled-campaigns',
    method: 'POST'
  });
}
