#!/usr/bin/env node
/**
 * Queue prospects for Sebastian's campaign
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function queueSebastian() {
  console.log('Queuing prospects for Sebastian...\n');

  // Get campaign
  const { data: campaign, error: cError } = await supabase
    .from('campaigns')
    .select('id, name, linkedin_account_id, workspace_id, connection_message')
    .ilike('name', '%sebastian%')
    .single();

  if (cError || !campaign) {
    console.log('Error finding campaign:', cError?.message);
    return;
  }

  console.log('Campaign:', campaign.name);
  console.log('LinkedIn Account:', campaign.linkedin_account_id);
  console.log('Workspace:', campaign.workspace_id);

  // Get approved prospects
  const { data: prospects, error: pError } = await supabase
    .from('campaign_prospects')
    .select('id, linkedin_url, first_name, last_name')
    .eq('campaign_id', campaign.id)
    .eq('status', 'approved')
    .limit(20);

  if (pError) {
    console.log('Error fetching prospects:', pError.message);
    return;
  }

  console.log('\nApproved prospects found:', prospects?.length || 0);

  if (!prospects || prospects.length === 0) {
    console.log('No prospects to queue');
    return;
  }

  // Check existing queue
  const prospectIds = prospects.map(p => p.id);
  const { data: existing } = await supabase
    .from('send_queue')
    .select('prospect_id')
    .in('prospect_id', prospectIds);

  const existingSet = new Set((existing || []).map(e => e.prospect_id));
  const toQueue = prospects.filter(p => !existingSet.has(p.id));

  console.log('Already in queue:', existingSet.size);
  console.log('To queue:', toQueue.length);

  if (toQueue.length === 0) {
    console.log('All prospects already queued');
    return;
  }

  // Schedule starting now with 30-min intervals
  const now = new Date();
  const items = toQueue.map((p, i) => ({
    campaign_id: campaign.id,
    prospect_id: p.id,
    workspace_id: campaign.workspace_id,
    linkedin_account_id: campaign.linkedin_account_id,
    linkedin_profile_url: p.linkedin_url,
    message: campaign.connection_message || '',
    status: 'pending',
    scheduled_for: new Date(now.getTime() + i * 30 * 60 * 1000).toISOString(),
    created_at: now.toISOString()
  }));

  console.log('\nQueuing', items.length, 'prospects...');

  const { error } = await supabase.from('send_queue').insert(items);

  if (error) {
    console.log('Insert error:', error.message);
  } else {
    console.log('✅ Queued', items.length, 'prospects');
    console.log('   First scheduled:', items[0].scheduled_for);
    console.log('   Last scheduled:', items[items.length - 1].scheduled_for);
    console.log('\nProspects queued:');
    items.forEach(item => {
      const p = toQueue.find(x => x.id === item.prospect_id);
      console.log(`   - ${p?.first_name} ${p?.last_name}: ${item.scheduled_for}`);
    });
  }
}

queueSebastian().catch(console.error);
