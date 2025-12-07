import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n🔧 AUTO-APPROVING STUCK PENDING PROSPECTS\n');

const threeDaysAgo = new Date();
threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

// Find prospects that should be auto-approved:
// 1. Status = 'pending' for >3 days
// 2. validation_status = 'valid'
// 3. Campaign is active
// 4. Has complete name fields

const { data: stuckProspects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, status, validation_status, created_at, campaign_id, campaigns(name, status)')
  .eq('status', 'pending')
  .eq('validation_status', 'valid')
  .lt('created_at', threeDaysAgo.toISOString())
  .not('first_name', 'is', null)
  .not('last_name', 'is', null);

// Filter by active campaigns
const eligibleProspects = (stuckProspects || []).filter(p => {
  return p.campaigns && p.campaigns.status === 'active';
});

console.log(`Found ${eligibleProspects.length} prospects eligible for auto-approval:\n`);

let autoApproved = 0;

for (const prospect of eligibleProspects) {
  const daysOld = Math.floor((Date.now() - new Date(prospect.created_at).getTime()) / (1000 * 60 * 60 * 24));
  const name = `${prospect.first_name} ${prospect.last_name}`;

  console.log(`${prospect.id.substring(0, 8)}... - ${name}`);
  console.log(`  Campaign: ${prospect.campaigns.name} (${prospect.campaigns.status})`);
  console.log(`  Days pending: ${daysOld}`);
  console.log(`  Action: Auto-approving...`);

  // Update to approved status
  const { error } = await supabase
    .from('campaign_prospects')
    .update({
      status: 'approved'
    })
    .eq('id', prospect.id);

  if (error) {
    console.log(`  ❌ Error: ${error.message}`);
  } else {
    console.log(`  ✅ Auto-approved`);
    autoApproved++;
  }

  console.log('');
}

console.log(`\n📊 SUMMARY: Auto-approved ${autoApproved} prospects`);

// Verify
if (autoApproved > 0) {
  console.log('\n✓ Verifying changes...\n');

  const { data: updated } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, status')
    .in('id', eligibleProspects.map(p => p.id));

  for (const p of updated || []) {
    console.log(`  ${p.id.substring(0, 8)}... - ${p.first_name} ${p.last_name}: ${p.status}`);
  }
}

console.log('\n');
