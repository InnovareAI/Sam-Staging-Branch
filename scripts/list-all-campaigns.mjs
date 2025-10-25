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

// Get recent campaigns
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name, created_at, status, workspace_id')
  .order('created_at', { ascending: false })
  .limit(15);

console.log('\n📋 ALL RECENT CAMPAIGNS:\n');

for (const campaign of campaigns) {
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('linkedin_url')
    .eq('campaign_id', campaign.id);

  const withUrls = prospects?.filter(p => p.linkedin_url).length || 0;
  const total = prospects?.length || 0;

  console.log(`${campaign.name}`);
  console.log(`  Status: ${campaign.status}`);
  console.log(`  Prospects: ${withUrls}/${total} ready`);
  console.log(`  Created: ${new Date(campaign.created_at).toLocaleString()}`);
  console.log('');
}
