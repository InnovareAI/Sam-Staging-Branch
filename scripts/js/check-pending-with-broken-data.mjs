#!/usr/bin/env node
/**
 * Check how many pending prospects have broken data
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('🔍 CHECKING PENDING PROSPECTS...\n');

  const { data, error } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, company_name, campaigns(name, status)')
    .in('status', ['pending', 'approved', 'ready_to_message']);

  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  const totalPending = data.length;
  const withoutNames = data.filter(p => !p.first_name || !p.last_name);
  const totalMissingNames = withoutNames.length;

  console.log('📊 SUMMARY:');
  console.log(`   Total pending: ${totalPending}`);
  console.log(`   Missing names (broken): ${totalMissingNames} ❌`);
  console.log(`   With proper names: ${totalPending - totalMissingNames} ✓`);
  console.log('');

  if (totalMissingNames > 0) {
    console.log('⚠️ WARNING: These prospects will send with BROKEN personalization!');
    console.log('   Message will be: "Hi , I noticed your experience in ."\n');

    console.log('Broken prospects by campaign:');
    const byCampaign = {};
    withoutNames.forEach(p => {
      const name = p.campaigns?.name || 'Unknown';
      if (!byCampaign[name]) byCampaign[name] = 0;
      byCampaign[name]++;
    });
    Object.entries(byCampaign).forEach(([name, count]) => {
      console.log(`   ${name}: ${count}`);
    });
  } else {
    console.log('✅ All pending prospects have proper names!');
  }
}

main().catch(console.error);
