#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function simpleCheck() {
  const workspaceId = '96c03b38-a2f4-40de-9e16-43098599e1d4';
  
  console.log('\n🔍 SIMPLE CAMPAIGN CHECK\n');

  // Simulate exactly what the API does
  const response = await fetch(`${supabaseUrl}/rest/v1/campaigns?workspace_id=eq.${workspaceId}&select=id,name,status,created_at,prospects,sent,replied&order=created_at.desc&limit=5`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    }
  });

  const campaigns = await response.json();
  
  console.log(`Found ${campaigns.length} campaigns:\n`);
  campaigns.forEach((c, i) => {
    console.log(`${i + 1}. ${c.name}`);
    console.log(`   Status: ${c.status}`);
    console.log(`   ID: ${c.id}\n`);
  });

  // Now check if Mexico campaign is there
  const mexicoCampaign = campaigns.find(c => c.name.includes('Mexico'));
  if (mexicoCampaign) {
    console.log('✅ Mexico campaign FOUND in API response!');
    console.log(`   Status: ${mexicoCampaign.status}`);
  } else {
    console.log('❌ Mexico campaign NOT in API response');
  }
}

simpleCheck();
