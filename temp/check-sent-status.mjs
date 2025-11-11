#!/usr/bin/env node

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

async function checkStatus() {
  console.log('📊 Checking Message Send Status\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });

  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('first_name, last_name, status, contacted_at, linkedin_url, personalization_data')
    .eq('campaign_id', CAMPAIGN_ID)
    .order('updated_at', { ascending: false });

  console.log('Total prospects:', prospects.length);
  console.log('');

  const statusGroups = {
    sent: [],
    queued: [],
    pending: [],
    failed: []
  };

  prospects.forEach(p => {
    if (p.status === 'connection_requested' || p.contacted_at) {
      statusGroups.sent.push(p);
    } else if (p.status === 'queued_in_n8n') {
      statusGroups.queued.push(p);
    } else if (p.status === 'pending') {
      statusGroups.pending.push(p);
    } else {
      statusGroups.failed.push(p);
    }
  });

  if (statusGroups.sent.length > 0) {
    console.log('✅ MESSAGES SENT:', statusGroups.sent.length);
    statusGroups.sent.forEach(p => {
      console.log(`   ✓ ${p.first_name} ${p.last_name}`);
      console.log(`     Sent at: ${new Date(p.contacted_at).toLocaleString()}`);
      console.log(`     URL: ${p.linkedin_url}`);
      console.log('');
    });
  }

  if (statusGroups.queued.length > 0) {
    console.log('⏳ QUEUED IN N8N:', statusGroups.queued.length);
    statusGroups.queued.forEach(p => {
      console.log(`   • ${p.first_name} ${p.last_name} - ${p.linkedin_url}`);
    });
    console.log('');
  }

  if (statusGroups.pending.length > 0) {
    console.log('⏸️  PENDING:', statusGroups.pending.length);
    statusGroups.pending.forEach(p => {
      console.log(`   - ${p.first_name} ${p.last_name}`);
    });
    console.log('');
  }

  if (statusGroups.failed.length > 0) {
    console.log('❌ FAILED:', statusGroups.failed.length);
    statusGroups.failed.forEach(p => {
      console.log(`   × ${p.first_name} ${p.last_name}`);
      if (p.personalization_data?.error) {
        console.log(`     Error: ${p.personalization_data.error}`);
      }
    });
    console.log('');
  }

  console.log('─'.repeat(60));
  console.log(`Total: ${statusGroups.sent.length} sent, ${statusGroups.queued.length} queued, ${statusGroups.pending.length} pending, ${statusGroups.failed.length} failed`);
}

checkStatus().catch(console.error);
