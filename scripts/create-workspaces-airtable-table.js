#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local'), override: true });

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

const workspacesTableDef = {
  name: 'Workspaces',
  fields: [
    { name: 'Supabase ID', type: 'singleLineText' },
    { name: 'Workspace Name', type: 'singleLineText' },
    { name: 'Client Code', type: 'singleLineText' },
    {
      name: 'Reseller',
      type: 'singleSelect',
      options: {
        choices: [
          { name: 'InnovareAI' },
          { name: '3cubed' }
        ]
      }
    },
    { name: 'Owner ID', type: 'singleLineText' },
    {
      name: 'Status',
      type: 'singleSelect',
      options: {
        choices: [
          { name: 'active' },
          { name: 'inactive' },
          { name: 'trial' }
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
    }
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
      body: JSON.stringify(workspacesTableDef)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(JSON.stringify(data, null, 2));
    }

    console.log('✅ Workspaces table created successfully!');
    console.log(`📊 Table ID: ${data.id}`);
    console.log(`📋 Fields: ${workspacesTableDef.fields.length}`);
    console.log('');
    console.log('🔗 View at:');
    console.log(`   https://airtable.com/${AIRTABLE_BASE_ID}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createTable();
