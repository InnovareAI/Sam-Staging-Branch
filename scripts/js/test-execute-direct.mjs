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

const CAMPAIGN_ID = 'ade10177-afe6-4770-a64d-b4ac0928b66a';

async function testQuery() {
  console.log('Testing the same query the API uses...\n');
  
  const { data: prospects, error } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', CAMPAIGN_ID)
    .in('status', ['pending', 'approved', 'ready_to_message', 'follow_up_due'])
    .limit(1)
    .order('created_at', { ascending: true });
  
  console.log('Error:', error);
  console.log('Prospects found:', prospects?.length || 0);
  
  if (prospects && prospects.length > 0) {
    console.log('\nFirst prospect:');
    console.log('  Name:', prospects[0].first_name, prospects[0].last_name);
    console.log('  LinkedIn URL:', prospects[0].linkedin_url);
    console.log('  LinkedIn User ID:', prospects[0].linkedin_user_id);
    console.log('  Status:', prospects[0].status);
    console.log('  Contacted:', prospects[0].contacted_at);
  }
}

testQuery().catch(console.error);
