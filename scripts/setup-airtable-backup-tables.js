/**
 * Setup Airtable Backup Base Structure for SAM AI
 *
 * Creates 4 tables in Airtable base (appOtsfn60HFeTpnn):
 * 1. Workspace Accounts
 * 2. Workspace Members
 * 3. Users
 * 4. Backup Metadata
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Only load .env.local, override any existing env vars
config({ path: join(__dirname, '..', '.env.local'), override: true });

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error('❌ Missing Airtable credentials in .env.local');
  process.exit(1);
}

console.log('🔧 Setting up Airtable backup base structure...');
console.log(`📦 Base ID: ${AIRTABLE_BASE_ID}`);
console.log('');

// Table definitions
const tables = [
  {
    name: 'Workspace Accounts',
    fields: [
      { name: 'Supabase ID', type: 'singleLineText' },
      { name: 'Workspace ID', type: 'singleLineText' },
      { name: 'User ID', type: 'singleLineText' },
      {
        name: 'Account Type',
        type: 'singleSelect',
        options: {
          choices: [
            { name: 'linkedin' },
            { name: 'email' }
          ]
        }
      },
      { name: 'Account Name', type: 'singleLineText' },
      { name: 'Unipile Account ID', type: 'singleLineText' },
      {
        name: 'Connection Status',
        type: 'singleSelect',
        options: {
          choices: [
            { name: 'connected' },
            { name: 'disconnected' }
          ]
        }
      },
      {
        name: 'Is Active',
        type: 'singleSelect',
        options: {
          choices: [
            { name: 'Yes' },
            { name: 'No' }
          ]
        }
      },
      {
        name: 'Backup Timestamp',
        type: 'dateTime',
        options: {
          dateFormat: { name: 'iso' },
          timeFormat: { name: '24hour' },
          timeZone: 'utc'
        }
      },
      { name: 'Restore Point', type: 'singleLineText' }
    ]
  },
  {
    name: 'Workspace Members',
    fields: [
      { name: 'Supabase ID', type: 'singleLineText' },
      { name: 'Workspace ID', type: 'singleLineText' },
      { name: 'User ID', type: 'singleLineText' },
      {
        name: 'Role',
        type: 'singleSelect',
        options: {
          choices: [
            { name: 'owner' },
            { name: 'admin' },
            { name: 'member' }
          ]
        }
      },
      {
        name: 'Status',
        type: 'singleSelect',
        options: {
          choices: [
            { name: 'active' },
            { name: 'inactive' },
            { name: 'pending' }
          ]
        }
      },
      {
        name: 'Joined At',
        type: 'dateTime',
        options: {
          dateFormat: { name: 'iso' },
          timeFormat: { name: '24hour' },
          timeZone: 'utc'
        }
      },
      {
        name: 'Backup Timestamp',
        type: 'dateTime',
        options: {
          dateFormat: { name: 'iso' },
          timeFormat: { name: '24hour' },
          timeZone: 'utc'
        }
      },
      { name: 'Restore Point', type: 'singleLineText' }
    ]
  },
  {
    name: 'Users',
    fields: [
      { name: 'Supabase ID', type: 'singleLineText' },
      { name: 'Email', type: 'email' },
      { name: 'First Name', type: 'singleLineText' },
      { name: 'Last Name', type: 'singleLineText' },
      { name: 'Current Workspace', type: 'singleLineText' },
      {
        name: 'Email Verified',
        type: 'singleSelect',
        options: {
          choices: [
            { name: 'Yes' },
            { name: 'No' }
          ]
        }
      },
      {
        name: 'Created At',
        type: 'dateTime',
        options: {
          dateFormat: { name: 'iso' },
          timeFormat: { name: '24hour' },
          timeZone: 'utc'
        }
      },
      {
        name: 'Backup Timestamp',
        type: 'dateTime',
        options: {
          dateFormat: { name: 'iso' },
          timeFormat: { name: '24hour' },
          timeZone: 'utc'
        }
      },
      { name: 'Restore Point', type: 'singleLineText' }
    ]
  },
  {
    name: 'Backup Metadata',
    fields: [
      {
        name: 'Timestamp',
        type: 'dateTime',
        options: {
          dateFormat: { name: 'iso' },
          timeFormat: { name: '24hour' },
          timeZone: 'utc'
        }
      },
      { name: 'Restore Point Name', type: 'singleLineText' },
      { name: 'Tables Backed Up', type: 'multilineText' },
      { name: 'Record Count', type: 'number', options: { precision: 0 } },
      {
        name: 'Status',
        type: 'singleSelect',
        options: {
          choices: [
            { name: 'Complete' },
            { name: 'Failed' },
            { name: 'Partial' }
          ]
        }
      },
      {
        name: 'Backup Type',
        type: 'singleSelect',
        options: {
          choices: [
            { name: 'Manual' },
            { name: 'Automatic with restore-point' },
            { name: 'Scheduled' }
          ]
        }
      }
    ]
  }
];

async function createTable(tableDef) {
  const url = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tableDef)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(JSON.stringify(data, null, 2));
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function checkExistingTables() {
  const url = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(JSON.stringify(data, null, 2));
    }

    return data.tables || [];
  } catch (error) {
    console.error('❌ Error checking existing tables:', error.message);
    return [];
  }
}

async function main() {
  console.log('🔍 Checking existing tables...\n');
  const existingTables = await checkExistingTables();
  const existingTableNames = existingTables.map(t => t.name);

  if (existingTableNames.length > 0) {
    console.log('📋 Existing tables in base:');
    existingTableNames.forEach(name => console.log(`   - ${name}`));
    console.log('');
  }

  let successCount = 0;
  let errorCount = 0;
  const results = [];

  for (const tableDef of tables) {
    console.log(`📝 Creating table: ${tableDef.name}`);

    if (existingTableNames.includes(tableDef.name)) {
      console.log(`   ⚠️  Table already exists, skipping...`);
      results.push({ table: tableDef.name, status: 'skipped', reason: 'already exists' });
      continue;
    }

    const result = await createTable(tableDef);

    if (result.success) {
      console.log(`   ✅ Successfully created!`);
      console.log(`   📊 Table ID: ${result.data.id}`);
      console.log(`   📋 Fields: ${tableDef.fields.length}`);
      successCount++;
      results.push({
        table: tableDef.name,
        status: 'created',
        id: result.data.id,
        fields: tableDef.fields.length
      });
    } else {
      console.log(`   ❌ Failed to create`);
      console.log(`   Error: ${result.error}`);
      errorCount++;
      results.push({ table: tableDef.name, status: 'failed', error: result.error });
    }
    console.log('');

    // Rate limiting: wait 1 second between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('═══════════════════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('═══════════════════════════════════════════════════');
  console.log(`✅ Successfully created: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log(`⚠️  Skipped (already exist): ${results.filter(r => r.status === 'skipped').length}`);
  console.log('');

  console.log('📋 DETAILED RESULTS:');
  results.forEach(r => {
    if (r.status === 'created') {
      console.log(`   ✅ ${r.table} - Created (${r.fields} fields)`);
    } else if (r.status === 'skipped') {
      console.log(`   ⚠️  ${r.table} - Skipped (${r.reason})`);
    } else {
      console.log(`   ❌ ${r.table} - Failed`);
      console.log(`      Error: ${r.error}`);
    }
  });
  console.log('');

  if (successCount === tables.length) {
    console.log('🎉 All tables created successfully!');
    console.log('');
    console.log('🔗 View your base at:');
    console.log(`   https://airtable.com/${AIRTABLE_BASE_ID}`);
  } else if (errorCount > 0) {
    console.log('⚠️  Some tables failed to create. See errors above.');
    process.exit(1);
  }
}

main();
