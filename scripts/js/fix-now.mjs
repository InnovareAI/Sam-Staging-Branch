#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('⚡ EMERGENCY FIX - Adding prospects to latest campaign NOW\n');

const { data: user } = await supabase.from('users').select('*').eq('email', 'tl@innovareai.com').single();
const { data: campaign } = await supabase.from('campaigns').select('*').eq('workspace_id', user.current_workspace_id).order('created_at', { ascending: false }).limit(1).single();

console.log(`Campaign: ${campaign.name}`);

// Create 5 test prospects with LinkedIn URLs
const prospects = [
  { first: 'Test', last: 'Prospect 1', linkedin: 'https://linkedin.com/in/test1' },
  { first: 'Test', last: 'Prospect 2', linkedin: 'https://linkedin.com/in/test2' },
  { first: 'Test', last: 'Prospect 3', linkedin: 'https://linkedin.com/in/test3' },
  { first: 'Test', last: 'Prospect 4', linkedin: 'https://linkedin.com/in/test4' },
  { first: 'Test', last: 'Prospect 5', linkedin: 'https://linkedin.com/in/test5' }
].map(p => ({
  campaign_id: campaign.id,
  workspace_id: campaign.workspace_id,
  first_name: p.first,
  last_name: p.last,
  linkedin_url: p.linkedin,
  email: `${p.last.toLowerCase().replace(' ', '')}@test.com`,
  company_name: 'Test Company',
  title: 'Test Title',
  status: 'approved',
  added_by_unipile_account: null
}));

const { data, error } = await supabase.from('campaign_prospects').insert(prospects).select();

if (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}

console.log(`\n✅ Added ${data.length} prospects to campaign!`);
console.log('\n🚀 NOW EXECUTE THE CAMPAIGN - Should see "5 prospects ready"\n');
