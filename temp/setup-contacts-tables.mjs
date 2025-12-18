// Setup LinkedIn Contacts and Email Contacts tables in Airtable
// Also creates a Key Metrics interface view

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

const AIRTABLE_API_KEY = 'patGjqqtngAUpsPPz.0b428b264625f558675671497d7a53a0eb0be01d1a8bb6365051c3d9839abdd7';
const BASE_ID = 'appo6ZgNqEWLtw66q';

// Table IDs (create these in Airtable first, then add IDs here)
const TABLES = {
  linkedinContacts: 'tblMqDWVazMY1TD1l', // LinkedIn Positive Leads 25-26
  emailCampaigns: 'tblvXRXztKCcyfvjP',   // Email Campaigns
  keyMetrics: null // Will be created
};

const INNOVARE_WORKSPACE_IDS = [
  'babdcab8-1a78-4b2f-913e-6e9fd9821009', // Thorsten Linz
  '7f0341da-88db-476b-ae0a-fc0da5b70861', // Charissa Saniel
  '04666209-fce8-4d71-8eaf-01278edfc73b', // Michelle Gestuveo
  '96c03b38-a2f4-40de-9e16-43098599e1d4', // Irish Maguad
  '2a8f7c3d-9b1e-4f6a-8c2d-5e9a1b4f7d3c', // Chona Lamberte
  'cd57981a-e63b-401c-bde1-ac71752c2293', // Jennifer Fleming
];

const WORKSPACE_TO_ACCOUNT = {
  'babdcab8-1a78-4b2f-913e-6e9fd9821009': 'TL',
  '7f0341da-88db-476b-ae0a-fc0da5b70861': 'Cha',
  '04666209-fce8-4d71-8eaf-01278edfc73b': 'Michelle',
  '96c03b38-a2f4-40de-9e16-43098599e1d4': 'Irish',
  '2a8f7c3d-9b1e-4f6a-8c2d-5e9a1b4f7d3c': 'Charlie',
  'cd57981a-e63b-401c-bde1-ac71752c2293': 'TL',
};

async function getExistingRecords(tableId, keyField) {
  const records = [];
  let offset = null;

  do {
    const url = offset
      ? `https://api.airtable.com/v0/${BASE_ID}/${tableId}?offset=${offset}`
      : `https://api.airtable.com/v0/${BASE_ID}/${tableId}`;

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
    });
    const data = await response.json();

    if (data.records) {
      records.push(...data.records);
    }
    offset = data.offset;
  } while (offset);

  const map = new Map();
  records.forEach(r => {
    const key = r.fields[keyField];
    if (key) map.set(key, r.id);
  });

  return map;
}

async function airtableRequest(tableId, method, body) {
  const response = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${tableId}`, {
    method,
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (result.error) {
    console.log(`  ❌ Airtable error (${method}):`, result.error.message || result.error);
  }
  return result;
}

async function syncLinkedInContacts() {
  console.log('\n👤 Syncing LinkedIn Contacts...');

  // Get existing records by Profile URL
  const existingMap = await getExistingRecords(TABLES.linkedinContacts, 'Profile URL');
  console.log(`  Found ${existingMap.size} existing LinkedIn contacts`);

  // Get all LinkedIn contacts with sent/connected/replied status
  const { data: prospects, error } = await supabase
    .from('campaign_prospects')
    .select(`
      id,
      workspace_id,
      campaign_id,
      first_name,
      last_name,
      email,
      linkedin_url,
      company_name,
      title,
      industry,
      location,
      status,
      contacted_at,
      connection_accepted_at,
      responded_at,
      notes,
      reply_sentiment,
      meeting_booked,
      meeting_booked_at,
      campaigns:campaign_id (name)
    `)
    .in('workspace_id', INNOVARE_WORKSPACE_IDS)
    .in('status', ['connection_request_sent', 'connected', 'replied']);

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log(`  Found ${prospects?.length || 0} LinkedIn contacts in Supabase`);

  const toCreate = [];
  const toUpdate = [];

  for (const p of prospects || []) {
    if (!p.linkedin_url) continue;

    // Map status to existing Airtable options
    // Valid Status: 'need more info', 'send her Calendar link', 'Maybe Later', 'Interested Lead', 'NOT INTERESTED'
    // Valid Action: 'Connected', 'Responded', 'Need a reply', 'Follow-up on Feb./March 2026'
    const statusMap = {
      'positive': 'Interested Lead',
      'negative': 'NOT INTERESTED',
      'replied': 'need more info',
      'connected': 'need more info', // Connected but waiting for reply
      'default': 'need more info'
    };

    const fields = {
      'Profile URL': p.linkedin_url,
      'Name of Interested Lead': `${p.first_name || ''} ${p.last_name || ''}`.trim(),
      'Job Title': p.title || '',
      'Email': p.email || '',
      'Company Name': p.company_name || '',
      'Date': p.contacted_at ? p.contacted_at.split('T')[0] : new Date().toISOString().split('T')[0],
      'LinkedIn Account': WORKSPACE_TO_ACCOUNT[p.workspace_id] || 'Unknown',
      'Status of the Lead': statusMap[p.reply_sentiment] || statusMap[p.status] || statusMap['default'],
      'Last Messages/ Responses': p.notes || '',
      'Action': p.status === 'replied' ? 'Responded' : 'Connected',
      'Industry': p.industry || '',
      'Country': p.location || ''
    };

    const existingId = existingMap.get(p.linkedin_url);
    if (existingId) {
      toUpdate.push({ id: existingId, fields });
    } else {
      toCreate.push({ fields });
    }
  }

  // Create new records
  for (let i = 0; i < toCreate.length; i += 10) {
    const batch = toCreate.slice(i, i + 10);
    await airtableRequest(TABLES.linkedinContacts, 'POST', { records: batch });
  }

  // Update existing records
  for (let i = 0; i < toUpdate.length; i += 10) {
    const batch = toUpdate.slice(i, i + 10);
    await airtableRequest(TABLES.linkedinContacts, 'PATCH', { records: batch });
  }

  console.log(`  ✅ Created ${toCreate.length}, Updated ${toUpdate.length} LinkedIn contacts`);
}

async function syncEmailCampaigns() {
  console.log('\n📧 Syncing Email Campaigns (from ReachInbox)...');

  // Get existing records
  const existingMap = await getExistingRecords(TABLES.emailCampaigns, 'ReachInbox Campaign ID');
  console.log(`  Found ${existingMap.size} existing email campaigns`);

  // Fetch from ReachInbox
  const REACHINBOX_API_KEY = '21839670-cb8a-478c-8c07-a502c52c0405';

  const response = await fetch('https://api.reachinbox.ai/api/v1/campaigns/all?limit=100&offset=0', {
    headers: {
      'Authorization': `Bearer ${REACHINBOX_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();
  const campaigns = (data.data?.rows || []).filter(c => c.name && c.name.startsWith('IA/'));

  console.log(`  Found ${campaigns.length} IA email campaigns in ReachInbox`);

  const toCreate = [];
  const toUpdate = [];

  for (const camp of campaigns) {
    const fields = {
      'Campaign Name': camp.name,
      'Workspace': 'Jennifer Fleming',
      'Status': camp.status === 'Active' ? 'active' : camp.status === 'Paused' ? 'paused' : 'paused',
      'Emails Sent': camp.totalEmailSent || 0,
      'Emails Opened': camp.totalEmailOpened || 0,
      'Emails Clicked': camp.totalLinkClicked || 0,
      'Emails Replied': camp.totalEmailReplied || 0,
      'Bounces': camp.totalEmailBounced || 0,
      'Open Rate': camp.totalEmailSent > 0 ? (camp.totalEmailOpened || 0) / camp.totalEmailSent : 0,
      'Reply Rate': camp.totalEmailSent > 0 ? (camp.totalEmailReplied || 0) / camp.totalEmailSent : 0,
      'ReachInbox Campaign ID': String(camp.id),
      'Last Synced': new Date().toISOString()
    };

    const existingId = existingMap.get(String(camp.id));
    if (existingId) {
      toUpdate.push({ id: existingId, fields });
    } else {
      toCreate.push({ fields });
    }
  }

  // Create/Update
  for (let i = 0; i < toCreate.length; i += 10) {
    const batch = toCreate.slice(i, i + 10);
    await airtableRequest(TABLES.emailCampaigns, 'POST', { records: batch });
  }

  for (let i = 0; i < toUpdate.length; i += 10) {
    const batch = toUpdate.slice(i, i + 10);
    await airtableRequest(TABLES.emailCampaigns, 'PATCH', { records: batch });
  }

  console.log(`  ✅ Created ${toCreate.length}, Updated ${toUpdate.length} email campaigns`);
}

async function generateKeyMetrics() {
  console.log('\n📊 Generating Key Metrics...');

  // LinkedIn metrics
  const { data: liProspects } = await supabase
    .from('campaign_prospects')
    .select('status, reply_sentiment, meeting_booked')
    .in('workspace_id', INNOVARE_WORKSPACE_IDS);

  const liStats = {
    total: liProspects?.length || 0,
    sent: liProspects?.filter(p => ['connection_request_sent', 'connected', 'replied'].includes(p.status)).length || 0,
    connected: liProspects?.filter(p => ['connected', 'replied'].includes(p.status)).length || 0,
    replied: liProspects?.filter(p => p.status === 'replied').length || 0,
    positive: liProspects?.filter(p => p.reply_sentiment === 'positive').length || 0,
    meetings: liProspects?.filter(p => p.meeting_booked).length || 0
  };

  // Email metrics (from ReachInbox)
  const REACHINBOX_API_KEY = '21839670-cb8a-478c-8c07-a502c52c0405';
  const response = await fetch('https://api.reachinbox.ai/api/v1/campaigns/all?limit=100&offset=0', {
    headers: { 'Authorization': `Bearer ${REACHINBOX_API_KEY}` }
  });
  const data = await response.json();
  const iaCampaigns = (data.data?.rows || []).filter(c => c.name?.startsWith('IA/'));

  const emailStats = {
    sent: iaCampaigns.reduce((sum, c) => sum + (c.totalEmailSent || 0), 0),
    opened: iaCampaigns.reduce((sum, c) => sum + (c.totalEmailOpened || 0), 0),
    replied: iaCampaigns.reduce((sum, c) => sum + (c.totalEmailReplied || 0), 0),
    bounced: iaCampaigns.reduce((sum, c) => sum + (c.totalEmailBounced || 0), 0)
  };

  console.log('\n=== KEY METRICS DASHBOARD ===');
  console.log('');
  console.log('📱 LINKEDIN OUTREACH:');
  console.log(`   Total Prospects: ${liStats.total}`);
  console.log(`   CRs Sent: ${liStats.sent}`);
  console.log(`   Connected: ${liStats.connected} (${(liStats.connected/liStats.sent*100 || 0).toFixed(1)}% accept rate)`);
  console.log(`   Replied: ${liStats.replied} (${(liStats.replied/liStats.sent*100 || 0).toFixed(1)}% reply rate)`);
  console.log(`   Positive Replies: ${liStats.positive}`);
  console.log(`   Meetings Booked: ${liStats.meetings}`);
  console.log('');
  console.log('📧 EMAIL OUTREACH:');
  console.log(`   Emails Sent: ${emailStats.sent}`);
  console.log(`   Emails Opened: ${emailStats.opened} (${(emailStats.opened/emailStats.sent*100 || 0).toFixed(1)}% open rate)`);
  console.log(`   Emails Replied: ${emailStats.replied} (${(emailStats.replied/emailStats.sent*100 || 0).toFixed(1)}% reply rate)`);
  console.log(`   Bounced: ${emailStats.bounced}`);
  console.log('');
  console.log('🎯 COMBINED FUNNEL:');
  console.log(`   Total Outreach: ${liStats.sent + emailStats.sent}`);
  console.log(`   Total Replies: ${liStats.replied + emailStats.replied}`);
  console.log(`   Positive Replies: ${liStats.positive} (LinkedIn only for now)`);
  console.log(`   Meetings Booked: ${liStats.meetings}`);

  return { liStats, emailStats };
}

async function sync() {
  console.log('=== Contacts & Key Metrics Sync ===');
  console.log('Time:', new Date().toISOString());

  await syncLinkedInContacts();
  await syncEmailCampaigns();
  await generateKeyMetrics();

  console.log('\n=== Sync Complete ===');
}

sync().catch(console.error);
