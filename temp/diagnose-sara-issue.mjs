#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SARA_PROVIDER_ID = 'ACoAAAcxZNoBOO3uKSFEtKndR6hFtahdCk0Gj_Y';
const SARA_VANITY = 'sara-ritchie-6a24b834';
const CHARISSA_WORKSPACE_ID = '7f0341da-88db-476b-ae0a-fc0da5b70861';

console.log('🔍 DIAGNOSING WHY SARA\'S REPLY WASN\'T DETECTED');
console.log('='.repeat(70));

// 1. Check if Sara is in the database AT ALL
console.log('\n1️⃣ SEARCHING DATABASE FOR SARA RITCHIE...');

// Search by provider_id
const { data: byProviderId } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, status, linkedin_user_id, linkedin_url')
  .eq('linkedin_user_id', SARA_PROVIDER_ID);

console.log(`   By provider_id (${SARA_PROVIDER_ID}): ${byProviderId?.length || 0} found`);

// Search by vanity URL
const { data: byUrl } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, status, linkedin_user_id, linkedin_url')
  .ilike('linkedin_url', `%${SARA_VANITY}%`);

console.log(`   By URL containing "${SARA_VANITY}": ${byUrl?.length || 0} found`);

// Search by name in Charissa's workspace
const { data: byName } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, status, linkedin_user_id, linkedin_url, campaign_id')
  .eq('workspace_id', CHARISSA_WORKSPACE_ID)
  .ilike('first_name', 'sara')
  .ilike('last_name', 'ritchie');

console.log(`   By name "Sara Ritchie" in Charissa's workspace: ${byName?.length || 0} found`);

if (byName && byName.length > 0) {
  for (const p of byName) {
    console.log(`\n   👤 Found: ${p.first_name} ${p.last_name}`);
    console.log(`      Status: ${p.status}`);
    console.log(`      LinkedIn User ID: ${p.linkedin_user_id}`);
    console.log(`      LinkedIn URL: ${p.linkedin_url}`);
    console.log(`      Campaign ID: ${p.campaign_id}`);
  }
}

// 2. Search ALL prospects in Charissa's workspace that might match
console.log('\n' + '─'.repeat(70));
console.log('2️⃣ CHECKING ALL CHARISSA\'S PROSPECTS WITH "SARA" IN NAME...');

const { data: allSaras } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, status, linkedin_user_id, linkedin_url')
  .eq('workspace_id', CHARISSA_WORKSPACE_ID)
  .ilike('first_name', '%sara%');

for (const p of allSaras || []) {
  console.log(`   - ${p.first_name} ${p.last_name} | ${p.status} | ${p.linkedin_url?.slice(0, 50)}...`);
}

// 3. Check if the poll-message-replies cron would find Sara
console.log('\n' + '─'.repeat(70));
console.log('3️⃣ WHAT THE POLL-MESSAGE-REPLIES CRON WOULD SEE...');

// The cron looks for prospects with status 'connected' or 'connection_request_sent'
const { data: charissaProspects } = await supabase
  .from('campaign_prospects')
  .select(`
    id,
    first_name,
    last_name,
    linkedin_user_id,
    status,
    responded_at,
    campaigns!inner (
      workspace_id,
      linkedin_account_id,
      workspace_accounts!linkedin_account_id (
        unipile_account_id
      )
    )
  `)
  .eq('campaigns.workspace_id', CHARISSA_WORKSPACE_ID)
  .in('status', ['connected', 'connection_request_sent'])
  .is('responded_at', null)
  .not('linkedin_user_id', 'is', null);

console.log(`   Prospects cron would check: ${charissaProspects?.length || 0}`);

// Check if any match Sara's provider_id
const saraMatch = charissaProspects?.find(p =>
  p.linkedin_user_id === SARA_PROVIDER_ID ||
  p.linkedin_user_id?.includes(SARA_VANITY)
);

if (saraMatch) {
  console.log(`   ✅ Sara would be checked: ${saraMatch.first_name} ${saraMatch.last_name}`);
  console.log(`      linkedin_user_id: ${saraMatch.linkedin_user_id}`);
} else {
  console.log(`   ❌ Sara would NOT be checked`);
  console.log(`   Reason: Either not in database, wrong status, or linkedin_user_id doesn't match`);

  // Show what linkedin_user_ids look like
  console.log(`\n   Sample linkedin_user_ids in cron scope:`);
  charissaProspects?.slice(0, 5).forEach(p => {
    console.log(`      - ${p.first_name}: ${p.linkedin_user_id}`);
  });
}

console.log('\n' + '='.repeat(70));
