#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');

async function testConnection() {
  console.log('🔍 Testing Airtable Connection');
  console.log('='.repeat(60));
  console.log('');

  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  console.log('API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT FOUND');
  console.log('Base ID:', baseId || 'NOT FOUND');
  console.log('');

  if (!apiKey || !baseId) {
    console.log('❌ Missing credentials');
    return;
  }

  try {
    const airtable = new Airtable({ apiKey });
    const base = airtable.base(baseId);

    console.log('📋 Attempting to list tables in base...');

    // Try to query the "Workspace Accounts" table
    const records = await base('Workspace Accounts')
      .select({ maxRecords: 1 })
      .firstPage();

    console.log('✅ Connection successful!');
    console.log(`   Found ${records.length} record(s) in Workspace Accounts table`);
    console.log('');

  } catch (error) {
    console.log('❌ Connection failed!');
    console.log('');
    console.log('Error:', error.message);
    console.log('');

    if (error.message.includes('api key')) {
      console.log('💡 API Key Issue:');
      console.log('   1. Go to: https://airtable.com/create/tokens');
      console.log('   2. Make sure token has these scopes:');
      console.log('      - data.records:read');
      console.log('      - data.records:write');
      console.log('      - schema.bases:read');
      console.log('   3. Make sure token has access to base: appOtsfn60HFeTpnn');
      console.log('');
    } else if (error.message.includes('NOT_FOUND') || error.message.includes('table')) {
      console.log('💡 Table Not Found:');
      console.log('   Make sure you created a table named "Workspace Accounts"');
      console.log('   in your base: https://airtable.com/appOtsfn60HFeTpnn');
      console.log('');
    }
  }
}

testConnection().then(() => process.exit(0));
