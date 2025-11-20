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

async function checkCharissaStatus() {
    console.log('\n🔍 CHARISSA CAMPAIGN STATUS CHECK\n');
    console.log('='.repeat(80));

    // 1. Check campaigns
    console.log('\n📋 CAMPAIGNS (IA4 Workspace - Charissa):');
    const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, name, status, created_at')
        .eq('workspace_id', '7f0341da-88db-476b-ae0a-fc0da5b70861')
        .order('created_at', { ascending: false })
        .limit(10);

    if (campaigns) {
        campaigns.forEach(c => {
            console.log(`   ${c.name}`);
            console.log(`      ID: ${c.id}`);
            console.log(`      Status: ${c.status}`);
            console.log(`      Created: ${new Date(c.created_at).toLocaleString()}`);
            console.log('');
        });
    }

    // 2. Check prospects per campaign
    console.log('\n👥 PROSPECT STATUS BY CAMPAIGN:');
    for (const campaign of campaigns || []) {
        const { data: stats } = await supabase
            .from('campaign_prospects')
            .select('status, scheduled_send_at, contacted_at')
            .eq('campaign_id', campaign.id);

        if (stats && stats.length > 0) {
            console.log(`\n   ${campaign.name}:`);

            const statusCounts = {};
            let withSchedule = 0;
            let contacted = 0;

            stats.forEach(p => {
                statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
                if (p.scheduled_send_at) withSchedule++;
                if (p.contacted_at) contacted++;
            });

            console.log(`      Total Prospects: ${stats.length}`);
            console.log(`      Status Breakdown:`);
            Object.entries(statusCounts).forEach(([status, count]) => {
                console.log(`         ${status}: ${count}`);
            });
            console.log(`      With scheduled_send_at: ${withSchedule}`);
            console.log(`      Contacted: ${contacted}`);
        }
    }

    // 3. Check queued prospects
    console.log('\n⏰ QUEUED PROSPECTS (ready to send):');
    const now = new Date().toISOString();
    const { data: queued } = await supabase
        .from('campaign_prospects')
        .select('first_name, last_name, status, scheduled_send_at, campaign_id')
        .eq('status', 'queued')
        .lte('scheduled_send_at', now)
        .limit(10);

    if (queued && queued.length > 0) {
        queued.forEach(p => {
            console.log(`   ${p.first_name} ${p.last_name} - scheduled: ${new Date(p.scheduled_send_at).toLocaleString()}`);
        });
    } else {
        console.log('   None (This is why nothing is sending!)');
    }

    // 4. Check upcoming scheduled
    console.log('\n📅 UPCOMING SCHEDULED PROSPECTS:');
    const { data: upcoming } = await supabase
        .from('campaign_prospects')
        .select('first_name, last_name, status, scheduled_send_at, campaign_id')
        .eq('status', 'queued')
        .gt('scheduled_send_at', now)
        .order('scheduled_send_at')
        .limit(10);

    if (upcoming && upcoming.length > 0) {
        upcoming.forEach(p => {
            console.log(`   ${p.first_name} ${p.last_name} - scheduled: ${new Date(p.scheduled_send_at).toLocaleString()}`);
        });
    } else {
        console.log('   None');
    }

    // 5. Check LinkedIn account
    console.log('\n🔗 LINKEDIN ACCOUNT (IA4):');
    const { data: account } = await supabase
        .from('workspace_accounts')
        .select('account_name, unipile_account_id, connection_status, account_identifier')
        .eq('workspace_id', '7f0341da-88db-476b-ae0a-fc0da5b70861')
        .eq('account_type', 'linkedin')
        .single();

    if (account) {
        console.log(`   Account: ${account.account_name}`);
        console.log(`   Unipile ID: ${account.unipile_account_id}`);
        console.log(`   Status: ${account.connection_status}`);
        console.log(`   Email: ${account.account_identifier}`);
    } else {
        console.log('   ❌ NO LINKEDIN ACCOUNT FOUND!');
    }

    // 6. Check cron job
    console.log('\n⚙️  CRON JOB STATUS:');
    const { exec } = await import('child_process');
    exec('crontab -l 2>/dev/null | grep send-scheduled', (error, stdout) => {
        if (stdout) {
            console.log(`   ${stdout.trim()}`);
        } else {
            console.log('   ❌ NO CRON JOB INSTALLED! (This is the main problem)');
        }
    });

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Diagnostic complete\n');
}

checkCharissaStatus();
