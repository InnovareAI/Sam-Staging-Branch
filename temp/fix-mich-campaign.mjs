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

const CAMPAIGN_ID = '4cd9275f-b82d-47d6-a1d4-7207b992c4b7';

async function fixCampaign() {
  console.log('🔧 Fixing Mich\'s Campaign\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });

  // Step 1: Check current state
  console.log('Step 1: Checking current state...');
  const { data: before, error: fetchError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', CAMPAIGN_ID)
    .single();

  if (fetchError) {
    console.error('❌ Error:', fetchError.message);
    process.exit(1);
  }

  console.log('\nBEFORE:');
  console.log(`  Campaign: ${before.name}`);
  console.log(`  status: ${before.status}`);
  console.log(`  is_active: ${before.is_active}`);
  console.log(`  campaign_type: ${before.campaign_type}`);

  // Step 2: Fix the is_active flag
  console.log('\nStep 2: Setting is_active = true...');
  const { data: after, error: updateError } = await supabase
    .from('campaigns')
    .update({ is_active: true })
    .eq('id', CAMPAIGN_ID)
    .select()
    .single();

  if (updateError) {
    console.error('❌ Error:', updateError.message);
    process.exit(1);
  }

  console.log('\nAFTER:');
  console.log(`  Campaign: ${after.name}`);
  console.log(`  status: ${after.status}`);
  console.log(`  is_active: ${after.is_active} ✅`);

  // Step 3: Verify prospects have linkedin_url
  console.log('\nStep 3: Checking prospect data...');
  const { data: prospects, error: prospectError } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, linkedin_url, status')
    .eq('campaign_id', CAMPAIGN_ID);

  if (prospectError) {
    console.error('❌ Error:', prospectError.message);
  } else {
    const withUrl = prospects.filter(p => p.linkedin_url).length;
    const withoutUrl = prospects.length - withUrl;

    console.log(`  Total prospects: ${prospects.length}`);
    console.log(`  With LinkedIn URL: ${withUrl} ✅`);
    if (withoutUrl > 0) {
      console.log(`  Missing LinkedIn URL: ${withoutUrl} ⚠️`);
      console.log('\n  Prospects without LinkedIn URL:');
      prospects.filter(p => !p.linkedin_url).forEach(p => {
        console.log(`    - ${p.first_name} ${p.last_name} (${p.id})`);
      });
    }
  }

  console.log('\n✅ Campaign Fixed!\n');
  console.log('🚀 Ready to execute:');
  console.log(`   Campaign ID: ${CAMPAIGN_ID}`);
  console.log(`   Workspace ID: ${before.workspace_id}`);
  console.log('\n   To test execution:');
  console.log(`   Go to UI → Campaign Hub → "Test 1- Mich" → Execute\n`);
}

fixCampaign().catch(console.error);
