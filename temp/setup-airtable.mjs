// Setup Airtable Campaign Management & Reporting System
const AIRTABLE_API_KEY = 'patGjqqtngAUpsPPz.0b428b264625f558675671497d7a53a0eb0be01d1a8bb6365051c3d9839abdd7';
const BASE_ID = 'appo6ZgNqEWLtw66q';

async function createTable(name, fields) {
  console.log(`Creating table: ${name}...`);

  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name, fields })
  });

  const data = await response.json();

  if (data.id) {
    console.log(`✅ Created: ${name} (${data.id})`);
    return data.id;
  } else {
    console.log(`❌ Error creating ${name}:`, data.error?.message || data);
    return null;
  }
}

async function setup() {
  console.log('=== Setting up Airtable Campaign Management System ===\n');

  // 1. Campaigns Table
  const campaignsId = await createTable('Campaigns', [
    { name: 'Campaign Name', type: 'singleLineText' },
    { name: 'Workspace', type: 'singleLineText' },
    { name: 'LinkedIn Account', type: 'singleLineText' },
    { name: 'Status', type: 'singleSelect', options: { choices: [
      { name: 'active', color: 'greenBright' },
      { name: 'paused', color: 'yellowBright' },
      { name: 'draft', color: 'grayBright' },
      { name: 'archived', color: 'redBright' },
      { name: 'completed', color: 'blueBright' }
    ]}},
    { name: 'Type', type: 'singleSelect', options: { choices: [
      { name: 'connector', color: 'blueBright' },
      { name: 'messenger', color: 'purpleBright' },
      { name: 'email_only', color: 'orangeBright' },
      { name: 'multi_channel', color: 'pinkBright' }
    ]}},
    { name: 'CRs Sent', type: 'number', options: { precision: 0 }},
    { name: 'Pending', type: 'number', options: { precision: 0 }},
    { name: 'Accepted', type: 'number', options: { precision: 0 }},
    { name: 'Replied', type: 'number', options: { precision: 0 }},
    { name: 'Total Prospects', type: 'number', options: { precision: 0 }},
    { name: 'Accept Rate', type: 'percent', options: { precision: 1 }},
    { name: 'Reply Rate', type: 'percent', options: { precision: 1 }},
    { name: 'Created Date', type: 'date', options: { dateFormat: { name: 'local' }}},
    { name: 'Last Synced', type: 'dateTime', options: { timeZone: 'client', dateFormat: { name: 'local' }, timeFormat: { name: '12hour' }}},
    { name: 'Campaign ID', type: 'singleLineText' }
  ]);

  // 2. Daily Stats Table
  const dailyStatsId = await createTable('Daily Stats', [
    { name: 'Date', type: 'date', options: { dateFormat: { name: 'local' }}},
    { name: 'Campaign Name', type: 'singleLineText' },
    { name: 'Workspace', type: 'singleLineText' },
    { name: 'LinkedIn Account', type: 'singleLineText' },
    { name: 'CRs Sent Today', type: 'number', options: { precision: 0 }},
    { name: 'CRs Sent Total', type: 'number', options: { precision: 0 }},
    { name: 'Pending', type: 'number', options: { precision: 0 }},
    { name: 'Accepted Today', type: 'number', options: { precision: 0 }},
    { name: 'Accepted Total', type: 'number', options: { precision: 0 }},
    { name: 'Replied Today', type: 'number', options: { precision: 0 }},
    { name: 'Replied Total', type: 'number', options: { precision: 0 }},
    { name: 'Campaign ID', type: 'singleLineText' }
  ]);

  // 3. Workspaces Table
  const workspacesId = await createTable('Workspaces', [
    { name: 'Name', type: 'singleLineText' },
    { name: 'Total Campaigns', type: 'number', options: { precision: 0 }},
    { name: 'Active Campaigns', type: 'number', options: { precision: 0 }},
    { name: 'Total CRs Sent', type: 'number', options: { precision: 0 }},
    { name: 'Total Accepted', type: 'number', options: { precision: 0 }},
    { name: 'Total Replied', type: 'number', options: { precision: 0 }},
    { name: 'Workspace ID', type: 'singleLineText' }
  ]);

  // 4. LinkedIn Accounts Table
  const accountsId = await createTable('LinkedIn Accounts', [
    { name: 'Account Name', type: 'singleLineText' },
    { name: 'Workspace', type: 'singleLineText' },
    { name: 'Status', type: 'singleSelect', options: { choices: [
      { name: 'active', color: 'greenBright' },
      { name: 'disconnected', color: 'redBright' },
      { name: 'pending', color: 'yellowBright' }
    ]}},
    { name: 'Platform', type: 'singleLineText' },
    { name: 'Total Campaigns', type: 'number', options: { precision: 0 }},
    { name: 'Total CRs Sent', type: 'number', options: { precision: 0 }},
    { name: 'Account ID', type: 'singleLineText' }
  ]);

  console.log('\n=== Setup Complete ===');
  console.log('Tables created:');
  console.log('  - Campaigns:', campaignsId || 'FAILED');
  console.log('  - Daily Stats:', dailyStatsId || 'FAILED');
  console.log('  - Workspaces:', workspacesId || 'FAILED');
  console.log('  - LinkedIn Accounts:', accountsId || 'FAILED');
}

setup().catch(console.error);
