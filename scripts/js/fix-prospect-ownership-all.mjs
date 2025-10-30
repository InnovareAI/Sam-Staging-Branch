#!/usr/bin/env node
/**
 * Fix Prospect Ownership - Update All
 * Updates created_by field for all prospects in campaign
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
const CAMPAIGN_OWNER_ID = 'f6885ff3-deef-4781-8721-93011c990b1b'; // Thorsten's user ID

async function fixOwnership() {
  console.log('🔧 FIXING ALL PROSPECT OWNERSHIP\n');
  console.log('='.repeat(80));

  // Get all prospects
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, created_by, status')
    .eq('campaign_id', CAMPAIGN_ID);

  console.log(`\n📊 Found ${prospects?.length || 0} total prospects in campaign\n`);

  const needsUpdate = prospects?.filter(p => p.created_by !== CAMPAIGN_OWNER_ID) || [];
  
  console.log(`   ${needsUpdate.length} prospects need ownership update:\n`);

  if (needsUpdate.length === 0) {
    console.log('   ✅ All prospects already have correct ownership');
    return;
  }

  // Update each prospect
  for (const prospect of needsUpdate) {
    console.log(`   Fixing: ${prospect.first_name} ${prospect.last_name}`);
    console.log(`      Current: ${prospect.created_by || 'NULL/undefined'}`);
    console.log(`      Setting to: ${CAMPAIGN_OWNER_ID}`);

    const { error } = await supabase
      .from('campaign_prospects')
      .update({ created_by: CAMPAIGN_OWNER_ID })
      .eq('id', prospect.id);

    if (error) {
      console.log(`      ❌ Failed: ${error.message}`);
    } else {
      console.log(`      ✅ Updated`);
    }
    console.log('');
  }

  // Verify the fix
  console.log('='.repeat(80));
  console.log('📊 VERIFICATION');
  console.log('='.repeat(80));

  const { data: updatedProspects } = await supabase
    .from('campaign_prospects')
    .select('first_name, last_name, created_by, status')
    .eq('campaign_id', CAMPAIGN_ID);

  const fixed = updatedProspects?.filter(p => p.created_by === CAMPAIGN_OWNER_ID) || [];
  const stillBroken = updatedProspects?.filter(p => p.created_by !== CAMPAIGN_OWNER_ID) || [];

  console.log(`\n   ✅ Correct ownership: ${fixed.length} prospects`);
  console.log(`   ❌ Wrong/missing ownership: ${stillBroken.length} prospects`);

  if (stillBroken.length > 0) {
    console.log('\n   Still need fixing:');
    stillBroken.forEach(p => {
      console.log(`      - ${p.first_name} ${p.last_name} (${p.created_by || 'NULL'})`);
    });
  } else {
    console.log('\n   🎉 ALL PROSPECTS FIXED!');
    console.log('\n   ✅ Campaign is ready for execution');
    console.log('   Run: node scripts/js/test-campaign-live-execution.mjs');
  }

  console.log('\n' + '='.repeat(80));
}

fixOwnership().catch(console.error);
