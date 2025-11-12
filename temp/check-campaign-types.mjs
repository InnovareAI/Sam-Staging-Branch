#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkCampaignTypes() {
  console.log('🔍 Checking All Campaign Types\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });

  // Get all active campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*, workspaces(name)')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  console.log(`Found ${campaigns?.length || 0} active campaigns\n`);

  const connector = [];
  const messenger = [];
  const other = [];

  for (const campaign of campaigns || []) {
    const type = campaign.campaign_type;

    if (type === 'connector') {
      connector.push(campaign);
    } else if (type === 'messenger') {
      messenger.push(campaign);
    } else {
      other.push(campaign);
    }
  }

  console.log('📊 CAMPAIGN TYPE BREAKDOWN:\n');

  console.log(`✅ CONNECTOR (sends connection requests): ${connector.length}`);
  for (const c of connector) {
    console.log(`   - ${c.name} (${c.workspaces.name})`);
    console.log(`     Has CR message: ${!!(c.connection_message || c.message_templates?.connection_request)}`);
  }
  console.log('');

  console.log(`💬 MESSENGER (skips CR, sends DMs): ${messenger.length}`);
  for (const c of messenger) {
    console.log(`   - ${c.name} (${c.workspaces.name})`);
    console.log(`     ⚠️  This campaign SKIPS connection requests!`);
  }
  console.log('');

  if (other.length > 0) {
    console.log(`❓ OTHER: ${other.length}`);
    for (const c of other) {
      console.log(`   - ${c.name} (${c.workspaces.name}) - Type: ${c.campaign_type || 'NONE'}`);
    }
    console.log('');
  }

  console.log('─'.repeat(60));
  console.log('\n🎯 ISSUE DIAGNOSIS:');

  if (messenger.length > 0) {
    console.log('\n⚠️  FOUND MESSENGER CAMPAIGNS!');
    console.log('These campaigns are set to SKIP connection requests.');
    console.log('They only work with 1st-degree connections (already connected).');
    console.log('\n💡 SOLUTION:');
    console.log('For lead generation, campaigns should be type "connector"');
    console.log('This sends connection requests FIRST, then follow-ups.\n');

    console.log('To fix:');
    messenger.forEach(c => {
      console.log(`\nCampaign: ${c.name} (${c.id})`);
      console.log('SQL to fix:');
      console.log(`UPDATE campaigns SET campaign_type = 'connector' WHERE id = '${c.id}';`);
    });
  } else {
    console.log('\n✅ All campaigns are set to send connection requests.');
    console.log('If CRs are still being skipped, check N8N workflow logic.\n');
  }
}

checkCampaignTypes().catch(console.error);
