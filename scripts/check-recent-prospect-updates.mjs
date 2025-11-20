import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRecentUpdates() {
  console.log('🔍 Checking recent prospect updates in last 5 minutes...\n');

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  // Check prospects updated recently
  const { data: prospects, error } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, status, updated_at, campaign_id, campaigns(name)')
    .gte('updated_at', fiveMinutesAgo)
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  if (!prospects || prospects.length === 0) {
    console.log('❌ No prospect updates in last 5 minutes');
    return;
  }

  console.log(`✅ Found ${prospects.length} prospect updates:\n`);

  prospects.forEach(p => {
    console.log(`  - ${p.first_name} ${p.last_name}`);
    console.log(`    Status: ${p.status}`);
    console.log(`    Campaign: ${p.campaigns?.name || p.campaign_id}`);
    console.log(`    Updated: ${new Date(p.updated_at).toLocaleString()}`);
    console.log();
  });
}

checkRecentUpdates().catch(console.error);
