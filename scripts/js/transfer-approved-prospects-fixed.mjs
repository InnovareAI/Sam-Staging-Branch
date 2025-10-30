#!/usr/bin/env node
/**
 * Transfer approved prospects from approval session to campaign (FIXED)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SESSION_ID = 'c4d58d37-0a98-449b-a5a6-fb400558d4f7';
const CAMPAIGN_ID = 'f593e05c-aff8-4fd6-b2fc-a0e1685b14c1';
const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

async function transferProspects() {
  console.log('🔄 TRANSFERRING APPROVED PROSPECTS TO CAMPAIGN\n');
  console.log('='.repeat(70));

  // Get campaign details
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', CAMPAIGN_ID)
    .single();

  console.log('Campaign:');
  console.log(`   Name: ${campaign.name}`);
  console.log(`   ID: ${campaign.id}`);

  // Get approved prospects from session
  const { data: approvedProspects } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('session_id', SESSION_ID)
    .eq('approval_status', 'approved');

  console.log(`\n📊 Found ${approvedProspects?.length || 0} approved prospects\n`);

  if (!approvedProspects || approvedProspects.length === 0) {
    console.log('❌ No approved prospects to transfer');
    return;
  }

  // Transform and insert into campaign_prospects
  let successCount = 0;
  let errorCount = 0;

  for (const prospect of approvedProspects) {
    const contact = prospect.contact || {};
    
    // Extract LinkedIn URL from various possible locations
    const linkedinUrl = contact.linkedin_url || 
                        contact.linkedinUrl || 
                        contact.linkedin || 
                        contact.profile_url;

    // Extract name from LinkedIn URL if firstName/lastName missing
    let firstName = contact.firstName || 'Unknown';
    let lastName = contact.lastName || 'User';
    
    if (linkedinUrl && (!contact.firstName || !contact.lastName)) {
      // Try to extract from LinkedIn URL: /in/firstname-lastname
      const match = linkedinUrl.match(/\/in\/([^\/\?]+)/);
      if (match) {
        const urlName = match[1].split('-');
        if (!contact.firstName && urlName.length > 0) {
          firstName = urlName[0];
        }
        if (!contact.lastName && urlName.length > 1) {
          lastName = urlName.slice(1).join('-');
        }
      }
    }

    console.log(`Processing: ${firstName} ${lastName}`);
    console.log(`   LinkedIn: ${linkedinUrl || '❌ MISSING'}`);

    if (!linkedinUrl) {
      console.log('   ⚠️  Skipping - no LinkedIn URL');
      errorCount++;
      continue;
    }

    // Create campaign prospect record (without created_by)
    const prospectData = {
      campaign_id: CAMPAIGN_ID,
      workspace_id: WORKSPACE_ID,
      first_name: firstName,
      last_name: lastName,  // Required field
      email: contact.email || null,
      linkedin_url: linkedinUrl,
      title: contact.title || contact.headline || null,
      company_name: contact.company || contact.companyName || null,
      status: 'approved',
      personalization_data: {
        ...contact,
        source: 'approval_session',
        session_id: SESSION_ID,
        approval_data_id: prospect.id
      }
    };

    const { error } = await supabase
      .from('campaign_prospects')
      .insert(prospectData);

    if (error) {
      console.log(`   ❌ Error: ${error.message}`);
      errorCount++;
    } else {
      console.log('   ✅ Added to campaign');
      successCount++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('✅ TRANSFER COMPLETE');
  console.log('='.repeat(70));
  console.log(`\n   Successfully transferred: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`\n   Campaign "${campaign.name}" now has ${successCount} prospects ready`);
  console.log('\n' + '='.repeat(70));
}

transferProspects().catch(console.error);
