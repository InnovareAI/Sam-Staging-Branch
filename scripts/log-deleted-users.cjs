#!/usr/bin/env node

require('dotenv').config({ path: '.env.local', override: true });

const DELETED_USERS = [
  {
    id: '592a5d43-d12b-4f7e-a94c-2edb7a44dae2',
    email: 'tl+2@chillmine.io',
    first_name: 'Tom',
    last_name: 'Lee',
    reason: 'Test user - email alias'
  },
  {
    id: 'c24fa9b0-272b-44d9-bc70-baac07c7b6b1',
    email: 'tl+10@innovareai.com',
    first_name: 'tom',
    last_name: 'lee',
    reason: 'Test user - email alias'
  },
  {
    id: 'fb36a7d8-1b4a-4dd5-a0d6-c80420341688',
    email: 'tl+15@innvoareai.com',
    first_name: 'tom',
    last_name: 'lee',
    reason: 'Test user - email alias with typo in domain'
  }
];

async function logDeletedUsers() {
  const Airtable = require('airtable');
  const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
  const base = airtable.base(process.env.AIRTABLE_BASE_ID);

  const timestamp = new Date().toISOString();

  console.log('📝 Logging deleted users to Airtable...\n');

  for (const user of DELETED_USERS) {
    await base('Deleted Users').create({
      'Supabase ID': user.id,
      'Email': user.email,
      'First Name': user.first_name,
      'Last Name': user.last_name,
      'Deletion Date': timestamp,
      'Deleted By': 'System cleanup script',
      'Reason': user.reason,
      'Backup Reference': 'Before deleting test users'
    });
    console.log(`✅ Logged: ${user.email}`);
  }

  console.log('\n✅ All deleted users logged to Airtable');
  console.log(`🔗 View: https://airtable.com/${process.env.AIRTABLE_BASE_ID}\n`);
}

logDeletedUsers().then(() => process.exit(0));
