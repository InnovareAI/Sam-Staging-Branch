#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name')
  .order('created_at', { ascending: false })
  .limit(1);

const campaign = campaigns?.[0];

console.log('Campaign:', campaign?.name);

// Reset all failed prospects back to pending
const { data: updated } = await supabase
  .from('campaign_prospects')
  .update({ status: 'pending', contacted_at: null })
  .eq('campaign_id', campaign?.id)
  .eq('status', 'failed')
  .select();

console.log('✅ Reset', updated?.length || 0, 'prospects back to pending');

// Show all current prospects
const { data: all } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, status, linkedin_url')
  .eq('campaign_id', campaign?.id);

console.log('\nCurrent prospects:');
all?.forEach(p => console.log(`  - ${p.status}: ${p.linkedin_url}`));
