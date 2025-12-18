// Create Campaigns table in Airtable
const AIRTABLE_API_KEY = 'patGjqqtngAUpsPPz.0b428b264625f558675671497d7a53a0eb0be01d1a8bb6365051c3d9839abdd7';
const BASE_ID = 'appo6ZgNqEWLtw66q';

async function createTable() {
  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Campaigns',
      fields: [
        { name: 'Campaign Name', type: 'singleLineText' },
        { name: 'Status', type: 'singleSelect', options: { choices: [
          { name: 'active', color: 'greenBright' },
          { name: 'paused', color: 'yellowBright' },
          { name: 'draft', color: 'grayBright' },
          { name: 'archived', color: 'redBright' },
          { name: 'completed', color: 'blueBright' }
        ]}},
        { name: 'Type', type: 'singleSelect', options: { choices: [
          { name: 'connector' },
          { name: 'messenger' },
          { name: 'email_only' },
          { name: 'multi_channel' }
        ]}},
        { name: 'LinkedIn Account', type: 'singleLineText' },
        { name: 'Workspace', type: 'singleLineText' },
        { name: 'CRs Sent', type: 'number', options: { precision: 0 }},
        { name: 'Pending', type: 'number', options: { precision: 0 }},
        { name: 'Accepted', type: 'number', options: { precision: 0 }},
        { name: 'Replied', type: 'number', options: { precision: 0 }},
        { name: 'Total Prospects', type: 'number', options: { precision: 0 }},
        { name: 'Created Date', type: 'date', options: { dateFormat: { name: 'iso' }}},
        { name: 'Last Synced', type: 'dateTime', options: { timeZone: 'utc', dateFormat: { name: 'iso' }}},
        { name: 'Campaign ID', type: 'singleLineText' }
      ]
    })
  });

  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));

  if (data.id) {
    console.log('\n✅ Table created successfully!');
    console.log('Table ID:', data.id);
  } else {
    console.log('\n❌ Error creating table');
  }
}

createTable().catch(console.error);
