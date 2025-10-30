#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
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

const CAMPAIGN_ID = 'ade10177-afe6-4770-a64d-b4ac0928b66a';

async function testExecuteLiveApi() {
  console.log('🔍 Testing execute-live API endpoint directly\n');

  // Get campaign details
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('name, workspace_id, created_by')
    .eq('id', CAMPAIGN_ID)
    .single();

  console.log('Campaign:', campaign.name);
  console.log('Workspace:', campaign.workspace_id);
  console.log('Created by:', campaign.created_by);

  // Call the API endpoint
  console.log('\n📡 Calling /api/campaigns/linkedin/execute-live...\n');

  try {
    const response = await fetch('http://localhost:3000/api/campaigns/linkedin/execute-live', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-trigger': 'cron-pending-prospects'
      },
      body: JSON.stringify({
        campaignId: CAMPAIGN_ID,
        workspaceId: campaign.workspace_id
      })
    });

    console.log('Status:', response.status);

    const data = await response.json();
    console.log('\nResponse:');
    console.log(JSON.stringify(data, null, 2));

    if (data.success) {
      console.log('\n✅ Campaign execution started successfully!');
      console.log('Queued prospects:', data.details?.queuedProspects || 0);
    } else {
      console.log('\n❌ Campaign execution failed');
      console.log('Error:', data.error);
    }
  } catch (error) {
    console.log('❌ Fetch error:', error.message);
  }
}

testExecuteLiveApi().catch(console.error);
