const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrateToDB() {
  const wsId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

  // Get the 19 + 17 prospect batches
  const sessions = [
    '5c86a789-a926-4d79-8120-cc3e76939d75', // 19 prospects
    '0d0ddfff-e00e-4984-9784-2b8fd2a2c7c1'  // 17 prospects
  ];

  console.log('⚡ Migrating BLL prospects to workspace_prospects...\n');

  for (const sessionId of sessions) {
    const { data: prospects } = await supabase
      .from('prospect_approval_data')
      .select('*')
      .eq('workspace_id', wsId)
      .eq('session_id', sessionId)
      .eq('approval_status', 'pending');

    console.log(`Session ${sessionId.substring(0, 8)}: ${prospects.length} prospects`);

    let inserted = 0;
    let skipped = 0;

    for (const p of prospects) {
      // Check if already exists
      const { data: existing } = await supabase
        .from('workspace_prospects')
        .select('id')
        .eq('workspace_id', wsId)
        .eq('first_name', p.contact?.firstName || p.name?.split(' ')[0])
        .eq('last_name', p.contact?.lastName || p.name?.split(' ').slice(1).join(' '))
        .single();

      if (existing) {
        skipped++;
        continue;
      }

      // Insert into workspace_prospects
      const { error } = await supabase
        .from('workspace_prospects')
        .insert({
          workspace_id: wsId,
          first_name: p.contact?.firstName || p.name?.split(' ')[0] || 'Unknown',
          last_name: p.contact?.lastName || p.name?.split(' ').slice(1).join(' ') || 'Unknown',
          email: p.contact?.email || null,
          company: p.company?.name || 'Unknown',
          title: p.title || null,
          linkedin_url: p.contact?.linkedin_url || null,
          status: 'pending_approval',
          source: p.source || 'prospect_approval',
          enrichment_score: p.enrichment_score || null
        });

      if (error) {
        console.log(`  ❌ Error inserting ${p.name}: ${error.message}`);
      } else {
        inserted++;
      }
    }

    console.log(`  ✅ Inserted: ${inserted}, Skipped (existing): ${skipped}\n`);
  }

  console.log('\n✅ MIGRATION COMPLETE');
  console.log('These prospects should now appear in Prospect Database');
  console.log('Status: pending_approval (ready to approve)');
}

migrateToDB().catch(console.error);
