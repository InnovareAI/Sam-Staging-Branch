#!/usr/bin/env node
/**
 * DIRECT CR EXECUTION - Bypass all polling/N8N complexity
 * Sends connection requests immediately via Unipile API
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

async function main() {
  console.log('🚀 DIRECT CR EXECUTION\n');

  // 1. Get most recent campaign
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, workspace_id, created_by, connection_message, message_templates')
    .order('created_at', { ascending: false })
    .limit(1);

  const campaign = campaigns?.[0];
  if (!campaign) {
    console.error('❌ No campaign found');
    process.exit(1);
  }

  console.log('📊 Campaign:', campaign.name);
  console.log('🆔 Campaign ID:', campaign.id);

  // 2. Get campaign creator's LinkedIn account
  const { data: account } = await supabase
    .from('workspace_accounts')
    .select('unipile_account_id, account_name')
    .eq('workspace_id', campaign.workspace_id)
    .eq('user_id', campaign.created_by)
    .eq('account_type', 'linkedin')
    .eq('is_active', true)
    .single();

  if (!account) {
    console.error('❌ No active LinkedIn account found for workspace');
    process.exit(1);
  }

  console.log('✅ LinkedIn Account:', account.account_name);
  console.log('🆔 Unipile Account ID:', account.unipile_account_id);

  // 3. Get pending prospects
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, linkedin_url, company_name, title')
    .eq('campaign_id', campaign.id)
    .in('status', ['pending', 'approved', 'ready_to_message'])
    .not('linkedin_url', 'is', null)
    .is('contacted_at', null)
    .order('created_at', { ascending: true })
    .limit(10);

  if (!prospects || prospects.length === 0) {
    console.log('⚠️  No pending prospects to send');
    process.exit(0);
  }

  console.log(`\n📝 Found ${prospects.length} prospects to send:\n`);

  // 4. Get connection request message
  const crMessage = campaign.connection_message ||
    campaign.message_templates?.connection_request ||
    'Hi {first_name}, I\'d like to connect!';

  // 5. Send CRs via Unipile
  let sent = 0;
  let failed = 0;

  for (const prospect of prospects) {
    console.log(`\n🎯 Processing: ${prospect.first_name || '[NO NAME]'} ${prospect.last_name || ''}`);
    console.log(`   LinkedIn: ${prospect.linkedin_url}`);

    // Personalize message
    const personalizedMessage = crMessage
      .replace(/\{first_name\}/gi, prospect.first_name || '')
      .replace(/\{last_name\}/gi, prospect.last_name || '')
      .replace(/\{company\}/gi, prospect.company_name || '')
      .replace(/\{title\}/gi, prospect.title || '');

    console.log(`   Message: ${personalizedMessage.substring(0, 80)}...`);

    try {
      // STEP 1: Get LinkedIn profile to retrieve provider_id
      const linkedinUsername = prospect.linkedin_url.split('/in/')[1]?.replace('/', '') || prospect.linkedin_url;
      const profileUrl = `https://${UNIPILE_DSN}/api/v1/users/${linkedinUsername}?account_id=${account.unipile_account_id}`;

      console.log('   🔍 STEP 1: Fetching profile...');
      console.log('   📍 Profile URL:', profileUrl);

      const profileResponse = await fetch(profileUrl, {
        method: 'GET',
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Accept': 'application/json'
        }
      });

      if (!profileResponse.ok) {
        const errorText = await profileResponse.text();
        console.error('   ❌ Profile fetch failed:', profileResponse.status, errorText);
        throw new Error(`Profile fetch failed: ${profileResponse.status}`);
      }

      const profileData = await profileResponse.json();
      console.log('   ✅ Profile retrieved, provider_id:', profileData.provider_id);

      // STEP 2: Send invitation using provider_id
      const inviteUrl = `https://${UNIPILE_DSN}/api/v1/users/invite`;
      const requestBody = {
        provider_id: profileData.provider_id,
        account_id: account.unipile_account_id,
        message: personalizedMessage
      };

      if (prospect.email) {
        requestBody.user_email = prospect.email;
      }

      console.log('   🚀 STEP 2: Sending invitation...');
      console.log('   📍 Invite URL:', inviteUrl);
      console.log('   📦 Request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(inviteUrl, {
        method: 'POST',
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('   📡 Response status:', response.status, response.statusText);

      const result = await response.json();
      console.log('   📦 Response body:', JSON.stringify(result, null, 2));

      if (response.ok) {
        console.log('   ✅ CR SENT!');

        // Update prospect status
        await supabase
          .from('campaign_prospects')
          .update({
            status: 'connection_requested',
            contacted_at: new Date().toISOString(),
            personalization_data: {
              unipile_message_id: result.object?.id || result.id || 'unknown',
              sent_via: 'direct-execution',
              sent_at: new Date().toISOString()
            }
          })
          .eq('id', prospect.id);

        sent++;
      } else {
        console.error('   ❌ FAILED (HTTP', response.status, '):', result.message || result.error || 'Unknown error');

        // Update with error
        await supabase
          .from('campaign_prospects')
          .update({
            status: 'failed',
            personalization_data: {
              error: result.message || result.error || 'Unknown error',
              failed_at: new Date().toISOString()
            }
          })
          .eq('id', prospect.id);

        failed++;
      }

      // Rate limit: wait 2 seconds between sends
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error('   ❌ ERROR:', error.message);
      console.error('   🔍 Full error:', error);
      console.error('   📍 URL used:', `https://${UNIPILE_DSN}/api/v1/messaging/messages`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ EXECUTION COMPLETE');
  console.log(`📊 Sent: ${sent}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('='.repeat(60));
}

main().catch(console.error);
