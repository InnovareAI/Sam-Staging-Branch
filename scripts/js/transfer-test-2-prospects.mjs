#!/usr/bin/env node
/**
 * Transfer approved prospects from test 2 session to test 2 campaign
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

const SESSION_ID = '23a9c931-4d04-4ea7-829c-22ea88a83d3e'; // test 2 session
const CAMPAIGN_ID = '05f25030-7282-40a9-a651-c9e52325f546'; // test 2 campaign
const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

async function transferProspects() {
  console.log('🔄 TRANSFERRING APPROVED PROSPECTS - TEST 2\n');
  console.log('='.repeat(70));
  
  // Get approved prospects
  const { data: approvedProspects } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('session_id', SESSION_ID)
    .eq('approval_status', 'approved');
  
  console.log(`\nFound ${approvedProspects?.length || 0} approved prospects\n`);
  
  if (!approvedProspects || approvedProspects.length === 0) {
    console.log('❌ No approved prospects to transfer');
    return;
  }
  
  // Transform and insert
  const campaignProspects = approvedProspects.map(prospect => {
    const contact = prospect.contact || {};
    const linkedinUrl = contact.linkedin_url || contact.linkedinUrl || prospect.linkedin_url;
    
    // Extract name from LinkedIn URL if needed
    let firstName = 'Unknown';
    let lastName = 'User';
    
    if (prospect.name) {
      const nameParts = prospect.name.split(' ');
      firstName = nameParts[0] || 'Unknown';
      lastName = nameParts.slice(1).join(' ') || 'User';
    } else if (linkedinUrl) {
      const match = linkedinUrl.match(/\/in\/([^\/\?]+)/);
      if (match) {
        const urlName = match[1].split('-');
        firstName = urlName[0] || 'Unknown';
        lastName = urlName.slice(1).join('-') || 'User';
      }
    }
    
    return {
      campaign_id: CAMPAIGN_ID,
      workspace_id: WORKSPACE_ID,
      first_name: firstName,
      last_name: lastName,
      email: contact.email || null,
      company_name: prospect.company?.name || '',
      linkedin_url: linkedinUrl,
      title: prospect.title || '',
      location: prospect.location || null,
      industry: prospect.company?.industry || 'Not specified',
      status: 'approved',
      personalization_data: {
        source: 'approval_session',
        session_id: SESSION_ID,
        approved_at: new Date().toISOString()
      }
    };
  });
  
  console.log('Transferring prospects:');
  campaignProspects.forEach((p, i) => {
    console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
    console.log(`   LinkedIn: ${p.linkedin_url}`);
    console.log(`   Title: ${p.title}`);
    console.log(`   Company: ${p.company_name}`);
  });
  
  const { data: inserted, error } = await supabase
    .from('campaign_prospects')
    .insert(campaignProspects)
    .select();
  
  if (error) {
    console.error('\n❌ Error:', error);
  } else {
    console.log(`\n✅ Successfully transferred ${inserted.length} prospects to campaign`);
    console.log('\nCampaign is now ready to execute!');
  }
  
  console.log('\n' + '='.repeat(70));
}

transferProspects().catch(console.error);
