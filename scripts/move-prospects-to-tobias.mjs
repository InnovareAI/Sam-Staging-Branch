#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Charissa's workspace (IA4)
const charissaWorkspace = '7f0341da-88db-476b-ae0a-fc0da5b70861';
const tobiasWorkspace = '85e80099-12f9-491a-a0a1-ad48d086a9f0';
const tobiasCampaign = '9fcfcab0-7007-4628-b49b-1636ba5f781f'; // Campaign with CR message

const testedNames = [
  'Martin Redmond', 'David Pisarek', 'John P. Perkins', 'Vinci Ravindran',
  'Simon Sokol', 'Paul Landry', 'Reid Hoffman', 'Sean Meister', 'Mark Poppen',
  'Erik McBain', 'ZAKAR HOSSAIN', 'Maca Atencio', 'Russ Jarman Price',
  'Emmett Cooper', 'Zachary Schmidt', 'Ben Nevile'
];

console.log('\n🔍 Finding untouched prospects in Charissa\'s campaigns...\n');

// Find Charissa's campaigns
const { data: charissaCampaigns } = await supabase
  .from('campaigns')
  .select('id, campaign_name')
  .eq('workspace_id', charissaWorkspace)
  .limit(20);

console.log(`Found ${charissaCampaigns?.length || 0} Charissa campaigns\n`);

// Collect prospects from all campaigns
let allProspects = [];
for (const campaign of charissaCampaigns || []) {
  const { data } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', campaign.id)
    .eq('status', 'pending')
    .is('contacted_at', null)
    .limit(50);

  if (data && data.length > 0) {
    console.log(`  ${campaign.campaign_name || 'Unnamed'}: ${data.length} pending`);
    allProspects.push(...data);
  }
}

console.log(`\nTotal prospects found: ${allProspects.length}`);

// Filter to untouched prospects with valid data
const untouched = allProspects.filter(p => {
  const fullName = `${p.first_name} ${p.last_name}`;
  return !testedNames.includes(fullName) &&
         !testedNames.includes(p.first_name) &&
         p.linkedin_url &&
         p.first_name &&
         p.last_name;
}).slice(0, 3);

if (untouched.length === 0) {
  console.log('\n❌ No untouched prospects found\n');
  process.exit(1);
}

console.log(`\n📋 Moving ${untouched.length} prospects to Tobias IA7:\n`);
untouched.forEach(p => {
  console.log(`  - ${p.first_name} ${p.last_name} (${p.company_name || 'N/A'})`);
});

// Move them to Tobias campaign
let moved = 0;
for (const prospect of untouched) {
  const { error } = await supabase
    .from('campaign_prospects')
    .update({ campaign_id: tobiasCampaign })
    .eq('id', prospect.id);

  if (error) {
    console.error(`\n❌ Error moving ${prospect.first_name}: ${error.message}`);
  } else {
    console.log(`✅ Moved ${prospect.first_name} ${prospect.last_name}`);
    moved++;
  }
}

console.log(`\n✅ Successfully moved ${moved} prospects to Tobias campaign\n`);
console.log(`Campaign ID: ${tobiasCampaign}`);
console.log(`Workspace ID: ${tobiasWorkspace}\n`);
