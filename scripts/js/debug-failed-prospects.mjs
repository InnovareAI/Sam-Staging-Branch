#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const campaignId = '51803ded-bbc9-4564-aefb-c6d11d69f17c';

console.log('🔍 Investigating failed prospects...\n');

// Get all prospects with status 'failed'
const { data: failed, error } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('campaign_id', campaignId)
  .eq('status', 'failed')
  .order('created_at', { ascending: false })
  .limit(10);

if (error) {
  console.error('Query error:', error);
  process.exit(1);
}

console.log(`Found ${failed?.length || 0} failed prospects\n`);

if (failed && failed.length > 0) {
  console.log('Showing first 10:\n');
  
  failed.forEach((p, i) => {
    console.log(`${i + 1}. ${p.first_name || 'Unknown'} ${p.last_name || 'Unknown'}`);
    console.log(`   ID: ${p.id}`);
    console.log(`   Status: ${p.status}`);
    console.log(`   LinkedIn: ${p.linkedin_url || 'MISSING'}`);
    
    if (p.error_message) {
      console.log(`   Error Message: ${p.error_message}`);
    }
    
    if (p.personalization_data) {
      const data = p.personalization_data;
      if (data.error) {
        console.log(`   Error (personalization_data): ${data.error}`);
      }
      if (data.unipile_error) {
        console.log(`   Unipile Error: ${data.unipile_error}`);
      }
    }
    
    console.log(`   Created: ${p.created_at}`);
    console.log(`   Contacted: ${p.contacted_at || 'Never'}`);
    console.log();
  });
}

// Check if there are actually any records with status 'failed'
const { count } = await supabase
  .from('campaign_prospects')
  .select('*', { count: 'exact', head: true })
  .eq('campaign_id', campaignId)
  .eq('status', 'failed');

console.log(`\nTotal failed count from database: ${count}`);
