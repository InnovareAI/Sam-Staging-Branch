#!/usr/bin/env node

/**
 * Update Company field name to Reseller in Airtable Users table
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local'), override: true });

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

async function updateFieldToReseller() {
  console.log('📝 Updating Company field to Reseller...\n');

  // Get Users table
  const tablesUrl = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;
  const tablesResponse = await fetch(tablesUrl, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` }
  });
  const tablesData = await tablesResponse.json();
  const usersTable = tablesData.tables.find(t => t.name === 'Users');

  // Find Company field
  const companyField = usersTable.fields.find(f => f.name === 'Company');

  if (!companyField) {
    console.error('❌ Company field not found');
    return;
  }

  // Update field name and options
  const fieldUrl = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables/${usersTable.id}/fields/${companyField.id}`;

  const updateDef = {
    name: 'Reseller',
    options: {
      choices: [
        { name: 'InnovareAI' },
        { name: '3cubed.AI' }
      ]
    }
  };

  const response = await fetch(fieldUrl, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updateDef)
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('❌ Error:', JSON.stringify(data, null, 2));
    return;
  }

  console.log('✅ Field updated to "Reseller" successfully!');
  console.log('📊 Options: InnovareAI, 3cubed.AI\n');
}

updateFieldToReseller();
