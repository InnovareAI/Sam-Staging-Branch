#!/usr/bin/env node

/**
 * Send LinkedIn connection requests DIRECTLY via Unipile API
 * Bypass N8N completely
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const CAMPAIGN_ID = '4cd9275f-b82d-47d6-a1d4-7207b992c4b7';
const UNIPILE_ACCOUNT_ID = 'MT39bAEDTJ6e_ZPY337UgQ'; // Michelle's LinkedIn

console.log('🚀 SENDING MESSAGES DIRECTLY VIA UNIPILE\n');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

// Get campaign and message template
const { data: campaign } = await supabase
  .from('campaigns')
  .select('*')
  .eq('id', CAMPAIGN_ID)
  .single();

console.log('Campaign:', campaign.name);
console.log('Message template:', campaign.message_templates?.connection_request || campaign.connection_message);
console.log('');

// Get prospects
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('campaign_id', CAMPAIGN_ID)
  .eq('status', 'queued_in_n8n')
  .limit(3); // Send to 3 prospects first

console.log(`Found ${prospects.length} prospects to message\n`);

const connectionMessage = campaign.message_templates?.connection_request || campaign.connection_message || 'Hi {first_name}, I would like to connect!';

for (const prospect of prospects) {
  console.log(`\n📤 Sending to: ${prospect.first_name} ${prospect.last_name}`);
  console.log(`   LinkedIn: ${prospect.linkedin_url}`);

  try {
    // Step 1: Extract username from LinkedIn URL
    const linkedinUsername = prospect.linkedin_url
      .replace(/https?:\/\/(www\.)?linkedin\.com\/in\//, '')
      .replace(/\/$/, '')
      .split('?')[0];

    console.log(`   Username: ${linkedinUsername}`);

    // Step 2: Personalize message
    const personalizedMessage = connectionMessage
      .replace(/{first_name}/g, prospect.first_name)
      .replace(/{last_name}/g, prospect.last_name)
      .replace(/{company_name}/g, prospect.company_name || 'your company');

    console.log(`   Message: "${personalizedMessage.substring(0, 50)}..."`);

    // Step 3: Send connection request via Unipile
    const unipileUrl = `https://${UNIPILE_DSN}/api/v1/users/invite`;

    const response = await fetch(unipileUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': UNIPILE_API_KEY
      },
      body: JSON.stringify({
        account_id: UNIPILE_ACCOUNT_ID,
        provider_id: linkedinUsername,
        message: personalizedMessage
      })
    });

    const result = await response.json();

    if (response.ok) {
      console.log(`   ✅ SENT! Response:`, result);

      // Update status in database
      await supabase
        .from('campaign_prospects')
        .update({
          status: 'connection_requested',
          contacted_at: new Date().toISOString(),
          personalization_data: {
            ...(prospect.personalization_data || {}),
            unipile_message_id: result.object?.id || result.id || 'unknown',
            sent_at: new Date().toISOString()
          }
        })
        .eq('id', prospect.id);

      console.log(`   ✅ Database updated`);
    } else {
      console.error(`   ❌ FAILED:`, result);

      // Update status to failed
      await supabase
        .from('campaign_prospects')
        .update({
          status: 'failed',
          personalization_data: {
            ...(prospect.personalization_data || {}),
            error: result.message || 'Unknown error',
            failed_at: new Date().toISOString()
          }
        })
        .eq('id', prospect.id);
    }

    // Wait 30 seconds between each (anti-bot)
    if (prospects.indexOf(prospect) < prospects.length - 1) {
      console.log(`   ⏳ Waiting 30 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 30000));
    }

  } catch (error) {
    console.error(`   ❌ ERROR:`, error.message);

    await supabase
      .from('campaign_prospects')
      .update({
        status: 'failed',
        personalization_data: {
          ...(prospect.personalization_data || {}),
          error: error.message,
          failed_at: new Date().toISOString()
        }
      })
      .eq('id', prospect.id);
  }
}

console.log('\n✅ DONE! Check LinkedIn sent invitations to verify.\n');
