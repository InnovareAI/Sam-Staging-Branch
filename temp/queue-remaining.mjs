#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔧 QUEUEING ALL REMAINING APPROVED PROSPECTS');
console.log('='.repeat(70));

const targetNames = ['Irish Maguad', 'Charissa Saniel', 'Michelle Gestuveo'];
let totalQueued = 0;

for (const name of targetNames) {
  console.log(`\n👤 ${name}:`);

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('name', name)
    .single();

  if (!workspace) continue;

  // Get ALL active campaigns with LinkedIn accounts
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select(`
      id,
      name,
      linkedin_account_id,
      message_templates,
      workspace_accounts!linkedin_account_id (
        id,
        unipile_account_id
      )
    `)
    .eq('workspace_id', workspace.id)
    .eq('status', 'active')
    .not('linkedin_account_id', 'is', null);

  console.log(`   Active campaigns with LinkedIn: ${campaigns?.length || 0}`);

  for (const campaign of campaigns || []) {
    // Get ALL approved prospects for this campaign
    const { data: approved } = await supabase
      .from('campaign_prospects')
      .select('id, first_name, last_name, linkedin_url, linkedin_user_id')
      .eq('campaign_id', campaign.id)
      .eq('status', 'approved');

    if (!approved || approved.length === 0) continue;

    // Check which are already queued
    const approvedIds = approved.map(p => p.id);
    const { data: existingQueue } = await supabase
      .from('send_queue')
      .select('prospect_id')
      .in('prospect_id', approvedIds);

    const queuedIds = new Set(existingQueue?.map(q => q.prospect_id) || []);
    const needsQueueing = approved.filter(p => !queuedIds.has(p.id));

    if (needsQueueing.length === 0) {
      console.log(`   📋 ${campaign.name}: All ${approved.length} already queued`);
      continue;
    }

    console.log(`   📋 ${campaign.name}: ${needsQueueing.length} of ${approved.length} need queueing`);

    const linkedinAccount = campaign.workspace_accounts;
    if (!linkedinAccount?.unipile_account_id) {
      console.log(`      ⚠️  No LinkedIn account - skipping`);
      continue;
    }

    // Get CR message
    const crMessage = campaign.message_templates?.connection_request_message ||
                      campaign.message_templates?.connection_request ||
                      'Hi {first_name}, I noticed your work and would love to connect!';

    // Queue with staggered scheduling (25 min apart)
    let scheduledTime = new Date();
    let queuedCount = 0;
    let skipped = 0;

    for (const prospect of needsQueueing) {
      scheduledTime = new Date(scheduledTime.getTime() + 25 * 60 * 1000);

      // Personalize
      const personalizedMessage = crMessage
        .replace(/\{first_name\}/gi, prospect.first_name || '')
        .replace(/\{firstName\}/g, prospect.first_name || '')
        .replace(/\{\{first_name\}\}/gi, prospect.first_name || '')
        .replace(/\{\{firstName\}\}/g, prospect.first_name || '');

      // Get LinkedIn ID
      let linkedinUserId = prospect.linkedin_user_id;
      if (!linkedinUserId && prospect.linkedin_url) {
        const match = prospect.linkedin_url.match(/linkedin\.com\/in\/([^\/\?#]+)/);
        if (match) linkedinUserId = match[1];
      }

      if (!linkedinUserId) {
        skipped++;
        continue;
      }

      const { error } = await supabase
        .from('send_queue')
        .insert({
          campaign_id: campaign.id,
          prospect_id: prospect.id,
          linkedin_user_id: linkedinUserId,
          message: personalizedMessage,
          message_type: 'connection_request',
          scheduled_for: scheduledTime.toISOString(),
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (!error) {
        queuedCount++;
      }
    }

    console.log(`      ✅ Queued ${queuedCount}${skipped > 0 ? `, skipped ${skipped} (no LinkedIn ID)` : ''}`);
    totalQueued += queuedCount;
  }
}

// Final status
console.log('\n' + '='.repeat(70));
console.log(`📊 TOTAL NEWLY QUEUED: ${totalQueued}`);

// Show final queue counts
console.log('\n📋 FINAL QUEUE STATUS:');
for (const name of targetNames) {
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('name', name)
    .single();

  if (!workspace) continue;

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id')
    .eq('workspace_id', workspace.id)
    .eq('status', 'active');

  const campaignIds = campaigns?.map(c => c.id) || [];

  const { data: queue } = await supabase
    .from('send_queue')
    .select('status')
    .in('campaign_id', campaignIds);

  const byStatus = {};
  queue?.forEach(q => {
    byStatus[q.status] = (byStatus[q.status] || 0) + 1;
  });

  console.log(`   ${name}: ${JSON.stringify(byStatus)}`);
}

console.log('\n='.repeat(70));
