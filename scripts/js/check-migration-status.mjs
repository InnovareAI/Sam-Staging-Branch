#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMigrationStatus() {
  console.log('🔍 Checking if migration 013 is applied...\n');

  try {
    // Try to fetch a row with the new columns
    const { data, error } = await supabase
      .from('send_queue')
      .select('id, campaign_id, prospect_id, message_type, requires_connection, status, scheduled_for')
      .limit(1);

    if (error) {
      if (error.message.includes('column') && (error.message.includes('message_type') || error.message.includes('requires_connection'))) {
        console.log('❌ Migration NOT applied - new columns do not exist\n');
        console.log('📋 NEXT STEPS:\n');
        console.log('1. Open Supabase SQL Editor:');
        console.log('   https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/editor\n');
        console.log('2. Copy and paste contents of:');
        console.log('   sql/migrations/013-add-message-type-to-send-queue.sql\n');
        console.log('3. Execute the migration\n');
        console.log('4. Re-run this script to verify\n');
      } else {
        console.log('⚠️  Unexpected error:', error.message);
      }
    } else {
      console.log('✅ Migration ALREADY applied!\n');
      console.log('New columns exist:');
      console.log('   ✓ message_type VARCHAR(50)');
      console.log('   ✓ requires_connection BOOLEAN\n');

      if (data && data.length > 0) {
        console.log('Sample row from send_queue:');
        console.log(JSON.stringify(data[0], null, 2));
        console.log('');
      } else {
        console.log('No rows in send_queue table yet.\n');
      }

      console.log('🚀 Ready to test! Create a new campaign to verify all 6 messages are queued.\n');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkMigrationStatus();
