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

// Get all campaigns with prospects and CR messages
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, campaign_name, message_templates, workspace_id, status')
  .not('message_templates', 'is', null)
  .limit(20);

console.log('\n📋 Campaigns with CR messages and prospects:\n');

for (const campaign of campaigns) {
  if (!campaign.message_templates?.connection_request) continue;
  
  const { count } = await supabase
    .from('campaign_prospects')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaign.id)
    .eq('status', 'pending')
    .is('contacted_at', null);
  
  if (count > 0) {
    console.log(`✅ ${campaign.campaign_name || 'Unnamed'}`);
    console.log(`   Workspace: ${campaign.workspace_id}`);
    console.log(`   Campaign ID: ${campaign.id}`);
    console.log(`   ${count} pending prospects`);
    console.log(`   CR: "${campaign.message_templates.connection_request.substring(0, 80)}..."`);
    console.log('---\n');
  }
}
