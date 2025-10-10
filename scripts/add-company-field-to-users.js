#!/usr/bin/env node

/**
 * Add Company field to Users table in Airtable
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local'), override: true });

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

async function addCompanyField() {
  console.log('📝 Adding Company field to Users table...\n');

  // First, get the Users table ID
  const tablesUrl = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;

  const tablesResponse = await fetch(tablesUrl, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
  });

  const tablesData = await tablesResponse.json();
  const usersTable = tablesData.tables.find(t => t.name === 'Users');

  if (!usersTable) {
    console.error('❌ Users table not found');
    return;
  }

  console.log(`Found Users table: ${usersTable.id}\n`);

  // Add Company field
  const fieldUrl = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables/${usersTable.id}/fields`;

  const fieldDef = {
    name: 'Company',
    type: 'singleSelect',
    options: {
      choices: [
        { name: 'InnovareAI' },
        { name: '3cubed.AI' },
        { name: 'SendingCell' },
        { name: 'WT Matchmaker' },
        { name: 'Other' }
      ]
    }
  };

  const response = await fetch(fieldUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(fieldDef)
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('❌ Error:', JSON.stringify(data, null, 2));
    return;
  }

  console.log('✅ Company field added successfully!');
  console.log(`📊 Field ID: ${data.id}\n`);
  console.log('🔗 View at:');
  console.log(`   https://airtable.com/${AIRTABLE_BASE_ID}\n`);
}

addCompanyField();
