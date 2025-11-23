import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function forceCheckConnections() {
    console.log('🚀 Force-checking accepted connections...');

    // 1. Get pending prospects
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: prospects, error } = await supabase
        .from('campaign_prospects')
        .select(`
      id,
      first_name,
      last_name,
      linkedin_url,
      contacted_at,
      personalization_data,
      campaign_id,
      campaigns (
        id,
        workspace_id
      )
    `)
        .eq('status', 'connection_request_sent') // Note: Status is 'connection_request_sent' in DB, not 'connection_requested'
        .gte('contacted_at', thirtyDaysAgo.toISOString())
        .limit(50);

    if (error) {
        console.error('Error fetching prospects:', error);
        return;
    }

    console.log(`📊 Found ${prospects.length} pending requests to check.`);

    if (prospects.length === 0) return;

    // 2. Group by workspace
    const workspaceIds = [...new Set(prospects.map(p => p.campaigns.workspace_id))];

    for (const workspaceId of workspaceIds) {
        const { data: accounts } = await supabase
            .from('workspace_accounts')
            .select('*')
            .eq('workspace_id', workspaceId)
            .eq('account_type', 'linkedin')
            .eq('connection_status', 'connected');

        if (!accounts || accounts.length === 0) continue;

        for (const account of accounts) {
            console.log(`Checking account: ${account.account_name}`);

            try {
                const relationsUrl = `https://${process.env.UNIPILE_DSN}/api/v1/users/relations?account_id=${account.unipile_account_id}&limit=50`;

                const response = await fetch(relationsUrl, {
                    headers: { 'X-API-KEY': 'POcBmCSV.b/t0gstHvY5alDsy/BmKQmUBt4FmNXRF7fdOYqywJSM=' }
                });

                if (!response.ok) {
                    console.error(`Failed to fetch relations: ${response.statusText}`);
                    continue;
                }

                const data = await response.json();
                const relations = data.items || [];
                console.log(`Fetched ${relations.length} recent relations.`);

                // Check matches
                const workspaceProspects = prospects.filter(p => p.campaigns.workspace_id === workspaceId);

                for (const prospect of workspaceProspects) {
                    const linkedinUsername = prospect.linkedin_url?.split('/in/')[1]?.split('?')[0]?.replace('/', '');
                    const storedProviderId = prospect.personalization_data?.provider_id;
                    // Also check linkedin_user_id column if available (it should be)
                    // But here we use what we have in the select

                    const isConnected = relations.some(r =>
                        (storedProviderId && r.provider_id === storedProviderId) ||
                        (linkedinUsername && r.public_identifier === linkedinUsername)
                    );

                    if (isConnected) {
                        console.log(`✅ MATCH FOUND: ${prospect.first_name} ${prospect.last_name}`);

                        // Update DB
                        await supabase
                            .from('campaign_prospects')
                            .update({
                                status: 'connected',
                                connection_accepted_at: new Date().toISOString(),
                                follow_up_due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', prospect.id);
                    }
                }

            } catch (err) {
                console.error('Error:', err);
            }
        }
    }
}

forceCheckConnections().catch(console.error);
