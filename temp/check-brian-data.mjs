import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';

// Load env manually
const envContent = readFileSync('.env.local', 'utf-8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  }
});

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const workspaceId = 'aa1a214c-02f0-4f3a-8849-92c7a50ee4f7';

  // Check for existing drafts
  const { data: drafts, error: draftsError } = await supabase
    .from('reply_agent_drafts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('Existing drafts:', drafts?.length || 0);
  if (drafts?.length) {
    drafts.forEach(d => {
      console.log(`- Draft: ${d.id} | Prospect: ${d.prospect_name} | Status: ${d.status}`);
    });
  }

  // Check for campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, campaign_name, status')
    .eq('workspace_id', workspaceId);

  console.log('\nCampaigns:', campaigns?.length || 0);
  if (campaigns?.length) {
    campaigns.forEach(c => {
      console.log(`- Campaign: ${c.id} | ${c.campaign_name} | Status: ${c.status}`);
    });
  }

  // Check for prospects
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, company, status, linkedin_url, campaign_id')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\nProspects:', prospects?.length || 0);
  if (prospects?.length) {
    prospects.forEach(p => {
      console.log(`- ${p.first_name} ${p.last_name} | ${p.company} | Status: ${p.status}`);
    });
  }
}

main().catch(console.error);
