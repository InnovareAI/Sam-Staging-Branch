#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get user
const { data: user } = await supabase
  .from('users')
  .select('id')
  .eq('email', 'tl@innovareai.com')
  .single();

// Get most recent campaign
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name, campaign_type, type, status, created_at')
  .eq('created_by', user.id)
  .order('created_at', { ascending: false })
  .limit(5);

console.log('\n📋 Your Recent Campaigns:\n');
campaigns.forEach((c, i) => {
  console.log(`${i + 1}. ${c.name}`);
  console.log(`   campaign_type: ${c.campaign_type || '(null)'}`);
  console.log(`   type: ${c.type || '(null)'}`);
  console.log(`   status: ${c.status}`);
  console.log(`   created: ${new Date(c.created_at).toLocaleString()}\n`);
});

console.log('💡 For connector campaigns (LinkedIn CRs), campaign_type should be "connector"');
console.log('   If it\'s null or "multi_channel", it will use execute-direct instead of execute-live\n');
