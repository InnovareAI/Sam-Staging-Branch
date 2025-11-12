#!/usr/bin/env node

/**
 * Check Michelle's campaign detailed status
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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

console.log('📊 MICHELLE\'S CAMPAIGN STATUS REPORT\n');
console.log('═'.repeat(60));

// Find Michelle's workspace (IA2)
const WORKSPACE_ID = '04666209-fce8-4d71-8eaf-01278edfc73b'; // IA2

// Get all campaigns for Michelle's workspace
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('*')
  .eq('workspace_id', WORKSPACE_ID)
  .order('created_at', { ascending: false });

console.log(`\n📋 Michelle's Workspace: IA2`);
console.log(`   Total Campaigns: ${campaigns?.length || 0}\n`);

if (!campaigns || campaigns.length === 0) {
  console.log('❌ No campaigns found');
  process.exit(0);
}

// Analyze each campaign
for (const campaign of campaigns) {
  console.log('─'.repeat(60));
  console.log(`\n🎯 Campaign: ${campaign.name}`);
  console.log(`   ID: ${campaign.id}`);
  console.log(`   Status: ${campaign.status}`);
  console.log(`   Type: ${campaign.campaign_type}`);
  console.log(`   Created: ${new Date(campaign.created_at).toLocaleDateString()}`);

  // Get all prospects for this campaign
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', campaign.id);

  console.log(`   Total Prospects: ${prospects?.length || 0}`);

  if (!prospects || prospects.length === 0) {
    console.log('   (No prospects)\n');
    continue;
  }

  // Count by status
  const statusCounts = {};
  prospects.forEach(p => {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
  });

  console.log('\n   📊 Status Breakdown:');

  const statusOrder = [
    'connection_requested',
    'connected',
    'queued_in_n8n',
    'pending',
    'approved',
    'failed',
    'rejected',
    'not_interested'
  ];

  let totalSent = 0;
  let totalFailed = 0;
  let totalWaiting = 0;

  statusOrder.forEach(status => {
    if (statusCounts[status]) {
      const emoji = {
        'connection_requested': '✅',
        'connected': '🟢',
        'queued_in_n8n': '⏳',
        'pending': '⏸️',
        'approved': '👍',
        'failed': '❌',
        'rejected': '🚫',
        'not_interested': '⛔'
      }[status] || '❓';

      console.log(`      ${emoji} ${status}: ${statusCounts[status]}`);

      // Count for summary
      if (status === 'connection_requested' || status === 'connected') {
        totalSent += statusCounts[status];
      } else if (status === 'failed') {
        totalFailed += statusCounts[status];
      } else if (status === 'queued_in_n8n' || status === 'pending' || status === 'approved') {
        totalWaiting += statusCounts[status];
      }
    }
  });

  // Show any other statuses not in the list
  Object.keys(statusCounts).forEach(status => {
    if (!statusOrder.includes(status)) {
      console.log(`      ❓ ${status}: ${statusCounts[status]}`);
    }
  });

  console.log('\n   📈 Summary:');
  console.log(`      ✅ CR's Sent: ${totalSent}`);
  console.log(`      ⏳ Waiting/Open: ${totalWaiting}`);
  console.log(`      ❌ Failed: ${totalFailed}`);

  // Show recent activity
  const recentlySent = prospects.filter(p =>
    p.contacted_at &&
    new Date(p.contacted_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  );

  if (recentlySent.length > 0) {
    console.log(`\n   🕐 Recent Activity (Last 7 days):`);
    console.log(`      ${recentlySent.length} connection requests sent`);

    // Show last 3
    const lastThree = recentlySent
      .sort((a, b) => new Date(b.contacted_at) - new Date(a.contacted_at))
      .slice(0, 3);

    lastThree.forEach(p => {
      console.log(`      - ${p.first_name} ${p.last_name} (${new Date(p.contacted_at).toLocaleString()})`);
    });
  }

  // Show failed prospects with errors
  const failed = prospects.filter(p => p.status === 'failed');
  if (failed.length > 0) {
    console.log(`\n   ⚠️  Failed Prospects:`);
    failed.forEach(p => {
      console.log(`      × ${p.first_name} ${p.last_name}`);
      if (p.personalization_data?.error) {
        console.log(`        Error: ${p.personalization_data.error}`);
      }
    });
  }

  console.log('');
}

console.log('═'.repeat(60));
console.log('\n✅ Report Complete\n');
