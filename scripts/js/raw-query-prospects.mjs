#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const campaignId = '51803ded-bbc9-4564-aefb-c6d11d69f17c';

// Raw query to see what's really there
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('id, status, first_name, last_name, linkedin_url, error_message')
  .eq('campaign_id', campaignId)
  .limit(50);

console.log('📊 All prospects in campaign:\n');

const byStatus = {};
prospects?.forEach(p => {
  if (!byStatus[p.status]) {
    byStatus[p.status] = [];
  }
  byStatus[p.status].push(p);
});

Object.entries(byStatus).forEach(([status, items]) => {
  console.log(`\n${status.toUpperCase()} (${items.length}):`);
  items.slice(0, 3).forEach(p => {
    console.log(`  - ${p.first_name || '?'} ${p.last_name || '?'}`);
    console.log(`    LinkedIn: ${p.linkedin_url ? 'Yes' : 'No'}`);
    if (p.error_message) {
      console.log(`    Error: ${p.error_message.substring(0, 60)}...`);
    }
  });
  if (items.length > 3) {
    console.log(`  ... and ${items.length - 3} more`);
  }
});
