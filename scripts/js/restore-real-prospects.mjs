#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('⚡ RESTORING REAL APPROVED PROSPECTS\n');

// Get user and latest campaign
const { data: user } = await supabase.from('users').select('*').eq('email', 'tl@innovareai.com').single();
const { data: campaign } = await supabase.from('campaigns').select('*').eq('workspace_id', user.current_workspace_id).order('created_at', { ascending: false }).limit(1).single();

console.log(`Campaign: ${campaign.name}\n`);

// Get the first 5 REAL approved prospects from earlier sessions
const { data: approvedSessions } = await supabase
  .from('prospect_approval_sessions')
  .select('id')
  .eq('workspace_id', user.current_workspace_id)
  .gt('approved_count', 0)
  .order('created_at', { ascending: false})
  .limit(3);

if (!approvedSessions || approvedSessions.length === 0) {
  console.log('❌ No approved sessions found');
  process.exit(0);
}

const sessionIds = approvedSessions.map(s => s.id);

// Fetch REAL approved prospects
const { data: prospects } = await supabase
  .from('prospect_approval_data')
  .select('*')
  .in('session_id', sessionIds)
  .eq('approval_status', 'approved')
  .limit(5);

if (!prospects || prospects.length === 0) {
  console.log('❌ No approved prospects found');
  process.exit(0);
}

console.log(`Found ${prospects.length} real approved prospects:\n`);
prospects.forEach((p, i) => {
  console.log(`${i + 1}. ${p.name}`);
  console.log(`   LinkedIn: ${p.contact?.linkedin_url}\n`);
});

// Transform to campaign_prospects format
const campaignProspects = prospects.map(p => {
  const nameParts = (p.name || '').split(' ');
  return {
    campaign_id: campaign.id,
    workspace_id: campaign.workspace_id,
    first_name: nameParts[0] || '',
    last_name: nameParts.slice(1).join(' ') || '',
    email: p.contact?.email || null,
    company_name: p.company?.name || '',
    linkedin_url: p.contact?.linkedin_url || null,
    title: p.title || '',
    location: p.location || null,
    industry: p.company?.industry?.[0] || 'Not specified',
    status: 'approved',
    added_by_unipile_account: null,
    personalization_data: {
      source: 'restored_approved',
      prospect_id: p.prospect_id
    }
  };
});

// Delete test prospects first
await supabase.from('campaign_prospects').delete().eq('campaign_id', campaign.id).ilike('first_name', 'test%');

// Insert real prospects
const { data: inserted, error } = await supabase.from('campaign_prospects').insert(campaignProspects).select();

if (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}

console.log(`✅ Added ${inserted.length} REAL prospects with LinkedIn URLs!\n`);
inserted.forEach((p, i) => {
  console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
  console.log(`   LinkedIn: ${p.linkedin_url}\n`);
});

console.log('🚀 Execute campaign NOW - these are REAL LinkedIn profiles!\n');
