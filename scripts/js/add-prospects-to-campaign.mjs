#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🚀 Adding approved prospects to campaign...\n');

// 1. Get campaign
const { data: campaign } = await supabase
  .from('campaigns')
  .select('id, workspace_id, name')
  .eq('name', '20251029-IAI-test 4')
  .single();

if (!campaign) {
  console.error('❌ Campaign not found');
  process.exit(1);
}

console.log('✅ Found campaign:', campaign.name);
console.log('   ID:', campaign.id);

// 2. Get approved prospects
const { data: approved } = await supabase
  .from('prospect_approval_data')
  .select('prospect_id')
  .eq('approval_status', 'approved');

console.log('✅ Found', approved.length, 'approved prospects\n');

// 3. Call the API endpoint
const prospectIds = approved.map(p => p.prospect_id);
console.log('📤 Sending request with prospect_ids:', prospectIds);

const response = await fetch('http://localhost:3000/api/campaigns/add-approved-prospects', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    campaign_id: campaign.id,
    workspace_id: campaign.workspace_id,
    prospect_ids: prospectIds
  })
});

const result = await response.json();
console.log('\n📊 Result:', JSON.stringify(result, null, 2));
