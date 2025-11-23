#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanDuplicates() {
  const campaignId = 'cc452d62-c3a4-4d90-bfb9-19063f7a5d79';

  console.log('🧹 Cleaning duplicate prospects from Mexico Marketing campaign...\n');

  // 1. Get all prospects for this campaign
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, status, created_at')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true });

  if (!prospects || prospects.length === 0) {
    console.log('❌ No prospects found');
    return;
  }

  console.log(`Found ${prospects.length} prospects:\n`);
  prospects.forEach(p => {
    console.log(`  ${p.first_name} ${p.last_name} - ${p.status} - ${new Date(p.created_at).toLocaleTimeString()}`);
  });

  // 2. Group by name and find duplicates
  const groupedByName = {};
  prospects.forEach(p => {
    const key = `${p.first_name.trim()} ${p.last_name.trim()}`;
    if (!groupedByName[key]) {
      groupedByName[key] = [];
    }
    groupedByName[key].push(p);
  });

  // 3. Identify duplicates (keep the 'approved' one, or the first one if both same status)
  const toDelete = [];
  const toKeep = [];

  Object.entries(groupedByName).forEach(([name, group]) => {
    if (group.length > 1) {
      // Find the one to keep (prefer 'approved' status, then earliest)
      const approved = group.find(p => p.status === 'approved');
      const keeper = approved || group[0];
      toKeep.push(keeper);

      // Mark others for deletion
      group.forEach(p => {
        if (p.id !== keeper.id) {
          toDelete.push(p);
        }
      });

      console.log(`\n📋 ${name}:`);
      console.log(`   ✅ Keeping: ${keeper.status} (${keeper.id.substring(0, 8)}...)`);
      group.forEach(p => {
        if (p.id !== keeper.id) {
          console.log(`   ❌ Deleting: ${p.status} (${p.id.substring(0, 8)}...)`);
        }
      });
    } else {
      toKeep.push(group[0]);
    }
  });

  if (toDelete.length === 0) {
    console.log('\n✅ No duplicates found!');
    return;
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Keeping: ${toKeep.length} prospects`);
  console.log(`   Deleting: ${toDelete.length} duplicates\n`);

  const prospectIdsToDelete = toDelete.map(p => p.id);

  // 4. Delete queue messages for duplicate prospects
  console.log('🗑️  Deleting queue messages for duplicates...');
  const { error: queueDeleteError } = await supabase
    .from('send_queue')
    .delete()
    .in('prospect_id', prospectIdsToDelete);

  if (queueDeleteError) {
    console.error('❌ Failed to delete queue messages:', queueDeleteError);
    return;
  }

  console.log(`✅ Deleted queue messages for ${toDelete.length} duplicate prospects\n`);

  // 5. Delete duplicate prospects
  console.log('🗑️  Deleting duplicate prospects...');
  const { error: prospectDeleteError } = await supabase
    .from('campaign_prospects')
    .delete()
    .in('id', prospectIdsToDelete);

  if (prospectDeleteError) {
    console.error('❌ Failed to delete prospects:', prospectDeleteError);
    return;
  }

  console.log(`✅ Deleted ${toDelete.length} duplicate prospects\n`);

  // 6. Verify final state
  const { data: remainingProspects } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, status')
    .eq('campaign_id', campaignId);

  const { data: remainingQueue } = await supabase
    .from('send_queue')
    .select('message_type')
    .eq('campaign_id', campaignId);

  const queueByType = remainingQueue.reduce((acc, msg) => {
    acc[msg.message_type] = (acc[msg.message_type] || 0) + 1;
    return acc;
  }, {});

  console.log('📋 Final state:');
  console.log(`   Prospects: ${remainingProspects.length}`);
  remainingProspects.forEach(p => {
    console.log(`     - ${p.first_name} ${p.last_name} (${p.status})`);
  });

  console.log('\n   Queue messages:');
  Object.entries(queueByType).forEach(([type, count]) => {
    console.log(`     ${type}: ${count}`);
  });

  console.log('\n✅ Cleanup complete!');
}

cleanDuplicates();
