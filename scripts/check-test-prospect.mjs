#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTestProspect() {
    console.log('\n🔍 Checking test prospect status...\n');

    const prospectId = '08171770-45e9-4721-8a15-ea2ed7e06e01'; // Armin M.
    const campaignId = '3326aa89-9220-4bef-a1db-9c54f14fc536'; // SAM Startup Canada

    // Check prospect status
    const { data: prospect } = await supabase
        .from('campaign_prospects')
        .select('*')
        .eq('id', prospectId)
        .single();

    if (!prospect) {
        console.log('❌ Prospect not found');
        return;
    }

    console.log('📋 Prospect Status:');
    console.log(`   Name: ${prospect.first_name} ${prospect.last_name}`);
    console.log(`   Status: ${prospect.status}`);
    console.log(`   Scheduled: ${prospect.scheduled_send_at}`);
    console.log(`   Contacted: ${prospect.contacted_at || 'Not yet'}`);

    // Check which LinkedIn account this campaign uses
    const { data: campaign } = await supabase
        .from('campaigns')
        .select('id, name, workspace_id, linkedin_account_id')
        .eq('id', campaignId)
        .single();

    console.log('\n📋 Campaign Config:');
    console.log(`   Campaign: ${campaign.name}`);
    console.log(`   Workspace ID: ${campaign.workspace_id}`);
    console.log(`   LinkedIn Account ID: ${campaign.linkedin_account_id || 'NOT SET!'}`);

    if (campaign.linkedin_account_id) {
        const { data: account } = await supabase
            .from('workspace_accounts')
            .select('*')
            .eq('id', campaign.linkedin_account_id)
            .single();

        if (account) {
            console.log('\n🔗 LinkedIn Account:');
            console.log(`   Account Name: ${account.account_name}`);
            console.log(`   Unipile ID: ${account.unipile_account_id}`);
            console.log(`   Status: ${account.connection_status}`);
            console.log(`   Type: ${account.account_type}`);
        } else {
            console.log('\n❌ LinkedIn account ID set but account not found!');
        }
    } else {
        console.log('\n❌ PROBLEM: Campaign has no linkedin_account_id set!');
        console.log('   This is why nothing sent - the cron script needs this field.');

        // Find the correct account
        const { data: correctAccount } = await supabase
            .from('workspace_accounts')
            .select('*')
            .eq('workspace_id', campaign.workspace_id)
            .eq('account_type', 'linkedin')
            .eq('connection_status', 'connected')
            .single();

        if (correctAccount) {
            console.log('\n✅ Found the correct account to use:');
            console.log(`   Account: ${correctAccount.account_name}`);
            console.log(`   ID: ${correctAccount.id}`);
            console.log(`   Unipile ID: ${correctAccount.unipile_account_id}`);
            console.log('\n💡 Fix: Update campaign.linkedin_account_id to this ID');
        }
    }
}

checkTestProspect();
