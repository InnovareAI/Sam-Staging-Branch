#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: user } = await supabase
  .from('users')
  .select('*')
  .eq('email', 'tl@innovareai.com')
  .single();

console.log('🔍 FINDING DUPLICATE CAMPAIGNS\n');

// Get ALL campaigns named "20251029-IAI-test 9"
const { data: duplicates } = await supabase
  .from('campaigns')
  .select('*')
  .eq('workspace_id', user.current_workspace_id)
  .eq('name', '20251029-IAI-test 9')
  .order('created_at', { ascending: true });

console.log(`Found ${duplicates?.length || 0} campaigns named "20251029-IAI-test 9"\n`);

if (!duplicates || duplicates.length === 0) {
  console.log('❌ No campaigns found');
  process.exit(0);
}

for (const campaign of duplicates) {
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('count')
    .eq('campaign_id', campaign.id);
  
  const count = prospects?.[0]?.count || 0;
  
  console.log(`📊 Campaign ID: ${campaign.id}`);
  console.log(`   Name: ${campaign.name}`);
  console.log(`   Status: ${campaign.status}`);
  console.log(`   Prospects: ${count}`);
  console.log(`   Created: ${new Date(campaign.created_at).toLocaleString()}`);
  console.log(`   Updated: ${new Date(campaign.updated_at).toLocaleString()}`);
  
  if (count === 0) {
    console.log(`   🗑️  EMPTY - Should delete or rename`);
  } else {
    console.log(`   ✅ HAS PROSPECTS - This is the one to use!`);
  }
  console.log();
}

// Find the empty one and rename it
const emptyOnes = [];
const goodOnes = [];

for (const campaign of duplicates) {
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('id')
    .eq('campaign_id', campaign.id);
  
  if (!prospects || prospects.length === 0) {
    emptyOnes.push(campaign);
  } else {
    goodOnes.push(campaign);
  }
}

console.log(`\n📋 SUMMARY:`);
console.log(`Good campaigns: ${goodOnes.length}`);
console.log(`Empty campaigns: ${emptyOnes.length}\n`);

if (emptyOnes.length > 0) {
  console.log('🗑️  DELETING EMPTY CAMPAIGNS...\n');
  
  for (const empty of emptyOnes) {
    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', empty.id);
    
    if (error) {
      console.error(`❌ Error deleting ${empty.id}:`, error);
    } else {
      console.log(`✅ Deleted empty campaign: ${empty.id}`);
    }
  }
}

if (goodOnes.length > 0) {
  console.log(`\n✅ CAMPAIGN TO USE FOR DEMO:`);
  console.log(`Campaign ID: ${goodOnes[0].id}`);
  console.log(`Name: ${goodOnes[0].name}`);
  
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', goodOnes[0].id);
  
  console.log(`Prospects: ${prospects?.length || 0}\n`);
  
  if (prospects && prospects.length > 0) {
    console.log('Ready to message:');
    prospects.forEach(p => {
      console.log(`  - ${p.first_name} ${p.last_name} (${p.status})`);
    });
  }
}

console.log('\n🎯 Now refresh SAM and look for: "20251029-IAI-test 9"');
console.log('   It should now be the only one with that name.');
