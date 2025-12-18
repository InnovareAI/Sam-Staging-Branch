// Sync Supabase data to Airtable Campaign Management System
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

const AIRTABLE_API_KEY = 'patGjqqtngAUpsPPz.0b428b264625f558675671497d7a53a0eb0be01d1a8bb6365051c3d9839abdd7';
const BASE_ID = 'appo6ZgNqEWLtw66q';

// InnovareAI workspaces only
const INNOVARE_WORKSPACE_IDS = [
  'babdcab8-1a78-4b2f-913e-6e9fd9821009', // Thorsten Linz
  '7f0341da-88db-476b-ae0a-fc0da5b70861', // Charissa Saniel
  '04666209-fce8-4d71-8eaf-01278edfc73b', // Michelle Gestuveo
  '96c03b38-a2f4-40de-9e16-43098599e1d4', // Irish Maguad
  '2a8f7c3d-9b1e-4f6a-8c2d-5e9a1b4f7d3c', // Chona Lamberte
  'cd57981a-e63b-401c-bde1-ac71752c2293', // Jennifer Fleming
];

// Table IDs from setup
const TABLES = {
  campaigns: 'tblQKOdJ5rZFmssLf',
  dailyStats: 'tbl61e5tMYhYrdZZL',
  workspaces: 'tblmrADivT0om9Shu',
  linkedinAccounts: 'tblnGEScrDDJefsho'
};

async function airtableRequest(tableId, method, body = null, recordId = null) {
  const url = recordId
    ? `https://api.airtable.com/v0/${BASE_ID}/${tableId}/${recordId}`
    : `https://api.airtable.com/v0/${BASE_ID}/${tableId}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json'
    }
  };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  const result = await response.json();

  if (result.error) {
    console.log(`  ❌ Airtable error (${method}):`, result.error.message || result.error);
  }

  return result;
}

// Get all existing records from a table
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

  // Create map by key field
  const map = new Map();
  records.forEach(r => {
    const key = r.fields[keyField];
    if (key) map.set(key, r.id);
  });

  return map;
}

async function syncWorkspaces() {
  console.log('\n📁 Syncing Workspaces...');

  // Get existing records for upsert
  const existingMap = await getExistingRecords(TABLES.workspaces, 'Workspace ID');
  console.log(`  Found ${existingMap.size} existing workspace records`);

  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name')
    .in('id', INNOVARE_WORKSPACE_IDS);

  const toCreate = [];
  const toUpdate = [];

  for (const ws of workspaces || []) {
    // Get campaign stats for this workspace
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id, status')
      .eq('workspace_id', ws.id);

    const campIds = campaigns?.map(c => c.id) || [];
    const activeCamps = campaigns?.filter(c => c.status === 'active').length || 0;

    let totalSent = 0, totalAccepted = 0, totalReplied = 0;
    if (campIds.length > 0) {
      const { count: sent } = await supabase
        .from('send_queue')
        .select('*', { count: 'exact', head: true })
        .in('campaign_id', campIds)
        .eq('status', 'sent');

      const { count: connected } = await supabase
        .from('campaign_prospects')
        .select('*', { count: 'exact', head: true })
        .in('campaign_id', campIds)
        .eq('status', 'connected');

      const { count: replied } = await supabase
        .from('campaign_prospects')
        .select('*', { count: 'exact', head: true })
        .in('campaign_id', campIds)
        .eq('status', 'replied');

      totalSent = sent || 0;
      totalAccepted = (connected || 0) + (replied || 0);
      totalReplied = replied || 0;
    }

    const fields = {
      'Name': ws.name,
      'Total Campaigns': campaigns?.length || 0,
      'Active Campaigns': activeCamps,
      'Total CRs Sent': totalSent,
      'Total Accepted': totalAccepted,
      'Total Replied': totalReplied,
      'Workspace ID': ws.id
    };

    const existingId = existingMap.get(ws.id);
    if (existingId) {
      toUpdate.push({ id: existingId, fields });
    } else {
      toCreate.push({ fields });
    }
  }

  // Create new records
  for (let i = 0; i < toCreate.length; i += 10) {
    const batch = toCreate.slice(i, i + 10);
    await airtableRequest(TABLES.workspaces, 'POST', { records: batch });
  }

  // Update existing records
  for (let i = 0; i < toUpdate.length; i += 10) {
    const batch = toUpdate.slice(i, i + 10);
    await airtableRequest(TABLES.workspaces, 'PATCH', { records: batch });
  }

  console.log(`  ✅ Created ${toCreate.length}, Updated ${toUpdate.length} workspaces`);
}

async function syncLinkedInAccounts() {
  console.log('\n👤 Syncing LinkedIn Accounts...');

  // Get existing records for upsert
  const existingMap = await getExistingRecords(TABLES.linkedinAccounts, 'Account ID');
  console.log(`  Found ${existingMap.size} existing account records`);

  const { data: accounts } = await supabase
    .from('user_unipile_accounts')
    .select('id, account_name, workspace_id, connection_status, platform')
    .eq('platform', 'LINKEDIN')
    .in('workspace_id', INNOVARE_WORKSPACE_IDS);

  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name');

  const wsMap = new Map(workspaces?.map(w => [w.id, w.name]) || []);

  const toCreate = [];
  const toUpdate = [];

  for (const acc of accounts || []) {
    // Get campaign stats for this account
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id')
      .eq('linkedin_account_id', acc.id);

    const campIds = campaigns?.map(c => c.id) || [];
    let totalSent = 0;
    if (campIds.length > 0) {
      const { count: sent } = await supabase
        .from('send_queue')
        .select('*', { count: 'exact', head: true })
        .in('campaign_id', campIds)
        .eq('status', 'sent');
      totalSent = sent || 0;
    }

    const fields = {
      'Account Name': acc.account_name,
      'Workspace': wsMap.get(acc.workspace_id) || 'Unknown',
      'Status': acc.connection_status === 'active' ? 'active' : 'disconnected',
      'Platform': acc.platform,
      'Total Campaigns': campaigns?.length || 0,
      'Total CRs Sent': totalSent,
      'Account ID': acc.id
    };

    const existingId = existingMap.get(acc.id);
    if (existingId) {
      toUpdate.push({ id: existingId, fields });
    } else {
      toCreate.push({ fields });
    }
  }

  for (let i = 0; i < toCreate.length; i += 10) {
    const batch = toCreate.slice(i, i + 10);
    await airtableRequest(TABLES.linkedinAccounts, 'POST', { records: batch });
  }

  for (let i = 0; i < toUpdate.length; i += 10) {
    const batch = toUpdate.slice(i, i + 10);
    await airtableRequest(TABLES.linkedinAccounts, 'PATCH', { records: batch });
  }

  console.log(`  ✅ Created ${toCreate.length}, Updated ${toUpdate.length} LinkedIn accounts`);
}

async function syncCampaigns() {
  console.log('\n📊 Syncing Campaigns...');

  // Get existing records for upsert
  const existingMap = await getExistingRecords(TABLES.campaigns, 'Campaign ID');
  console.log(`  Found ${existingMap.size} existing campaign records`);

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, campaign_type, linkedin_account_id, workspace_id, created_at')
    .in('workspace_id', INNOVARE_WORKSPACE_IDS);

  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name');

  const { data: accounts } = await supabase
    .from('user_unipile_accounts')
    .select('id, account_name');

  const wsMap = new Map(workspaces?.map(w => [w.id, w.name]) || []);
  const accMap = new Map(accounts?.map(a => [a.id, a.account_name]) || []);

  const toCreate = [];
  const toUpdate = [];

  for (const camp of campaigns || []) {
    // Get stats
    const { count: sent } = await supabase
      .from('send_queue')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', camp.id)
      .eq('status', 'sent');

    const { count: pending } = await supabase
      .from('send_queue')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', camp.id)
      .eq('status', 'pending');

    const { count: connected } = await supabase
      .from('campaign_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', camp.id)
      .eq('status', 'connected');

    const { count: replied } = await supabase
      .from('campaign_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', camp.id)
      .eq('status', 'replied');

    // Positive replies (replied with positive sentiment)
    const { count: positiveReplies } = await supabase
      .from('campaign_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', camp.id)
      .eq('status', 'replied')
      .eq('reply_sentiment', 'positive');

    // Negative replies
    const { count: negativeReplies } = await supabase
      .from('campaign_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', camp.id)
      .eq('status', 'replied')
      .eq('reply_sentiment', 'negative');

    // Meetings booked
    const { count: meetingsBooked } = await supabase
      .from('campaign_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', camp.id)
      .eq('meeting_booked', true);

    const { count: total } = await supabase
      .from('campaign_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', camp.id);

    const accepted = (connected || 0) + (replied || 0);
    const sentCount = sent || 0;
    const acceptRate = sentCount > 0 ? accepted / sentCount : 0;
    const replyRate = sentCount > 0 ? (replied || 0) / sentCount : 0;

    // Map campaign_type to Airtable select options (only 'connector', 'messenger' exist)
    const typeMap = {
      'connector': 'connector',
      'messenger': 'messenger',
      'email': 'connector', // Email campaigns shown as connector in Airtable
      null: 'connector'
    };

    const fields = {
      'Campaign Name': camp.name,
      'Workspace': wsMap.get(camp.workspace_id) || 'Unknown',
      'LinkedIn Account': accMap.get(camp.linkedin_account_id) || 'Not Set',
      'Status': camp.status || 'draft',
      'Type': typeMap[camp.campaign_type] || 'connector',
      'CRs Sent': sentCount,
      'Pending': pending || 0,
      'Accepted': accepted,
      'Replied': replied || 0,
      'Positive Replies': positiveReplies || 0,
      'Meetings Booked': meetingsBooked || 0,
      'Total Prospects': total || 0,
      'Accept Rate': acceptRate,
      'Reply Rate': replyRate,
      'Created Date': camp.created_at ? camp.created_at.split('T')[0] : null,
      'Last Synced': new Date().toISOString(),
      'Campaign ID': camp.id
    };

    const existingId = existingMap.get(camp.id);
    if (existingId) {
      toUpdate.push({ id: existingId, fields });
    } else {
      toCreate.push({ fields });
    }
  }

  for (let i = 0; i < toCreate.length; i += 10) {
    const batch = toCreate.slice(i, i + 10);
    await airtableRequest(TABLES.campaigns, 'POST', { records: batch });
  }

  for (let i = 0; i < toUpdate.length; i += 10) {
    const batch = toUpdate.slice(i, i + 10);
    await airtableRequest(TABLES.campaigns, 'PATCH', { records: batch });
  }

  console.log(`  ✅ Created ${toCreate.length}, Updated ${toUpdate.length} campaigns`);
}

async function syncDailyStats() {
  console.log('\n📈 Creating Daily Stats snapshot...');

  const today = new Date().toISOString().split('T')[0];

  // Get existing records - we need to match on Campaign ID + Date combo
  // Airtable doesn't have a composite key, so we'll use a formula filter
  const existingRecords = [];
  let offset = null;
  do {
    const filterFormula = encodeURIComponent(`{Date}='${today}'`);
    const url = offset
      ? `https://api.airtable.com/v0/${BASE_ID}/${TABLES.dailyStats}?filterByFormula=${filterFormula}&offset=${offset}`
      : `https://api.airtable.com/v0/${BASE_ID}/${TABLES.dailyStats}?filterByFormula=${filterFormula}`;

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
    });
    const data = await response.json();
    if (data.records) existingRecords.push(...data.records);
    offset = data.offset;
  } while (offset);

  // Map by Campaign ID for today's records
  const existingMap = new Map();
  existingRecords.forEach(r => {
    const campId = r.fields['Campaign ID'];
    if (campId) existingMap.set(campId, r.id);
  });
  console.log(`  Found ${existingMap.size} existing daily stats for ${today}`);

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, linkedin_account_id, workspace_id')
    .eq('status', 'active')
    .in('workspace_id', INNOVARE_WORKSPACE_IDS);

  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name');

  const { data: accounts } = await supabase
    .from('user_unipile_accounts')
    .select('id, account_name');

  const wsMap = new Map(workspaces?.map(w => [w.id, w.name]) || []);
  const accMap = new Map(accounts?.map(a => [a.id, a.account_name]) || []);

  const toCreate = [];
  const toUpdate = [];

  for (const camp of campaigns || []) {
    // Get today's stats
    const todayStart = today + 'T00:00:00.000Z';
    const todayEnd = today + 'T23:59:59.999Z';

    const { count: sentToday } = await supabase
      .from('send_queue')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', camp.id)
      .eq('status', 'sent')
      .gte('sent_at', todayStart)
      .lte('sent_at', todayEnd);

    const { count: sentTotal } = await supabase
      .from('send_queue')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', camp.id)
      .eq('status', 'sent');

    const { count: pending } = await supabase
      .from('send_queue')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', camp.id)
      .eq('status', 'pending');

    const { count: connected } = await supabase
      .from('campaign_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', camp.id)
      .eq('status', 'connected');

    const { count: replied } = await supabase
      .from('campaign_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', camp.id)
      .eq('status', 'replied');

    const fields = {
      'Date': today,
      'Campaign Name': camp.name,
      'Workspace': wsMap.get(camp.workspace_id) || 'Unknown',
      'LinkedIn Account': accMap.get(camp.linkedin_account_id) || 'Not Set',
      'CRs Sent Today': sentToday || 0,
      'CRs Sent Total': sentTotal || 0,
      'Pending': pending || 0,
      'Accepted Today': 0, // Would need timestamp tracking
      'Accepted Total': (connected || 0) + (replied || 0),
      'Replied Today': 0, // Would need timestamp tracking
      'Replied Total': replied || 0,
      'Campaign ID': camp.id
    };

    const existingId = existingMap.get(camp.id);
    if (existingId) {
      toUpdate.push({ id: existingId, fields });
    } else {
      toCreate.push({ fields });
    }
  }

  for (let i = 0; i < toCreate.length; i += 10) {
    const batch = toCreate.slice(i, i + 10);
    await airtableRequest(TABLES.dailyStats, 'POST', { records: batch });
  }

  for (let i = 0; i < toUpdate.length; i += 10) {
    const batch = toUpdate.slice(i, i + 10);
    await airtableRequest(TABLES.dailyStats, 'PATCH', { records: batch });
  }

  console.log(`  ✅ Created ${toCreate.length}, Updated ${toUpdate.length} daily stats for ${today}`);
}

async function sync() {
  console.log('=== Syncing to Airtable Campaign Management System ===');
  console.log('Time:', new Date().toISOString());

  await syncWorkspaces();
  await syncLinkedInAccounts();
  await syncCampaigns();
  await syncDailyStats();

  console.log('\n=== Sync Complete ===');
}

sync().catch(console.error);
