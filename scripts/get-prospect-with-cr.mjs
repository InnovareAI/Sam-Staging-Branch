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

// Get campaign with most prospects
const campaignId = '9fcfcab0-7007-4628-b49b-1636ba5f781f';

// Get campaign details
const { data: campaign } = await supabase
  .from('campaigns')
  .select('*')
  .eq('id', campaignId)
  .single();

console.log('\n📋 Campaign:', campaign.campaign_name || 'Unnamed');
console.log(`CR Message: "${campaign.message_templates.connection_request}"\n`);

// Get one prospect
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('campaign_id', campaignId)
  .eq('status', 'pending')
  .is('contacted_at', null)
  .limit(1);

const prospect = prospects[0];

console.log(`✅ Prospect: ${prospect.first_name} ${prospect.last_name}`);
console.log(`   Company: ${prospect.company_name}`);
console.log(`   Title: ${prospect.title}`);
console.log(`   LinkedIn: ${prospect.linkedin_url}`);
console.log(`\n📋 Will use this prospect with the actual CR message.\n`);
console.log(`Campaign ID: ${campaignId}`);
console.log(`Prospect ID: ${prospect.id}`);
console.log(`Workspace ID: ${campaign.workspace_id}`);
