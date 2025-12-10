#!/usr/bin/env node

/**
 * Transfer Asphericon prospects from approval session to campaign
 *
 * Problem: User uploaded 379 prospects but only 27 made it to the campaign
 * Solution: Transfer remaining approved prospects and add them to send queue
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

const SESSION_ID = 'd6df6e2b-aeef-42e6-bf40-a2903929dfed';
const CAMPAIGN_ID = 'd7ced167-e7e7-42f2-ba12-dc3bb2d29cfc';
const WORKSPACE_ID = 'c3100bea-82a6-4365-b159-6581f1be9be3';

async function main() {
  console.log('🚀 Starting prospect transfer...');

  // Step 1: Get all approved prospects from the session
  const { data: approvedProspects, error: fetchError } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('session_id', SESSION_ID)
    .eq('approval_status', 'approved');

  if (fetchError) {
    console.error('❌ Error fetching approved prospects:', fetchError);
    return;
  }

  console.log(`📊 Found ${approvedProspects.length} approved prospects in session`);

  // Step 2: Get existing prospects in campaign to avoid duplicates
  const { data: existingProspects } = await supabase
    .from('campaign_prospects')
    .select('linkedin_url')
    .eq('campaign_id', CAMPAIGN_ID);

  const existingUrls = new Set(existingProspects?.map(p => p.linkedin_url?.toLowerCase()) || []);
  console.log(`📊 Found ${existingUrls.size} existing prospects in campaign`);

  // Step 3: Filter out existing prospects
  const newProspects = approvedProspects.filter(p => {
    const linkedinUrl = p.contact?.linkedin_url || p.linkedin_url;
    return linkedinUrl && !existingUrls.has(linkedinUrl.toLowerCase());
  });

  console.log(`📊 ${newProspects.length} new prospects to transfer`);

  if (newProspects.length === 0) {
    console.log('✅ All prospects already in campaign');
    return;
  }

  // Step 4: Transform to campaign_prospects format
  const campaignProspects = newProspects.map(p => {
    const nameParts = p.name?.split(' ') || ['Unknown'];
    const firstName = nameParts[0] || 'Unknown';
    const lastName = nameParts.slice(1).join(' ') || '';
    const linkedinUrl = p.contact?.linkedin_url || p.linkedin_url;
    const linkedinUserId = p.linkedin_user_id || linkedinUrl?.match(/linkedin\.com\/in\/([^\/\?#]+)/)?.[1];

    let connectionDegreeStr = null;
    if (p.connection_degree === 1) connectionDegreeStr = '1st';
    else if (p.connection_degree === 2) connectionDegreeStr = '2nd';
    else if (p.connection_degree === 3) connectionDegreeStr = '3rd';

    return {
      campaign_id: CAMPAIGN_ID,
      workspace_id: WORKSPACE_ID,
      first_name: firstName,
      last_name: lastName,
      email: p.contact?.email || null,
      company_name: p.company?.name || '',
      title: p.title || '',
      location: p.location || null,
      linkedin_url: linkedinUrl,
      linkedin_user_id: linkedinUserId,
      connection_degree: connectionDegreeStr,
      status: 'pending', // Mark as pending for queue
      personalization_data: {
        source: 'manual_transfer',
        session_id: SESSION_ID,
        transferred_at: new Date().toISOString()
      }
    };
  });

  // Step 5: Insert in batches
  const BATCH_SIZE = 100;
  let inserted = 0;

  for (let i = 0; i < campaignProspects.length; i += BATCH_SIZE) {
    const batch = campaignProspects.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from('campaign_prospects')
      .insert(batch)
      .select('id');

    if (error) {
      console.error(`❌ Error inserting batch ${i / BATCH_SIZE + 1}:`, error);
    } else {
      inserted += data.length;
      console.log(`✅ Inserted batch ${i / BATCH_SIZE + 1}: ${data.length} prospects`);
    }
  }

  console.log(`\n✅ Total inserted: ${inserted} prospects`);

  // Step 6: Get campaign connection message
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('message_templates')
    .eq('id', CAMPAIGN_ID)
    .single();

  const connectionMessage = campaign?.message_templates?.connection_request || '';
  console.log(`📧 Connection message: ${connectionMessage.substring(0, 50)}...`);

  // Step 7: Get newly inserted prospects with IDs
  const { data: newlyInserted } = await supabase
    .from('campaign_prospects')
    .select('id, linkedin_url, first_name')
    .eq('campaign_id', CAMPAIGN_ID)
    .eq('status', 'pending');

  console.log(`📊 Found ${newlyInserted?.length || 0} pending prospects to queue`);

  // Step 8: Create send_queue entries with 2-minute spacing
  const now = new Date();
  const queueEntries = (newlyInserted || []).map((p, index) => {
    // Extract linkedin_user_id from URL if needed
    const linkedinUserId = p.linkedin_url?.match(/linkedin\.com\/in\/([^\/\?#]+)/)?.[1] || '';

    // Personalize message
    const personalizedMessage = connectionMessage.replace('{first_name}', p.first_name || 'there');

    // Schedule 2 minutes apart, starting from now
    const scheduledFor = new Date(now.getTime() + (index * 2 * 60 * 1000));

    return {
      campaign_id: CAMPAIGN_ID,
      prospect_id: p.id,
      linkedin_user_id: linkedinUserId,
      message: personalizedMessage,
      scheduled_for: scheduledFor.toISOString(),
      status: 'pending'
    };
  });

  // Step 9: Insert queue entries in batches
  let queueInserted = 0;
  for (let i = 0; i < queueEntries.length; i += BATCH_SIZE) {
    const batch = queueEntries.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from('send_queue')
      .insert(batch)
      .select('id');

    if (error) {
      console.error(`❌ Error inserting queue batch ${i / BATCH_SIZE + 1}:`, error);
    } else {
      queueInserted += data.length;
      console.log(`✅ Queued batch ${i / BATCH_SIZE + 1}: ${data.length} entries`);
    }
  }

  console.log(`\n✅ Total queued: ${queueInserted} entries`);
  console.log(`\n🎉 Transfer complete!`);
  console.log(`   - Prospects added: ${inserted}`);
  console.log(`   - Queue entries created: ${queueInserted}`);
  console.log(`   - First send: ${now.toISOString()}`);
  console.log(`   - Last send (estimated): ${new Date(now.getTime() + (queueEntries.length * 2 * 60 * 1000)).toISOString()}`);
}

main().catch(console.error);
