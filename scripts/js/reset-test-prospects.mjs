#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetProspects() {
  const campaignId = '105c036b-797d-4ca7-862c-309518fa72ef';
  
  console.log('\n🔧 RESETTING TEST PROSPECTS TO APPROVED STATUS\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Update all failed prospects to approved
  const { data: updated, error } = await supabase
    .from('campaign_prospects')
    .update({
      status: 'approved',
      notes: 'Test campaign - duplicate check overridden',
      updated_at: new Date().toISOString()
    })
    .eq('campaign_id', campaignId)
    .eq('status', 'failed')
    .select();

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`✅ Updated ${updated.length} prospects to approved status\n`);

  updated.forEach((p, i) => {
    console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
    console.log(`   └─ Status: ${p.status} ✅\n`);
  });

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('✅ Test prospects ready for campaign execution');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('Next steps:');
  console.log('1. Refresh the campaign dashboard');
  console.log('2. Campaign should now show under "Active Campaigns"');
  console.log('3. Messages can be sent to these 3 prospects\n');
}

resetProspects();
