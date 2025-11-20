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

const TOBIAS_UNIPILE_ID = 'v8-RaHZzTD60o6EVwqcpvg';

console.log('\n🔍 Finding prospects sent from Tobias LinkedIn account...\n');

// Find campaigns using Tobias' account
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name, linkedin_account_id')
  .or(`linkedin_account_id.eq.${TOBIAS_UNIPILE_ID}`);

console.log(`Found ${campaigns?.length || 0} campaigns using Tobias' account\n`);

if (!campaigns || campaigns.length === 0) {
  // Try to find by workspace_accounts table
  const { data: account } = await supabase
    .from('workspace_accounts')
    .select('id')
    .eq('unipile_account_id', TOBIAS_UNIPILE_ID)
    .single();

  if (account) {
    const { data: campaignsFromAccount } = await supabase
      .from('campaigns')
      .select('id, name')
      .eq('linkedin_account_id', account.id);

    console.log(`Found ${campaignsFromAccount?.length || 0} campaigns via account lookup\n`);

    if (campaignsFromAccount && campaignsFromAccount.length > 0) {
      for (const campaign of campaignsFromAccount) {
        const { data: sentProspects } = await supabase
          .from('campaign_prospects')
          .select('id, first_name, last_name, status, contacted_at')
          .eq('campaign_id', campaign.id)
          .eq('status', 'connection_requested');

        console.log(`Campaign: ${campaign.name}`);
        console.log(`  Sent prospects: ${sentProspects?.length || 0}`);

        if (sentProspects && sentProspects.length > 0) {
          sentProspects.forEach(p => {
            console.log(`    - ${p.first_name} ${p.last_name} (${p.contacted_at})`);
          });
        }
        console.log('');
      }
    }
  }
}

// Alternative: Find all prospects with status='connection_requested' in the last 24 hours
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const { data: recentlySent } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, campaign_id, status, contacted_at')
  .eq('status', 'connection_requested')
  .gte('contacted_at', yesterday)
  .order('contacted_at', { ascending: false });

console.log(`\nRecently sent prospects (last 24h): ${recentlySent?.length || 0}\n`);

if (recentlySent && recentlySent.length > 0) {
  for (const p of recentlySent.slice(0, 20)) {
    console.log(`  ${p.first_name} ${p.last_name} - ${p.contacted_at}`);
  }
  if (recentlySent.length > 20) {
    console.log(`  ... and ${recentlySent.length - 20} more\n`);
  }
}

console.log('\n');
