#!/usr/bin/env node

/**
 * Create Deleted Users Table in Airtable
 * Tracks users that have been deleted from the system
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local'), override: true });

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

const deletedUsersTableDef = {
  name: 'Deleted Users',
  fields: [
    { name: 'Supabase ID', type: 'singleLineText' },
    { name: 'Email', type: 'email' },
    { name: 'First Name', type: 'singleLineText' },
    { name: 'Last Name', type: 'singleLineText' },
    {
      name: 'Deletion Date',
      type: 'dateTime',
      options: {
        dateFormat: { name: 'iso' },
        timeFormat: { name: '24hour' },
        timeZone: 'utc'
      }
    },
    { name: 'Deleted By', type: 'singleLineText' },
    { name: 'Reason', type: 'multilineText' },
    { name: 'Backup Reference', type: 'singleLineText' }
  ]
};

async function createTable() {
  const url = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(deletedUsersTableDef)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(JSON.stringify(data, null, 2));
    }

    console.log('✅ Deleted Users table created successfully!');
    console.log(`📊 Table ID: ${data.id}`);
    console.log(`📋 Fields: ${deletedUsersTableDef.fields.length}`);
    console.log('');
    console.log('🔗 View at:');
    console.log(`   https://airtable.com/${AIRTABLE_BASE_ID}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createTable();
