#!/usr/bin/env node
/**
 * Fix campaign test 2 by transferring its approved prospects
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

const SESSION_ID = 'c8a7c1ab-1e0b-4b19-8d0b-ec3b9d872f74'; // test 2 session
const CAMPAIGN_ID = '05f25030-7282-40a9-a651-c9e52325f546'; // test 2 campaign
const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

async function transferProspects() {
  console.log('🔄 Transferring prospects for campaign test 2\n');

  // Get approved prospects from the session
  const { data: approvedProspects } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('session_id', SESSION_ID)
    .eq('approval_status', 'approved');

  console.log(`Found ${approvedProspects?.length || 0} approved prospects\n`);

  if (!approvedProspects || approvedProspects.length === 0) {
    console.log('No approved prospects to transfer');
    return;
  }

  // Transform and insert
  const campaignProspects = approvedProspects.map(prospect => {
    const contact = prospect.contact || {};
    const linkedinUrl = contact.linkedin_url || contact.linkedinUrl || prospect.linkedin_url || null;

    let firstName = contact.firstName || 'Unknown';
    let lastName = contact.lastName || 'User';

    if (linkedinUrl && (!contact.firstName || !contact.lastName)) {
      const match = linkedinUrl.match(/\/in\/([^\/\?]+)/);
      if (match) {
        const urlName = match[1].split('-');
        if (!contact.firstName && urlName.length > 0) firstName = urlName[0];
        if (!contact.lastName && urlName.length > 1) lastName = urlName.slice(1).join('-');
      }
    }

    return {
      campaign_id: CAMPAIGN_ID,
      workspace_id: WORKSPACE_ID,
      first_name: firstName,
      last_name: lastName,
      email: contact.email || null,
      company_name: prospect.company?.name || contact.company || '',
      linkedin_url: linkedinUrl,
      title: prospect.title || contact.title || '',
      location: prospect.location || null,
      industry: 'Not specified',
      status: 'approved',
      personalization_data: {
        source: 'approval_session',
        session_id: SESSION_ID,
        approved_at: new Date().toISOString()
      }
    };
  });

  const { data: inserted, error } = await supabase
    .from('campaign_prospects')
    .insert(campaignProspects)
    .select();

  if (error) {
    console.error('❌ Error:', error);
  } else {
    console.log(`✅ Transferred ${inserted.length} prospects to campaign`);
  }
}

transferProspects().catch(console.error);
