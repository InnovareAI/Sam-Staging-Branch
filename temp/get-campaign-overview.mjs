#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://latxadqrvrrrcvkktrog.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const supabase = createClient(supabaseUrl, supabaseKey);

const people = ['Charissa', 'Michelle', 'Irish', 'Samantha', 'Thorsten'];

async function getCampaignOverview() {
  console.log('='.repeat(80));
  console.log('CAMPAIGN OVERVIEW REPORT - December 19, 2025');
  console.log('='.repeat(80));
  console.log('');

  for (const person of people) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 ${person.toUpperCase()}`);
    console.log('='.repeat(80));

    // Search for campaigns containing this person's name
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .ilike('name', `%${person}%`)
      .order('created_at', { ascending: false });

    if (campaignsError) {
      console.error(`Error fetching campaigns for ${person}:`, campaignsError);
      continue;
    }

    if (!campaigns || campaigns.length === 0) {
      console.log(`❌ No campaigns found for ${person}`);
      continue;
    }

    console.log(`\nFound ${campaigns.length} campaign(s):\n`);

    for (const campaign of campaigns) {
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`📌 Campaign: ${campaign.name}`);
      console.log(`   ID: ${campaign.id}`);
      console.log(`   Status: ${campaign.is_active ? '✅ ACTIVE' : '⏸️  PAUSED'}`);
      console.log(`   Type: ${campaign.campaign_type || 'linkedin_only'}`);
      console.log(`   Created: ${new Date(campaign.created_at).toLocaleDateString()}`);

      // Get prospect counts
      const { data: prospects, error: prospectsError } = await supabase
        .from('campaign_prospects')
        .select('status, id')
        .eq('campaign_id', campaign.id);

      if (prospectsError) {
        console.error(`   Error fetching prospects:`, prospectsError.message);
      } else {
        const statusCounts = prospects.reduce((acc, p) => {
          acc[p.status] = (acc[p.status] || 0) + 1;
          return acc;
        }, {});

        console.log(`\n   📋 Prospects (Total: ${prospects.length}):`);
        Object.entries(statusCounts).forEach(([status, count]) => {
          console.log(`      ${status}: ${count}`);
        });
      }

      // Get send queue status
      const { data: queueItems, error: queueError } = await supabase
        .from('send_queue')
        .select('status, id, sent_at, error_message')
        .eq('campaign_id', campaign.id);

      if (queueError) {
        console.error(`   Error fetching queue:`, queueError.message);
      } else {
        const queueStatusCounts = queueItems.reduce((acc, q) => {
          acc[q.status] = (acc[q.status] || 0) + 1;
          return acc;
        }, {});

        console.log(`\n   📬 Send Queue (Total: ${queueItems.length}):`);
        if (queueItems.length === 0) {
          console.log(`      ⚠️  EMPTY QUEUE`);
        } else {
          Object.entries(queueStatusCounts).forEach(([status, count]) => {
            console.log(`      ${status}: ${count}`);
          });

          // Check for messages sent today (Dec 19, 2025)
          const today = new Date('2025-12-19');
          const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString();
          const todayEnd = new Date(today.setHours(23, 59, 59, 999)).toISOString();

          const sentToday = queueItems.filter(q =>
            q.sent_at &&
            q.sent_at >= todayStart &&
            q.sent_at <= todayEnd
          );

          console.log(`\n   📤 Sent Today (Dec 19): ${sentToday.length}`);

          // Show failed items if any
          const failed = queueItems.filter(q => q.status === 'failed');
          if (failed.length > 0) {
            console.log(`\n   ❌ Failed Items: ${failed.length}`);
            failed.slice(0, 3).forEach(f => {
              console.log(`      - ${f.error_message || 'No error message'}`);
            });
          }
        }
      }

      // Issues summary
      const issues = [];
      if (!campaign.is_active) issues.push('Campaign is PAUSED');
      if (!queueItems || queueItems.length === 0) issues.push('Send queue is EMPTY');
      if (queueItems?.filter(q => q.status === 'failed').length > 0) {
        issues.push(`${queueItems.filter(q => q.status === 'failed').length} failed queue items`);
      }
      if (!prospects || prospects.length === 0) issues.push('No prospects found');

      if (issues.length > 0) {
        console.log(`\n   ⚠️  Issues:`);
        issues.forEach(issue => console.log(`      - ${issue}`));
      } else {
        console.log(`\n   ✅ No issues detected`);
      }
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('End of Report');
  console.log('='.repeat(80));
}

getCampaignOverview().catch(console.error);
