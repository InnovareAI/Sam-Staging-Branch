import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n🔍 FINDING ALL STUCK PROSPECTS (>3 days in transitional status)\n');

const threeDaysAgo = new Date();
threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

const { data: stuckProspects } = await supabase
  .from('campaign_prospects')
  .select('id, name, status, approval_status, created_at, workspace_id, campaign_id')
  .in('status', ['uploading', 'validating', 'processing'])
  .lt('created_at', threeDaysAgo.toISOString())
  .order('created_at', { ascending: true });

console.log(`Found ${stuckProspects?.length || 0} stuck prospects:\n`);

for (const prospect of stuckProspects || []) {
  const daysStuck = Math.floor((Date.now() - new Date(prospect.created_at).getTime()) / (1000 * 60 * 60 * 24));
  console.log(`${prospect.id.substring(0, 8)}... - ${prospect.name || 'Unknown'}`);
  console.log(`  Status: ${prospect.status}`);
  console.log(`  Approval: ${prospect.approval_status || 'NULL'}`);
  console.log(`  Stuck for: ${daysStuck} days`);
  console.log(`  Created: ${new Date(prospect.created_at).toLocaleString()}`);
  console.log(`  Campaign: ${prospect.campaign_id?.substring(0, 8) || 'NULL'}`);
  console.log('');
}

console.log('\n');
