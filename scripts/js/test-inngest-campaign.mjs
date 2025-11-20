#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const campaignId = '683f9214-8a3f-4015-98fe-aa3ae76a9ebe'; // Charissa's campaign
const workspaceId = 'f67f9d54-dc3d-42d7-8b73-2ad3c01beed4'; // IA4 workspace

console.log('🧪 Testing Inngest campaign trigger...\n');

async function testCampaign() {
  try {
    const response = await fetch('https://app.meet-sam.com/api/campaigns/linkedin/execute-inngest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `sb-access-token=${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        campaignId,
        workspaceId
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Campaign triggered successfully!');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('❌ Campaign trigger failed:');
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testCampaign().catch(console.error);
