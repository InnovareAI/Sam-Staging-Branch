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

// Find Charissa's workspace
const { data: users } = await supabase
  .from('users')
  .select('id, email')
  .ilike('email', '%charissa%');

console.log('\n👤 Charissa user:', users[0]);

const { data: memberships } = await supabase
  .from('workspace_members')
  .select('workspace_id')
  .eq('user_id', users[0].id);

console.log('\n🏢 Charissa workspaces:', memberships);

for (const membership of memberships) {
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, campaign_name, message_templates, status')
    .eq('workspace_id', membership.workspace_id)
    .limit(5);
  
  console.log(`\n📋 Campaigns for workspace ${membership.workspace_id}:`);
  
  for (const campaign of campaigns) {
    console.log(`\nCampaign: ${campaign.campaign_name}`);
    console.log(`Status: ${campaign.status}`);
    console.log(`ID: ${campaign.id}`);
    
    if (campaign.message_templates?.connection_request) {
      console.log(`✅ CR: "${campaign.message_templates.connection_request.substring(0, 100)}..."`);
      
      // Get prospect count
      const { count } = await supabase
        .from('campaign_prospects')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .eq('status', 'pending')
        .is('contacted_at', null);
      
      console.log(`   ${count} pending prospects`);
    }
  }
}
