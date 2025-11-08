const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function get25() {
  const wsId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

  const { data } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('workspace_id', wsId)
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('Checking recent approval records for ~25 prospects:\n');

  for (const r of data) {
    const hasMatch = r.total_count >= 20 && r.total_count <= 30;

    console.log(`ID: ${r.id}`);
    console.log(`Created: ${new Date(r.created_at).toLocaleString()}`);
    console.log(`Total: ${r.total_count}, Approved: ${r.approved_count || 0}`);
    console.log(`Status: ${r.status || 'pending'}`);

    if (hasMatch) {
      console.log('🎯 FOUND IT - This has ~25 prospects!');
      console.log(`\nTo see these in Prospect Database, they need to be in workspace_prospects table.`);
      console.log(`Approval ID: ${r.id}\n`);

      // Check if contacts field exists
      if (r.contacts) {
        console.log(`Contacts field exists with ${Array.isArray(r.contacts) ? r.contacts.length : 'unknown'} items`);
      }
      if (r.prospects) {
        console.log(`Prospects field exists with ${Array.isArray(r.prospects) ? r.prospects.length : 'unknown'} items`);
      }
      if (r.data) {
        console.log(`Data field exists`);
      }
    }
    console.log('---\n');
  }

  // Check workspace_prospects
  const { data: wsProspects } = await supabase
    .from('workspace_prospects')
    .select('id, first_name, last_name, status')
    .eq('workspace_id', wsId)
    .order('created_at', { ascending: false })
    .limit(30);

  console.log(`\nWorkspace has ${wsProspects?.length || 0} prospects in workspace_prospects table`);

  if (wsProspects && wsProspects.length > 0) {
    console.log('\nMost recent:');
    wsProspects.slice(0, 10).forEach((p, idx) => {
      console.log(`${idx + 1}. ${p.first_name} ${p.last_name} - ${p.status || 'no status'}`);
    });
  }
}

get25().catch(console.error);
