import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name, created_at')
  .eq('workspace_id', 'babdcab8-1a78-4b2f-913e-6e9fd9821009')
  .order('created_at', { ascending: false })
  .limit(1);

if (!campaigns || campaigns.length === 0) {
  console.log('No campaigns found');
  process.exit(0);
}

const campaign = campaigns[0];
console.log(`Latest campaign: ${campaign.name} (created ${campaign.created_at})\n`);

// Get its prospects
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('campaign_id', campaign.id)
  .limit(3);

console.log('Prospect data from campaign_prospects:');
prospects?.forEach((p, i) => {
  console.log(`\n#${i+1}: ${p.first_name || '(no name)'} ${p.last_name || ''}`);
  console.log(`  Company: ${p.company_name || 'N/A'}`);
  console.log(`  Title: ${p.title || 'N/A'}`);
  console.log(`  LinkedIn URL: ${p.linkedin_url || 'NULL ❌'}`);
  console.log(`  Status: ${p.status}`);
  console.log(`  Personalization data:`, p.personalization_data || {});
});
