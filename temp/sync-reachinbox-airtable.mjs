// Sync ReachInbox email campaigns to Supabase and Airtable
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

const REACHINBOX_API_KEY = '21839670-cb8a-478c-8c07-a502c52c0405';
const AIRTABLE_API_KEY = 'patGjqqtngAUpsPPz.0b428b264625f558675671497d7a53a0eb0be01d1a8bb6365051c3d9839abdd7';
const AIRTABLE_BASE_ID = 'appo6ZgNqEWLtw66q';
const AIRTABLE_EMAIL_CAMPAIGNS_TABLE = 'tblvXRXztKCcyfvjP';

// Jennifer Fleming's workspace - all ReachInbox campaigns belong to her
const JENNIFER_WORKSPACE_ID = 'cd57981a-e63b-401c-bde1-ac71752c2293';

async function getReachInboxCampaigns() {
  console.log('📧 Fetching ReachInbox campaigns...');

  const response = await fetch('https://api.reachinbox.ai/api/v1/campaigns/all?limit=100&offset=0', {
    headers: {
      'Authorization': `Bearer ${REACHINBOX_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();
  const campaigns = data.data?.rows || [];

  // Filter to IA/ campaigns only (InnovareAI)
  const iaCampaigns = campaigns.filter(c => c.name && c.name.startsWith('IA/'));

  console.log(`  Found ${iaCampaigns.length} IA campaigns out of ${campaigns.length} total`);

  return iaCampaigns;
}

async function syncToSupabase(campaigns) {
  console.log('\n💾 Syncing to Supabase...');

  // Check if reachinbox columns exist
  const { data: sampleCamp } = await supabase
    .from('campaigns')
    .select('*')
    .limit(1)
    .single();

  const hasReachinboxColumns = sampleCamp && 'reachinbox_campaign_id' in sampleCamp;

  if (!hasReachinboxColumns) {
    console.log('  ⚠️  ReachInbox columns not yet added to campaigns table.');
    console.log('  ⚠️  Run migration 061-add-reachinbox-columns.sql first.');
    console.log('  ⚠️  Skipping Supabase sync, continuing with Airtable...');
    return;
  }

  for (const camp of campaigns) {
    // Check if campaign exists
    const { data: existing } = await supabase
      .from('campaigns')
      .select('id')
      .eq('reachinbox_campaign_id', String(camp.id))
      .single();

    const campaignData = {
      name: camp.name,
      campaign_type: 'email',
      workspace_id: JENNIFER_WORKSPACE_ID,
      status: mapStatus(camp.status),
      reachinbox_campaign_id: String(camp.id),
      // Email metrics from ReachInbox
      total_emails_sent: camp.totalEmailSent || 0,
      total_emails_opened: camp.totalEmailOpened || 0,
      total_emails_replied: camp.totalEmailReplied || 0,
      total_emails_bounced: camp.totalEmailBounced || 0,
      total_link_clicked: camp.totalLinkClicked || 0,
      leads_count: camp.leadAddedCount || 0,
      updated_at: new Date().toISOString()
    };

    if (existing) {
      // Update existing
      await supabase
        .from('campaigns')
        .update(campaignData)
        .eq('id', existing.id);
      console.log(`  ✅ Updated: ${camp.name}`);
    } else {
      // Insert new
      const { error } = await supabase
        .from('campaigns')
        .insert({
          ...campaignData,
          created_at: camp.createdAt || new Date().toISOString()
        });

      if (error) {
        console.log(`  ❌ Error inserting ${camp.name}:`, error.message);
      } else {
        console.log(`  ✅ Created: ${camp.name}`);
      }
    }
  }

  console.log(`  Synced ${campaigns.length} campaigns to Supabase`);
}

async function syncToAirtable(campaigns) {
  console.log('\n📊 Syncing to Airtable...');

  // Match actual Airtable column names
  const records = campaigns.map(camp => ({
    fields: {
      'Campaign Name': camp.name,
      'Workspace': 'Jennifer Fleming',
      'Status': mapStatus(camp.status, true), // true = forAirtable
      'Emails Sent': camp.totalEmailSent || 0,
      'Emails Opened': camp.totalEmailOpened || 0,
      'Emails Clicked': camp.totalLinkClicked || 0,
      'Emails Replied': camp.totalEmailReplied || 0,
      'Bounces': camp.totalEmailBounced || 0,
      'Open Rate': camp.totalEmailSent > 0
        ? (camp.totalEmailOpened || 0) / camp.totalEmailSent
        : 0,
      'Reply Rate': camp.totalEmailSent > 0
        ? (camp.totalEmailReplied || 0) / camp.totalEmailSent
        : 0,
      'ReachInbox Campaign ID': String(camp.id),
      'Last Synced': new Date().toISOString(),
      // Funnel metrics (placeholders - will be updated manually or via webhook)
      'Positive Replies': 0,
      'Meetings Booked': 0,
      'Trial Signups': 0,
      'MRR Clients': 0,
      'Total MRR': 0
    }
  }));

  // Airtable allows max 10 records per request
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);

    const response = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_EMAIL_CAMPAIGNS_TABLE}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ records: batch })
      }
    );

    const result = await response.json();
    if (result.error) {
      console.log('  ❌ Airtable error:', result.error.message);
    }
  }

  console.log(`  ✅ Synced ${records.length} campaigns to Airtable`);
}

function mapStatus(reachinboxStatus, forAirtable = false) {
  // Supabase mapping
  const statusMap = {
    'Draft': 'draft',
    'Active': 'active',
    'Paused': 'paused',
    'Completed': 'completed',
    'Offschedule': 'paused'
  };

  const mapped = statusMap[reachinboxStatus] || 'draft';

  // Airtable only has: active, paused, completed
  // Map draft to paused for Airtable
  if (forAirtable && mapped === 'draft') {
    return 'paused'; // Draft campaigns show as paused in Airtable
  }

  return mapped;
}

async function sync() {
  console.log('=== ReachInbox → Supabase → Airtable Sync ===');
  console.log('Time:', new Date().toISOString());
  console.log('');

  try {
    // 1. Fetch ReachInbox campaigns
    const campaigns = await getReachInboxCampaigns();

    if (campaigns.length === 0) {
      console.log('No IA campaigns found to sync');
      return;
    }

    // 2. Sync to Supabase (campaigns table)
    await syncToSupabase(campaigns);

    // 3. Sync to Airtable (Email Campaigns table)
    await syncToAirtable(campaigns);

    console.log('\n=== Sync Complete ===');
    console.log(`Total campaigns synced: ${campaigns.length}`);

    // Summary
    console.log('\n📊 Campaign Summary:');
    let totalSent = 0, totalOpened = 0, totalReplied = 0, totalBounced = 0;
    campaigns.forEach(c => {
      totalSent += c.totalEmailSent || 0;
      totalOpened += c.totalEmailOpened || 0;
      totalReplied += c.totalEmailReplied || 0;
      totalBounced += c.totalEmailBounced || 0;
    });
    console.log(`  Total Emails Sent: ${totalSent}`);
    console.log(`  Total Emails Opened: ${totalOpened}`);
    console.log(`  Total Emails Replied: ${totalReplied}`);
    console.log(`  Total Emails Bounced: ${totalBounced}`);

  } catch (error) {
    console.error('❌ Sync failed:', error);
  }
}

sync().catch(console.error);
