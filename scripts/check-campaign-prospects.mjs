#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const SUPABASE_URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const SERVICE_ROLE_KEY = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const campaignName = process.argv[2] || "20251025-IAI-test 03";

const { data: campaign } = await supabase
  .from('campaigns')
  .select('id')
  .eq('name', campaignName)
  .single();

if (!campaign) {
  console.log('Campaign not found');
  process.exit(1);
}

const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('campaign_id', campaign.id);

console.log(`\nProspects in campaign "${campaignName}":\n`);
prospects.forEach(p => {
  console.log(`Name: ${p.first_name} ${p.last_name}`);
  console.log(`LinkedIn URL: ${p.linkedin_url || 'MISSING'}`);
  console.log(`Company: ${p.company_name}`);
  console.log('');
});
