import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n🔍 SEARCHING FOR PROSPECT e49405d2...\n');

// Search for prospect by partial ID
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('*')
  .order('created_at', { ascending: false });

const matches = prospects?.filter(p => p.id.startsWith('e49405d2')) || [];

if (matches.length > 0) {
  for (const prospect of matches) {
    const daysOld = Math.floor((Date.now() - new Date(prospect.created_at).getTime()) / (1000 * 60 * 60 * 24));

    console.log(`Found: ${prospect.id}`);
    console.log(`  Name: ${prospect.name || 'NULL'}`);
    console.log(`  Status: ${prospect.status}`);
    console.log(`  Approval Status: ${prospect.approval_status || 'NULL'}`);
    console.log(`  Created: ${new Date(prospect.created_at).toLocaleString()}`);
    console.log(`  Days old: ${daysOld}`);
    console.log(`  Campaign: ${prospect.campaign_id || 'NULL'}`);
    console.log(`  LinkedIn URL: ${prospect.linkedin_url || 'NULL'}`);
    console.log('');
  }
} else {
  console.log('No prospects found starting with e49405d2');
  console.log('\nLet me check all prospects >3 days old with any status...\n');

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const { data: oldProspects } = await supabase
    .from('campaign_prospects')
    .select('id, name, status, approval_status, created_at')
    .lt('created_at', threeDaysAgo.toISOString())
    .order('created_at', { ascending: true })
    .limit(10);

  console.log(`Found ${oldProspects?.length || 0} prospects >3 days old (showing first 10):\n`);

  for (const p of oldProspects || []) {
    const daysOld = Math.floor((Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24));
    console.log(`${p.id.substring(0, 8)}... - ${p.name || 'Unknown'} (${p.status}, ${daysOld}d old)`);
  }
}

console.log('\n');
