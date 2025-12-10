import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

const CAMPAIGN_ID = 'd7ced167-e7e7-42f2-ba12-dc3bb2d29cfc';

async function main() {
  // Get all prospects
  const { data: prospects, error } = await supabase
    .from('campaign_prospects')
    .select('id, linkedin_url, first_name, last_name')
    .eq('campaign_id', CAMPAIGN_ID);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Total prospects: ${prospects.length}`);

  // Find duplicates
  const urlMap = new Map();
  const duplicateIds = [];

  prospects.forEach(p => {
    const url = (p.linkedin_url || '').toLowerCase();
    if (!url) return;

    if (urlMap.has(url)) {
      duplicateIds.push(p.id);
      console.log(`Duplicate: ${p.first_name} ${p.last_name} (${url})`);
    } else {
      urlMap.set(url, p.id);
    }
  });

  console.log(`\nUnique URLs: ${urlMap.size}`);
  console.log(`Duplicates found: ${duplicateIds.length}`);

  if (duplicateIds.length > 0) {
    console.log('\nDeleting duplicates...');

    // Delete duplicates from campaign_prospects
    const { error: deleteError } = await supabase
      .from('campaign_prospects')
      .delete()
      .in('id', duplicateIds);

    if (deleteError) {
      console.error('Delete error:', deleteError);
    } else {
      console.log(`✅ Deleted ${duplicateIds.length} duplicate prospects`);
    }

    // Delete corresponding queue entries
    const { error: queueError } = await supabase
      .from('send_queue')
      .delete()
      .in('prospect_id', duplicateIds);

    if (queueError) {
      console.error('Queue delete error:', queueError);
    } else {
      console.log(`✅ Deleted corresponding queue entries`);
    }
  }

  // Final count
  const { data: finalCount } = await supabase
    .from('campaign_prospects')
    .select('id')
    .eq('campaign_id', CAMPAIGN_ID);

  console.log(`\nFinal prospect count: ${finalCount?.length || 0}`);
}

main().catch(console.error);
