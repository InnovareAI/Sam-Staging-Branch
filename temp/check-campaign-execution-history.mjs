#!/usr/bin/env node

/**
 * Check if Mich's campaign has any execution history
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
const CAMPAIGN_ID = '4cd9275f-b82d-47d6-a1d4-7207b992c4b7';

async function checkExecutionHistory() {
  console.log('📋 Checking Campaign Execution History\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });

  // Check campaign status changes
  console.log('Step 1: Campaign Info...');
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', CAMPAIGN_ID)
    .single();

  console.log(`Campaign: ${campaign.name}`);
  console.log(`Status: ${campaign.status}`);
  console.log(`Campaign Type: ${campaign.campaign_type}`);
  console.log(`Created: ${new Date(campaign.created_at).toLocaleString()}`);
  console.log(`Updated: ${new Date(campaign.updated_at).toLocaleString()}`);

  // Check if any prospects changed from pending
  console.log('\nStep 2: Prospect Status Changes...');
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, status, contacted_at, personalization_data')
    .eq('campaign_id', CAMPAIGN_ID)
    .order('updated_at', { ascending: false });

  const statusCounts = {};
  prospects.forEach(p => {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
  });

  console.log('Prospect statuses:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  - ${status}: ${count}`);
  });

  const contacted = prospects.filter(p => p.contacted_at);
  if (contacted.length > 0) {
    console.log(`\n✅ ${contacted.length} prospects contacted:`);
    contacted.forEach(p => {
      console.log(`   - ${p.first_name} ${p.last_name} at ${new Date(p.contacted_at).toLocaleString()}`);
    });
  } else {
    console.log('\n⚠️  No prospects have been contacted yet!');
  }

  // Check for queued_in_n8n status
  const queued = prospects.filter(p => p.status === 'queued_in_n8n');
  if (queued.length > 0) {
    console.log(`\n📤 ${queued.length} prospects queued in N8N (pending execution)`);
  }

  // Check for error statuses
  const errored = prospects.filter(p => p.status === 'error' || p.status === 'failed');
  if (errored.length > 0) {
    console.log(`\n❌ ${errored.length} prospects with errors:`);
    errored.forEach(p => {
      console.log(`   - ${p.first_name} ${p.last_name}`);
      if (p.personalization_data?.error) {
        console.log(`     Error: ${p.personalization_data.error}`);
      }
    });
  }

  // Check N8N webhook payload if stored
  console.log('\nStep 3: Checking for N8N triggers...');
  const withN8nData = prospects.filter(p => p.personalization_data?.n8n_execution_key);
  if (withN8nData.length > 0) {
    console.log(`✅ ${withN8nData.length} prospects have N8N execution keys`);
    console.log('   (Campaign was triggered to N8N)');
  } else {
    console.log('❌ No N8N execution keys found');
    console.log('   (Campaign has never been triggered!)');
  }

  // Summary
  console.log('\n' + '─'.repeat(60));
  console.log('\n🔍 DIAGNOSIS:');

  if (contacted.length > 0) {
    console.log('✅ Campaign HAS executed - messages were sent');
  } else if (queued.length > 0) {
    console.log('⏳ Campaign is queued in N8N but not yet sent');
  } else if (withN8nData.length > 0) {
    console.log('⚠️  Campaign was triggered but N8N might have failed');
  } else {
    console.log('❌ Campaign has NEVER been executed!');
    console.log('\n💡 Solution: Mich needs to click "Execute Campaign" button in UI');
  }

  console.log('');
}

checkExecutionHistory().catch(console.error);
