#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Only queue LinkedIn campaigns - Jennifer is email-only
const targetNames = ['Irish Maguad', 'Charissa Saniel', 'Michelle Gestuveo'];

console.log('🔧 QUEUEING APPROVED PROSPECTS FOR LINKEDIN CAMPAIGNS');
console.log('='.repeat(70));

let totalQueued = 0;

for (const name of targetNames) {
  console.log(`\n👤 ${name}:`);

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('name', name)
    .single();

  if (!workspace) {
    console.log('   Workspace not found');
    continue;
  }

  // Get active campaigns with their LinkedIn accounts and message templates
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
    .eq('status', 'active');

  for (const campaign of campaigns || []) {
    // Get approved prospects for this campaign that are NOT already in queue
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

    if (needsQueueing.length === 0) continue;

    console.log(`\n   📋 ${campaign.name}: ${needsQueueing.length} prospects to queue`);

    // Get CR message from campaign
    const crMessage = campaign.message_templates?.connection_request_message ||
                      campaign.message_templates?.connection_request ||
                      'Hi {first_name}, I noticed your work and would love to connect!';

    const linkedinAccount = campaign.workspace_accounts;
    if (!linkedinAccount?.unipile_account_id) {
      console.log(`      ⚠️  No LinkedIn account linked - skipping`);
      continue;
    }

    // Create queue entries with staggered scheduling (25 min apart)
    let scheduledTime = new Date();
    let queuedCount = 0;

    for (const prospect of needsQueueing) {
      scheduledTime = new Date(scheduledTime.getTime() + 25 * 60 * 1000);

      // Personalize message
      const personalizedMessage = crMessage
        .replace(/\{first_name\}/gi, prospect.first_name || '')
        .replace(/\{firstName\}/g, prospect.first_name || '')
        .replace(/\{\{first_name\}\}/gi, prospect.first_name || '')
        .replace(/\{\{firstName\}\}/g, prospect.first_name || '');

      // Get linkedin_user_id (from prospect or extract from URL)
      let linkedinUserId = prospect.linkedin_user_id;
      if (!linkedinUserId && prospect.linkedin_url) {
        const match = prospect.linkedin_url.match(/linkedin\.com\/in\/([^\/\?#]+)/);
        if (match) linkedinUserId = match[1];
      }

      if (!linkedinUserId) {
        console.log(`      ⚠️  ${prospect.first_name} - no LinkedIn ID, skipping`);
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

      if (error) {
        if (error.code === '23505') { // Duplicate
          console.log(`      ⚠️  ${prospect.first_name} - already queued`);
        } else {
          console.log(`      ❌ ${prospect.first_name} - error: ${error.message}`);
        }
      } else {
        queuedCount++;
      }
    }

    console.log(`      ✅ Queued ${queuedCount} prospects (25 min spacing)`);
    totalQueued += queuedCount;
  }
}

console.log('\n' + '='.repeat(70));
console.log(`📊 TOTAL QUEUED: ${totalQueued} prospects`);
console.log('\n⚠️  Note: Jennifer Fleming is EMAIL-ONLY - not included in LinkedIn queue');
console.log('='.repeat(70));
