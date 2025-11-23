/**
 * Cron Job: Check for Accepted LinkedIn Connections
 *
 * Polls Unipile to detect accepted connection requests
 * Updates prospect status and schedules follow-up messages
 *
 * Run: Every 1 hour (avoid rate limits)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    console.log('⏰ Cron: Checking for accepted connections...');

    // Verify cron secret
    const cronSecret = req.headers.get('x-cron-secret');
    if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
      console.error('❌ Invalid cron secret');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Get all prospects with status 'connection_requested' from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select(`
        id,
        linkedin_url,
        contacted_at,
        personalization_data,
        campaign_id,
        campaigns (
          id,
          workspace_id,
          created_by
        )
      `)
      .eq('status', 'connection_requested')
      .gte('contacted_at', thirtyDaysAgo.toISOString())
      .limit(50); // Check 50 prospects per run

    if (prospectsError || !prospects || prospects.length === 0) {
      console.log('✅ No connection requests to check');
      return NextResponse.json({
        success: true,
        message: 'No pending connection requests',
        checked_at: new Date().toISOString()
      });
    }

    console.log(`📊 Checking ${prospects.length} connection requests...`);

    // Group by workspace to get LinkedIn accounts
    const workspaceIds = [...new Set(prospects.map(p => p.campaigns.workspace_id))];

    const results = {
      checked: 0,
      accepted: 0,
      still_pending: 0,
      errors: []
    };

    for (const workspaceId of workspaceIds) {
      // Get LinkedIn accounts for this workspace
      const { data: accounts } = await supabase
        .from('workspace_accounts')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('account_type', 'linkedin')
        .eq('connection_status', 'connected');

      if (!accounts || accounts.length === 0) {
        console.log(`⚠️ No LinkedIn accounts for workspace ${workspaceId}`);
        continue;
      }

      // Check each account's recent relations for accepted connections
      for (const account of accounts) {
        try {
          // Get recent relations (new connections)
          // https://developer.unipile.com/reference/userscontroller_getrelations
          const relationsUrl = `https://${process.env.UNIPILE_DSN}/api/v1/users/relations?account_id=${account.unipile_account_id}&limit=50`;

          const relationsResponse = await fetch(relationsUrl, {
            method: 'GET',
            headers: {
              'X-API-KEY': process.env.UNIPILE_API_KEY || '',
              'Accept': 'application/json'
            }
          });

          if (!relationsResponse.ok) {
            console.error(`❌ Failed to fetch relations for ${account.account_name}`);
            continue;
          }

          const relationsData = await relationsResponse.json();
          const recentRelations = relationsData.items || [];

          // Find prospects whose connections were accepted
          const workspaceProspects = prospects.filter(
            p => p.campaigns.workspace_id === workspaceId
          );

          for (const prospect of workspaceProspects) {
            results.checked++;

            // Match based on provider_id (linkedin_user_id) or public_identifier (from URL)
            const linkedinUsername = prospect.linkedin_url?.split('/in/')[1]?.split('?')[0]?.replace('/', '');
            const storedProviderId = prospect.personalization_data?.provider_id;

            const isConnected = recentRelations.some((relation: any) =>
              (storedProviderId && relation.provider_id === storedProviderId) ||
              (linkedinUsername && relation.public_identifier === linkedinUsername)
            );

            if (isConnected) {
              console.log(`✅ Connection accepted: ${prospect.first_name} ${prospect.last_name}`);

              // Update prospect status to 'connected'
              await supabase
                .from('campaign_prospects')
                .update({
                  status: 'connected',
                  connection_accepted_at: new Date().toISOString(),
                  follow_up_due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
                  updated_at: new Date().toISOString()
                })
                .eq('id', prospect.id);

              results.accepted++;
            } else {
              results.still_pending++;
            }
          }

        } catch (accountError) {
          console.error(`❌ Error checking account ${account.account_name}:`, accountError);
          results.errors.push({
            account: account.account_name,
            error: accountError instanceof Error ? accountError.message : 'Unknown error'
          });
        }

        // Rate limiting: wait 2 seconds between accounts
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`\n🎉 Check completed:`);
    console.log(`   Checked: ${results.checked}`);
    console.log(`   Accepted: ${results.accepted}`);
    console.log(`   Still pending: ${results.still_pending}`);

    return NextResponse.json({
      success: true,
      message: `Checked ${results.checked} connections, found ${results.accepted} accepted`,
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
    name: 'Check Accepted Connections Cron',
    description: 'Polls for accepted LinkedIn connections and schedules follow-ups',
    schedule: 'Every 1 hour',
    endpoint: '/api/cron/check-accepted-connections',
    method: 'POST'
  });
}
