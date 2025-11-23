#!/usr/bin/env node

/**
 * Check if CR and follow-up messages are being stored in database
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMessageStorage() {
  console.log('🔍 Checking Message Storage System\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. Check campaign_prospects table schema
  const { data: prospect, error: prospectError } = await supabase
    .from('campaign_prospects')
    .select('*')
    .limit(1)
    .single();

  if (prospect) {
    console.log('📋 campaign_prospects table columns:');
    const columns = Object.keys(prospect);
    columns.forEach(col => {
      const hasMessage = col.toLowerCase().includes('message') ||
                        col.toLowerCase().includes('conversation') ||
                        col.toLowerCase().includes('history');
      console.log(`   ${hasMessage ? '🔸' : '  '} ${col}`);
    });
    console.log('');
  }

  // 2. Check if there's a separate messages/conversations table
  console.log('🔍 Checking for conversation/message tables...\n');

  const tables = [
    'prospect_messages',
    'conversation_history',
    'campaign_messages',
    'linkedin_messages',
    'message_history',
    'conversations'
  ];

  for (const tableName of tables) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (!error) {
      console.log(`✅ Found table: ${tableName}`);
      if (data && data.length > 0) {
        console.log(`   Columns:`, Object.keys(data[0]).join(', '));
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 Current State Analysis');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 3. Check sent queue for message content
  const { data: queueItems } = await supabase
    .from('send_queue')
    .select('id, message, status, sent_at')
    .eq('status', 'sent')
    .limit(3);

  if (queueItems && queueItems.length > 0) {
    console.log('✅ send_queue stores messages:');
    queueItems.forEach((item, i) => {
      console.log(`\n   ${i + 1}. Message: "${item.message.substring(0, 100)}..."`);
      console.log(`      Sent: ${new Date(item.sent_at).toLocaleString()}`);
    });
  } else {
    console.log('❌ No sent messages found in send_queue');
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🎯 FINDINGS & REQUIRED FIXES');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('1. Message Storage:');
  console.log('   ❓ Are CR messages being saved to prospect records?');
  console.log('   ❓ Is there a message history table?\n');

  console.log('2. Acceptance Detection:');
  console.log('   📝 poll-accepted-connections cron exists');
  console.log('   ❓ Does it update prospect status?\n');

  console.log('3. Follow-up Scheduling:');
  console.log('   ❓ Are follow-ups auto-scheduled when CR accepted?');
  console.log('   ❓ Is there a follow-up queue/schedule?\n');
}

checkMessageStorage().catch(console.error);
