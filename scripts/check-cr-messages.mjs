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

const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, campaign_name, message_templates')
  .eq('workspace_id', 'babdcab8-1a78-4b2f-913e-6e9fd9821009')
  .order('created_at', { ascending: false })
  .limit(10);

console.log('\n📋 Campaign CR Messages:\n');

for (const campaign of campaigns) {
  console.log(`Campaign: ${campaign.campaign_name}`);
  console.log(`ID: ${campaign.id}`);
  
  if (campaign.message_templates?.connection_request) {
    console.log(`✅ CR Message: "${campaign.message_templates.connection_request}"`);
  } else {
    console.log('❌ NO CR MESSAGE CONFIGURED');
  }
  console.log('---\n');
}
