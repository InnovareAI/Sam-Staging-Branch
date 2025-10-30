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

async function testUnipile() {
  // Get campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', CAMPAIGN_ID)
    .single();
  
  console.log('Campaign:', campaign.name);
  console.log('Created by:', campaign.created_by);
  console.log('Workspace:', campaign.workspace_id);
  
  // Get LinkedIn account
  const { data: linkedinAccount } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', campaign.workspace_id)
    .eq('user_id', campaign.created_by)
    .eq('account_type', 'linkedin')
    .eq('connection_status', 'connected')
    .single();
  
  if (!linkedinAccount) {
    console.log('\n❌ No LinkedIn account found');
    return;
  }
  
  console.log('\n✅ LinkedIn account found:');
  console.log('  Name:', linkedinAccount.account_name);
  console.log('  Unipile ID:', linkedinAccount.unipile_account_id);
  
  // Test Unipile API
  const unipileUrl = `https://${process.env.UNIPILE_DSN}/api/v1/accounts/${linkedinAccount.unipile_account_id}`;
  console.log('\n🔍 Testing Unipile API:');
  console.log('  URL:', unipileUrl);
  
  try {
    const response = await fetch(unipileUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': process.env.UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });
    
    console.log('  Status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('\n✅ Unipile account data:');
      console.log('  ID:', data.id);
      console.log('  Status:', data.status);
      console.log('  Sources:', data.sources?.length || 0);
      
      if (data.sources) {
        data.sources.forEach((source, i) => {
          console.log(`  Source ${i + 1}:`, source.id, '-', source.status);
        });
      }
      
      const activeSource = data.sources?.find(s => s.status === 'OK');
      if (activeSource) {
        console.log('\n✅ Active source found:', activeSource.id);
      } else {
        console.log('\n❌ No active sources');
      }
    } else {
      const text = await response.text();
      console.log('  Error:', text);
    }
  } catch (error) {
    console.log('  ❌ Fetch error:', error.message);
  }
}

testUnipile().catch(console.error);
