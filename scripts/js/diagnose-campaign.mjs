#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get most recent campaign for tvonlinz
const { data: user } = await supabase
  .from('users')
  .select('id')
  .eq('email', 'tl@innovareai.com')
  .single();

const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name, created_at, workspace_id')
  .eq('created_by', user.id)
  .order('created_at', { ascending: false })
  .limit(1);

const campaign = campaigns?.[0];
if (!campaign) {
  console.log('❌ No campaigns found for tl@innovareai.com');
  process.exit(1);
}

console.log(`📋 Campaign: ${campaign.name}`);
console.log(`   ID: ${campaign.id}\n`);

// Check prospects
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, status, linkedin_url, linkedin_user_id, added_by')
  .eq('campaign_id', campaign.id);

console.log(`Total prospects: ${prospects?.length || 0}\n`);

if (!prospects || prospects.length === 0) {
  console.log('❌ No prospects added to campaign yet');
  console.log('\n💡 Next steps:');
  console.log('   1. Use SAM AI to find prospects');
  console.log('   2. Approve prospects in prospect-approval');
  console.log('   3. Add to campaign via "Add Approved Prospects"');
  process.exit(0);
}

// Group by status
const byStatus = prospects.reduce((acc, p) => {
  acc[p.status] = (acc[p.status] || 0) + 1;
  return acc;
}, {});

console.log('Prospect statuses:');
Object.entries(byStatus).forEach(([status, count]) => {
  console.log(`   ${status}: ${count}`);
});

// Check LinkedIn URLs
const withLinkedIn = prospects.filter(p => p.linkedin_url || p.linkedin_user_id);
console.log(`\n✅ With LinkedIn: ${withLinkedIn.length}/${prospects.length}`);

// Check ownership
const ownedByUser = prospects.filter(p => p.added_by === user.id);
console.log(`✅ Owned by you: ${ownedByUser.length}/${prospects.length}`);

// Check executable
const executable = prospects.filter(p =>
  (p.linkedin_url || p.linkedin_user_id) &&
  ['pending', 'approved', 'ready_to_message'].includes(p.status) &&
  p.added_by === user.id
);

console.log(`✅ Executable: ${executable.length}/${prospects.length}\n`);

if (executable.length === 0) {
  console.log('❌ Why no prospects are executable:\n');

  const withoutLinkedIn = prospects.filter(p => !p.linkedin_url && !p.linkedin_user_id);
  if (withoutLinkedIn.length > 0) {
    console.log(`   ⚠️  ${withoutLinkedIn.length} missing LinkedIn URLs`);
  }

  const wrongStatus = prospects.filter(p =>
    !['pending', 'approved', 'ready_to_message'].includes(p.status)
  );
  if (wrongStatus.length > 0) {
    console.log(`   ⚠️  ${wrongStatus.length} have wrong status (need: pending/approved/ready_to_message)`);
  }

  const notOwned = prospects.filter(p => p.added_by !== user.id);
  if (notOwned.length > 0) {
    console.log(`   ⚠️  ${notOwned.length} not owned by you (TOS compliance blocking)`);
  }
} else {
  console.log(`✅ ${executable.length} prospects ready to execute!`);
  console.log('\nExecutable prospects:');
  executable.forEach(p => {
    console.log(`   - ${p.first_name} ${p.last_name} (${p.status})`);
  });
}
