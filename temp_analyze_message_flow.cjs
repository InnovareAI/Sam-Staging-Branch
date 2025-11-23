#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyzeMessageFlow() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📧 MESSAGE STORAGE & FOLLOW-UP FLOW ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. Check campaign_messages table
  const { data: messages, error: msgError } = await supabase
    .from('campaign_messages')
    .select('*')
    .limit(5);

  console.log('1️⃣ campaign_messages Table:\n');
  if (msgError) {
    console.log(`   ❌ Error: ${msgError.message}\n`);
  } else if (!messages || messages.length === 0) {
    console.log('   ⚠️  Table exists but EMPTY - no messages stored!\n');
  } else {
    console.log(`   ✅ Found ${messages.length} messages\n`);
    console.log('   Schema:', Object.keys(messages[0]).join(', '));
    console.log('\n   Sample message:');
    console.log(`   - Prospect ID: ${messages[0].prospect_id || messages[0].campaign_prospect_id || 'N/A'}`);
    console.log(`   - Message Type: ${messages[0].message_type || messages[0].type || 'N/A'}`);
    console.log(`   - Content: "${(messages[0].message_content || messages[0].content || 'N/A').substring(0, 80)}..."`);
    console.log(`   - Sent At: ${messages[0].sent_at || messages[0].created_at || 'N/A'}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('2️⃣ Connection Request Storage Check:\n');

  // Get recent CRs from Irish's account
  const IRISH_UNIPILE_ID = 'ymtTx4xVQ6OVUFk83ctwtA';
  const { data: account } = await supabase
    .from('workspace_accounts')
    .select('id')
    .eq('unipile_account_id', IRISH_UNIPILE_ID)
    .single();

  if (account) {
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id')
      .eq('linkedin_account_id', account.id);

    const campaignIds = campaigns?.map(c => c.id) || [];

    // Check if any CRs are in campaign_messages
    if (campaignIds.length > 0) {
      const { data: storedCRs } = await supabase
        .from('campaign_messages')
        .select('*')
        .in('campaign_id', campaignIds)
        .eq('message_type', 'connection_request');

      console.log(`   Irish's campaigns: ${campaignIds.length}`);
      console.log(`   CRs in campaign_messages: ${storedCRs?.length || 0}`);

      if (!storedCRs || storedCRs.length === 0) {
        console.log('   ❌ ISSUE: CRs sent but NOT stored in campaign_messages!');
      } else {
        console.log('   ✅ CRs are being stored');
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('3️⃣ Acceptance Detection & Status Updates:\n');

  // Check if poll-accepted-connections is working
  const { data: acceptedProspects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('status', 'connected')
    .not('connection_accepted_at', 'is', null)
    .limit(5);

  console.log(`   Prospects with status='connected': ${acceptedProspects?.length || 0}`);

  if (acceptedProspects && acceptedProspects.length > 0) {
    console.log('   ✅ Acceptance detection is working\n');
    acceptedProspects.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.first_name} ${p.last_name}`);
      console.log(`      Contacted: ${new Date(p.contacted_at).toLocaleString()}`);
      console.log(`      Accepted: ${new Date(p.connection_accepted_at).toLocaleString()}`);
      console.log(`      Follow-up due: ${p.follow_up_due_at || 'NOT SET ❌'}`);
      console.log('');
    });
  } else {
    console.log('   ⚠️  No accepted connections found (or detection not working)\n');
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('4️⃣ Follow-up Scheduling:\n');

  // Check prospects with follow-ups scheduled
  const { data: followUpProspects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .not('follow_up_due_at', 'is', null)
    .eq('status', 'connected')
    .limit(5);

  console.log(`   Prospects with follow_up_due_at set: ${followUpProspects?.length || 0}`);

  if (followUpProspects && followUpProspects.length > 0) {
    console.log('   ✅ Follow-ups are being scheduled\n');
    followUpProspects.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.first_name} ${p.last_name}`);
      console.log(`      Due: ${new Date(p.follow_up_due_at).toLocaleString()}`);
      console.log(`      Sequence Index: ${p.follow_up_sequence_index || 0}`);
    });
  } else {
    console.log('   ❌ NO follow-ups scheduled for accepted connections!\n');
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📋 SUMMARY OF REQUIRED FIXES:');
  console.log('═══════════════════════════════════════════════════════════\n');

  const issues = [];

  if (!messages || messages.length === 0) {
    issues.push('❌ CR messages NOT being stored in campaign_messages table');
  }

  if (!acceptedProspects || acceptedProspects.length === 0) {
    issues.push('❌ Connection acceptance detection may not be working');
  } else {
    const missingFollowUps = acceptedProspects.filter(p => !p.follow_up_due_at);
    if (missingFollowUps.length > 0) {
      issues.push(`❌ ${missingFollowUps.length} accepted connections missing follow-up schedules`);
    }
  }

  if (issues.length === 0) {
    console.log('✅ All systems appear to be working!\n');
  } else {
    console.log('ISSUES FOUND:\n');
    issues.forEach((issue, i) => {
      console.log(`${i + 1}. ${issue}`);
    });
    console.log('');
  }
}

analyzeMessageFlow().catch(console.error);
