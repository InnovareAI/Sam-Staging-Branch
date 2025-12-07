import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n🔍 CHECKING ALL PENDING PROSPECTS >3 DAYS\n');

const threeDaysAgo = new Date();
threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

const { data: pendingProspects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, status, validation_status, created_at, campaign_id, workspace_id')
  .eq('status', 'pending')
  .lt('created_at', threeDaysAgo.toISOString())
  .order('created_at', { ascending: true });

console.log(`Found ${pendingProspects?.length || 0} prospects stuck in 'pending' for >3 days:\n`);

for (const p of pendingProspects || []) {
  const daysOld = Math.floor((Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24));
  const name = `${p.first_name || 'Unknown'} ${p.last_name || ''}`.trim();

  console.log(`${p.id.substring(0, 8)}... - ${name}`);
  console.log(`  Status: ${p.status}`);
  console.log(`  Validation: ${p.validation_status || 'NULL'}`);
  console.log(`  Days pending: ${daysOld}`);
  console.log(`  Created: ${new Date(p.created_at).toLocaleString()}`);
  console.log(`  Campaign: ${p.campaign_id.substring(0, 8)}...`);
  console.log('');
}

// Check what campaigns these belong to
if (pendingProspects && pendingProspects.length > 0) {
  const campaignIds = [...new Set(pendingProspects.map(p => p.campaign_id))];

  console.log(`\nThese belong to ${campaignIds.length} campaign(s):\n`);

  for (const campaignId of campaignIds) {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('name, status, created_at')
      .eq('id', campaignId)
      .single();

    const count = pendingProspects.filter(p => p.campaign_id === campaignId).length;

    console.log(`  ${campaignId.substring(0, 8)}... - ${campaign?.name || 'Unknown'}`);
    console.log(`    Campaign status: ${campaign?.status || 'NULL'}`);
    console.log(`    Pending prospects: ${count}`);
    console.log(`    Created: ${campaign?.created_at ? new Date(campaign.created_at).toLocaleString() : 'NULL'}`);
    console.log('');
  }
}

console.log('\n💡 RECOMMENDATION:');
console.log('Prospects in "pending" status are waiting for approval.');
console.log('Options:');
console.log('  1. Auto-approve them (move to "approved" status)');
console.log('  2. Leave them pending (requires manual approval)');
console.log('  3. Mark campaign as needing attention');

console.log('\n');
