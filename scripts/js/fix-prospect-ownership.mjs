#!/usr/bin/env node
/**
 * Fix prospect ownership for most recent campaign
 * Sets added_by to campaign creator
 */
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
  .select('id, name, created_by')
  .eq('created_by', user.id)
  .order('created_at', { ascending: false })
  .limit(1);

const campaign = campaigns?.[0];
console.log(`Fixing ownership for: ${campaign.name}`);

// Update all prospects in this campaign
const { data: updated, error } = await supabase
  .from('campaign_prospects')
  .update({ added_by: campaign.created_by })
  .eq('campaign_id', campaign.id)
  .is('added_by', null)
  .select();

if (error) {
  console.error('Error:', error);
} else {
  console.log(`✅ Updated ${updated?.length || 0} prospects`);
  console.log('   All prospects now owned by you!');
}
