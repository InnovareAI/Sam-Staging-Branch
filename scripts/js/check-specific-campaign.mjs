#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 CHECKING CAMPAIGN "20251029-IAI-test 7"\n');

const { data: campaign } = await supabase
  .from('campaigns')
  .select('*')
  .ilike('name', '%test 7%')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

if (!campaign) {
  console.log('❌ Campaign not found');
  process.exit(0);
}

console.log(`📋 Campaign: ${campaign.name}`);
console.log(`   ID: ${campaign.id}`);
console.log(`   Status: ${campaign.status}\n`);

const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('campaign_id', campaign.id);

console.log(`📊 Prospects: ${prospects?.length || 0}\n`);

prospects?.forEach((p, i) => {
  console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
  console.log(`   ID: ${p.id}`);
  console.log(`   Status: ${p.status}`);
  console.log(`   LinkedIn URL: ${p.linkedin_url || 'MISSING'}`);
  console.log(`   Added by Unipile: ${p.added_by_unipile_account || 'NULL'}\n`);
});

const { data: linkedInAccount } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', campaign.workspace_id)
  .eq('user_id', campaign.created_by)
  .eq('account_type', 'linkedin')
  .eq('connection_status', 'connected')
  .single();

console.log(`🔗 Your LinkedIn Account:`);
console.log(`   Unipile ID: ${linkedInAccount?.unipile_account_id}\n`);

if (prospects && prospects.length > 0) {
  console.log('✅ Execution Check:');
  prospects.forEach(p => {
    const hasLinkedIn = !!(p.linkedin_url || p.linkedin_user_id);
    const isYours = p.added_by_unipile_account === linkedInAccount.unipile_account_id || p.added_by_unipile_account === null;
    const statusOk = ['pending', 'approved', 'ready_to_message'].includes(p.status);

    console.log(`\n${p.first_name} ${p.last_name}:`);
    console.log(`   Has LinkedIn: ${hasLinkedIn ? '✅' : '❌'}`);
    console.log(`   Owned by you: ${isYours ? '✅' : '❌'}`);
    console.log(`   Status OK: ${statusOk ? '✅' : '❌'}`);
    console.log(`   CAN EXECUTE: ${hasLinkedIn && isYours && statusOk ? '✅ YES' : '❌ NO'}`);
  });
}
