#!/usr/bin/env node

/**
 * Fix stuck prospects - approve them and transfer to campaign
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SESSION_ID = 'c4a1adf4-ffc3-493b-b7d9-f549318236b5';
const CAMPAIGN_ID = '3c984824-5561-4ba5-8b08-f34af2a00e27';
const CAMPAIGN_NAME = '20251109-CLI-CSV Upload';
const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
const USER_ID = 'f6885ff3-deef-4781-8721-93011c990b1b';

async function fixStuckProspects() {
  console.log('\n🔧 Fixing stuck prospects...\n');
  console.log(`Session: ${SESSION_ID.substring(0, 8)}...`);
  console.log(`Campaign: ${CAMPAIGN_NAME}`);
  console.log(`Campaign ID: ${CAMPAIGN_ID.substring(0, 8)}...\n`);

  // Step 1: Get all prospects from the session
  const { data: prospects, error: prospectsError } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('session_id', SESSION_ID);

  if (prospectsError) {
    console.error('❌ Error fetching prospects:', prospectsError.message);
    return;
  }

  console.log(`📋 Found ${prospects.length} prospects in session\n`);

  // Step 2: Create approval decisions for all prospects
  console.log('✅ Creating approval decisions...\n');

  for (const prospect of prospects) {
    // Check if decision already exists
    const { data: existingDecision } = await supabase
      .from('prospect_approval_decisions')
      .select('id')
      .eq('session_id', SESSION_ID)
      .eq('prospect_id', prospect.prospect_id)
      .single();

    if (existingDecision) {
      console.log(`   ⏭️  Already approved: ${prospect.name}`);
      continue;
    }

    // Create approval decision
    const { error: decisionError } = await supabase
      .from('prospect_approval_decisions')
      .insert({
        session_id: SESSION_ID,
        prospect_id: prospect.prospect_id,
        decision: 'approved',
        reason: 'Bulk approved by admin script',
        decided_by: USER_ID,
        decided_at: new Date().toISOString()
      });

    if (decisionError) {
      console.error(`   ❌ Error approving ${prospect.name}:`, decisionError.message);
    } else {
      console.log(`   ✅ Approved: ${prospect.name}`);
    }
  }

  // Step 3: Update session approved_count
  const { error: sessionError } = await supabase
    .from('prospect_approval_sessions')
    .update({
      approved_count: prospects.length,
      pending_count: 0
    })
    .eq('id', SESSION_ID);

  if (sessionError) {
    console.error('❌ Error updating session:', sessionError.message);
  } else {
    console.log(`\n✅ Updated session: ${prospects.length} approved, 0 pending\n`);
  }

  // Check if prospects already transferred
  const { count: existingCount } = await supabase
    .from('campaign_prospects')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', CAMPAIGN_ID);

  if (existingCount >= prospects.length) {
    console.log(`\n✅ Prospects already transferred (${existingCount} in campaign)\n`);
    console.log('🎉 Done! Refresh the Data Approval screen to see prospects marked as approved.\n');
    return;
  }

  // Step 4: Transform and transfer to campaign_prospects
  console.log('💾 Transferring to campaign_prospects...\n');

  const campaignProspects = prospects.map(prospect => {
    const contact = prospect.contact || {};
    const linkedinUrl = contact.linkedin_url || contact.linkedinUrl || prospect.linkedin_url || null;

    // Extract names
    let firstName = contact.firstName || prospect.first_name || 'Unknown';
    let lastName = contact.lastName || prospect.last_name || 'User';

    if (linkedinUrl && (!contact.firstName || !contact.lastName)) {
      const match = linkedinUrl.match(/\/in\/([^\/\?]+)/);
      if (match) {
        const urlName = match[1].split('-');
        if (urlName.length > 0) firstName = urlName[0];
        if (urlName.length > 1) lastName = urlName.slice(1).join('-');
      }
    }

    return {
      campaign_id: CAMPAIGN_ID,
      workspace_id: WORKSPACE_ID,
      first_name: firstName,
      last_name: lastName,
      email: contact.email || null,
      company_name: prospect.company?.name || contact.company || contact.companyName || '',
      linkedin_url: linkedinUrl,
      title: prospect.title || contact.title || contact.headline || '',
      location: prospect.location || contact.location || null,
      industry: prospect.company?.industry?.[0] || 'Not specified',
      status: 'approved',
      notes: null,
      personalization_data: {
        source: 'admin_fix_script',
        session_id: SESSION_ID,
        approval_data_id: prospect.id,
        transferred_at: new Date().toISOString()
      }
    };
  });

  const { data: inserted, error: insertError } = await supabase
    .from('campaign_prospects')
    .insert(campaignProspects)
    .select();

  if (insertError) {
    console.error('❌ Error inserting prospects:', insertError.message);
    console.error('Details:', insertError);
    return;
  }

  console.log(`✅ Transferred ${inserted.length} prospects to campaign!\n`);

  // Show sample
  console.log('📋 Sample prospects:');
  inserted.slice(0, 5).forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.first_name} ${p.last_name} - ${p.company_name}`);
    if (p.linkedin_url) console.log(`      ${p.linkedin_url}`);
  });

  if (inserted.length > 5) {
    console.log(`   ... and ${inserted.length - 5} more\n`);
  }

  // Verify campaign prospect count
  const { count } = await supabase
    .from('campaign_prospects')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', CAMPAIGN_ID);

  console.log(`\n✅ Campaign now has ${count} total prospects`);
  console.log(`\n🎉 Done! Refresh Campaign Hub to see the update.\n`);
}

fixStuckProspects();
