#!/usr/bin/env node
/**
 * Debug Campaign Prospects - Check what's blocking execution
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CAMPAIGN_ID = '73bedc34-3b24-4315-8cf1-043e454019af';

async function debugProspects() {
  console.log('🔍 Debugging Campaign Prospects\n');

  // Get campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', CAMPAIGN_ID)
    .single();

  console.log('📋 Campaign:', campaign.name);
  console.log('   Status:', campaign.status);
  console.log('   Workspace:', campaign.workspace_id);
  console.log();

  // Get all prospects
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', CAMPAIGN_ID)
    .order('created_at', { ascending: false });

  console.log(`👥 Prospects: ${prospects.length} total\n`);

  prospects.forEach((p, i) => {
    console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
    console.log(`   Status: ${p.status}`);
    console.log(`   LinkedIn URL: ${p.linkedin_url || '❌ MISSING'}`);
    console.log(`   Contacted: ${p.contacted_at ? '✅ ' + new Date(p.contacted_at).toLocaleString() : '❌ No'}`);
    console.log(`   Ready: ${!p.contacted_at && p.linkedin_url && ['pending', 'approved', 'ready_to_message'].includes(p.status) ? '✅' : '❌'}`);
    console.log();
  });

  // Check workspace LinkedIn account
  console.log('🔗 Checking LinkedIn account...');
  const { data: accounts } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', campaign.workspace_id)
    .eq('provider', 'linkedin');

  if (!accounts || accounts.length === 0) {
    console.log('❌ No LinkedIn account connected');
  } else {
    accounts.forEach(acc => {
      console.log(`   Account: ${acc.account_name}`);
      console.log(`   Status: ${acc.status}`);
      console.log(`   Unipile ID: ${acc.unipile_account_id || '❌ Not set'}`);
    });
  }
}

debugProspects().catch(console.error);
