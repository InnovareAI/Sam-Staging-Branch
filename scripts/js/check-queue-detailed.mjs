#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkQueue() {
  try {
    const { data: queueItems, error } = await supabase
      .from('send_queue')
      .select(`
        id,
        campaign_id,
        prospect_id,
        linkedin_user_id,
        status,
        scheduled_for,
        sent_at,
        error_message,
        created_at,
        campaign_prospects!prospect_id (first_name, last_name)
      `)
      .order('scheduled_for', { ascending: true });

    if (error) {
      console.error('❌ Query error:', error);
      process.exit(1);
    }

    console.log('📋 SEND QUEUE ORDERED BY SCHEDULED_FOR:\n');
    console.log('Seq | Name                    | Scheduled        | Status  | Sent At          | Error');
    console.log('-'.repeat(110));

    queueItems.forEach((item, i) => {
      const prospect = item.campaign_prospects;
      const name = prospect ? `${prospect.first_name} ${prospect.last_name}` : 'Unknown';
      const scheduledFor = new Date(item.scheduled_for).toISOString().substring(0, 16);
      const sentAt = item.sent_at ? new Date(item.sent_at).toISOString().substring(0, 16) : 'NULL';
      const error = item.error_message || '-';
      
      console.log(
        `${(i + 1).toString().padEnd(3)} | ${name.padEnd(23)} | ${scheduledFor.padEnd(16)} | ${item.status.padEnd(7)} | ${sentAt.padEnd(16)} | ${error.substring(0, 35)}`
      );
    });

    console.log('\n🔍 KEY INSIGHT:');
    const firstFailed = queueItems.find(i => i.status === 'failed');
    if (firstFailed) {
      const prospect = firstFailed.campaign_prospects;
      console.log(`   First failure: ${prospect ? prospect.first_name + ' ' + prospect.last_name : 'Unknown'}`);
      console.log(`   Error: "${firstFailed.error_message}"`);
      console.log(`   Scheduled: ${firstFailed.scheduled_for}`);
    }

    const pending = queueItems.filter(i => i.status === 'pending');
    console.log(`\n   Pending messages: ${pending.length}`);
    pending.forEach(p => {
      const prospect = p.campaign_prospects;
      console.log(`      - ${prospect ? prospect.first_name + ' ' + prospect.last_name : 'Unknown'} (scheduled ${p.scheduled_for})`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkQueue();
