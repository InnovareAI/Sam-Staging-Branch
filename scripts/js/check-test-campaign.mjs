import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking your test campaign status...\n');

// Find most recent test campaign in InnovareAI workspace
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name, created_at, workspace_id, workspaces(name)')
  .ilike('name', '%test%')
  .order('created_at', { ascending: false })
  .limit(3);

console.log(`Found ${campaigns?.length || 0} test campaigns:\n`);

for (const c of campaigns || []) {
  console.log(`📊 ${c.name} (${c.workspaces.name})`);
  console.log(`   Created: ${new Date(c.created_at).toLocaleString()}\n`);

  // Get prospects for this campaign
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', c.id)
    .order('contacted_at', { ascending: false });

  console.log(`   Total prospects: ${prospects?.length || 0}\n`);

  for (const p of prospects || []) {
    const name = `${p.first_name || '?'} ${p.last_name || '?'}`.trim();
    console.log(`   ${name} at ${p.company_name || '?'}`);
    console.log(`      Status: ${p.status}`);
    console.log(`      LinkedIn: ${p.linkedin_url ? 'YES' : 'NO'}`);
    console.log(`      Contacted: ${p.contacted_at ? new Date(p.contacted_at).toLocaleTimeString() : 'NOT YET'}`);

    if (p.personalization_data?.error) {
      console.log(`      ❌ ERROR: ${p.personalization_data.error}`);
    }

    console.log('');
  }

  // Status breakdown
  const statusCounts = {};
  for (const p of prospects || []) {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
  }

  console.log('   Status breakdown:');
  for (const [status, count] of Object.entries(statusCounts)) {
    console.log(`      ${status}: ${count}`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}
