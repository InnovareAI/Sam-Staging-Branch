#!/usr/bin/env node

/**
 * Verify Campaign Message Storage
 * 
 * After creating a test campaign, run this to verify:
 * 1. Campaign exists in database
 * 2. Messages are stored correctly
 * 3. Timestamps are set
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyCampaignMessages(campaignId) {
  console.log('\n🔍 CAMPAIGN MESSAGE VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (!campaignId) {
    console.log('📋 Getting most recent campaign...\n');
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ Failed to fetch campaigns:', error.message);
      return;
    }

    if (!campaigns || campaigns.length === 0) {
      console.log('⚠️  No campaigns found in database');
      return;
    }

    console.log('Recent campaigns:');
    campaigns.forEach((c, i) => {
      console.log(`${i + 1}. ${c.name} (${c.id}) - Created: ${new Date(c.created_at).toLocaleString()}`);
    });

    campaignId = campaigns[0].id;
    console.log(`\n✅ Using most recent: ${campaigns[0].name}\n`);
  }

  // Get campaign details
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (campaignError) {
    console.error('❌ Failed to fetch campaign:', campaignError.message);
    return;
  }

  if (!campaign) {
    console.log('⚠️  Campaign not found:', campaignId);
    return;
  }

  console.log('📊 CAMPAIGN DETAILS');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`Name: ${campaign.name}`);
  console.log(`Type: ${campaign.campaign_type}`);
  console.log(`Status: ${campaign.status}`);
  console.log(`Created: ${new Date(campaign.created_at).toLocaleString()}`);
  console.log(`Updated: ${new Date(campaign.updated_at).toLocaleString()}`);
  console.log('');

  // Check all possible message storage locations
  console.log('📝 MESSAGE STORAGE VERIFICATION');
  console.log('───────────────────────────────────────────────────────────────');

  let allGood = true;

  // 1. message_templates (PRIMARY storage)
  console.log('\n1️⃣  message_templates (PRIMARY - used by direct execution):');
  if (campaign.message_templates) {
    const templates = campaign.message_templates;
    console.log('   ✅ EXISTS');
    console.log('   Structure:');
    
    if (templates.connection_request) {
      console.log(`   ├─ connection_request: "${templates.connection_request.substring(0, 50)}..."`);
    } else {
      console.log('   ├─ connection_request: ❌ MISSING');
      allGood = false;
    }

    if (templates.follow_up_messages && Array.isArray(templates.follow_up_messages)) {
      console.log(`   ├─ follow_up_messages: [${templates.follow_up_messages.length} messages]`);
      templates.follow_up_messages.forEach((msg, i) => {
        console.log(`   │  └─ FU${i + 1}: "${msg.substring(0, 40)}..."`);
      });
    } else {
      console.log('   └─ follow_up_messages: ❌ MISSING or not array');
      allGood = false;
    }
  } else {
    console.log('   ❌ NULL - Messages NOT stored!');
    allGood = false;
  }

  // 2. message_sequence (NEW storage format)
  console.log('\n2️⃣  message_sequence (NEW format with timestamps):');
  if (campaign.message_sequence) {
    const sequence = campaign.message_sequence;
    console.log('   ✅ EXISTS');
    
    if (Array.isArray(sequence)) {
      console.log(`   Messages: [${sequence.length} total]`);
      sequence.forEach((msg, i) => {
        console.log(`   ├─ Message ${i + 1}:`);
        console.log(`   │  ├─ Type: ${msg.type || 'unknown'}`);
        console.log(`   │  ├─ Text: "${(msg.text || msg.content || '').substring(0, 40)}..."`);
        console.log(`   │  ├─ Send at: ${msg.send_at ? new Date(msg.send_at).toLocaleString() : '❌ NO TIMESTAMP'}`);
        console.log(`   │  └─ Delay: ${msg.delay_days !== undefined ? msg.delay_days + ' days' : 'not set'}`);
      });
    } else {
      console.log('   ⚠️  Not an array:', typeof sequence);
    }
  } else {
    console.log('   ⚠️  NULL (column might not exist yet)');
  }

  // 3. flow_settings (N8N compatibility)
  console.log('\n3️⃣  flow_settings (N8N compatibility layer):');
  if (campaign.flow_settings) {
    const flow = campaign.flow_settings;
    console.log('   ✅ EXISTS');
    
    if (flow.messages) {
      console.log('   Messages:');
      console.log(`   ├─ connection_request: ${flow.messages.connection_request ? '✅' : '❌'}`);
      console.log(`   ├─ follow_up_1: ${flow.messages.follow_up_1 ? '✅' : '❌'}`);
      console.log(`   ├─ follow_up_2: ${flow.messages.follow_up_2 ? '✅' : '❌'}`);
      console.log(`   ├─ follow_up_3: ${flow.messages.follow_up_3 ? '✅' : '❌'}`);
      console.log(`   ├─ follow_up_4: ${flow.messages.follow_up_4 ? '✅' : '❌'}`);
      console.log(`   └─ follow_up_5: ${flow.messages.follow_up_5 ? '✅' : '❌'}`);
    } else {
      console.log('   ⚠️  flow_settings.messages not set');
    }
  } else {
    console.log('   ⚠️  NULL');
  }

  // 4. Legacy fields
  console.log('\n4️⃣  Legacy fields (backwards compatibility):');
  console.log(`   connection_message: ${campaign.connection_message ? '✅ Set' : '⚠️  NULL'}`);
  console.log(`   follow_up_messages: ${campaign.follow_up_messages ? '✅ Set' : '⚠️  NULL'}`);
  console.log(`   alternative_message: ${campaign.alternative_message ? '✅ Set' : '⚠️  NULL'}`);

  // Summary
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  if (allGood) {
    console.log('✅ ALL CHECKS PASSED - Messages stored correctly!');
  } else {
    console.log('⚠️  SOME ISSUES FOUND - Check messages above');
  }
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Check prospects
  const { data: prospects, error: prospectsError } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, status, contacted_at, follow_up_due_at')
    .eq('campaign_id', campaignId);

  if (!prospectsError && prospects && prospects.length > 0) {
    console.log(`\n👥 PROSPECTS (${prospects.length} total):`);
    console.log('───────────────────────────────────────────────────────────────');
    prospects.slice(0, 5).forEach(p => {
      console.log(`├─ ${p.first_name} ${p.last_name}`);
      console.log(`│  ├─ Status: ${p.status}`);
      console.log(`│  ├─ Contacted: ${p.contacted_at ? new Date(p.contacted_at).toLocaleString() : 'Not yet'}`);
      console.log(`│  └─ Next follow-up: ${p.follow_up_due_at ? new Date(p.follow_up_due_at).toLocaleString() : 'Not scheduled'}`);
    });
    if (prospects.length > 5) {
      console.log(`└─ ... and ${prospects.length - 5} more\n`);
    }
  }
}

// Get campaign ID from command line or use most recent
const campaignId = process.argv[2];
verifyCampaignMessages(campaignId);
