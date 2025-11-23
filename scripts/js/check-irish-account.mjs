import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import moment from 'moment-timezone';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkIrishAccount() {
    console.log('🔍 Checking Account: Irish...');

    // 1. Find the account
    const { data: accounts, error: accountError } = await supabase
        .from('workspace_accounts')
        .select('*')
        .ilike('account_name', '%Irish%')
        .limit(1);

    if (accountError || !accounts || accounts.length === 0) {
        console.error('❌ Account not found or error:', accountError);
        return;
    }

    const account = accounts[0];
    console.log(`\n👤 Account: ${account.account_name}`);
    console.log(`   ID: ${account.id}`);
    console.log(`   Unipile ID: ${account.unipile_account_id}`);
    console.log(`   Status: ${account.connection_status}`);
    console.log(`   Type: ${account.account_type}`);

    // 2. Find campaigns using this account
    const { data: campaigns, error: campaignError } = await supabase
        .from('campaigns')
        .select('id, campaign_name, status')
        .eq('linkedin_account_id', account.id);

    if (campaignError) {
        console.error('Error fetching campaigns:', campaignError);
        return;
    }

    console.log(`\ncamp Campaigns (${campaigns.length}):`);
    campaigns.forEach(c => console.log(`   - ${c.campaign_name} (${c.status})`));

    const campaignIds = campaigns.map(c => c.id);

    if (campaignIds.length === 0) {
        console.log('   (No campaigns found for this account)');
        return;
    }

    // 3. Check recent prospects
    const { data: prospects, error: prospectError } = await supabase
        .from('campaign_prospects')
        .select('id, first_name, last_name, status, updated_at, campaigns(campaign_name)')
        .in('campaign_id', campaignIds)
        .order('updated_at', { ascending: false })
        .limit(20);

    if (prospectError) {
        console.error('Error fetching prospects:', prospectError);
        return;
    }

    console.log(`\n👥 Recent Prospects (Last 20):`);
    prospects.forEach(p => {
        const updated = moment(p.updated_at).tz('America/New_York').format('MM/DD HH:mm');
        const campaignName = p.campaigns?.campaign_name || 'Unknown';
        console.log(`   - ${p.first_name} ${p.last_name}: [${p.status}] (Updated: ${updated})`);
    });
}

checkIrishAccount().catch(console.error);
