#!/usr/bin/env node

const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

async function checkEmailAccounts() {
  try {
    console.log('🔍 Checking Unipile accounts for email providers...\n');

    const response = await fetch(`https://${UNIPILE_DSN}/api/v1/accounts`, {
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('❌ API error:', response.status, response.statusText);
      return;
    }

    const data = await response.json();
    const accounts = Array.isArray(data) ? data : (data.items || []);

    console.log(`Found ${accounts.length} total accounts\n`);

    const emailAccounts = accounts.filter(a =>
      a.provider === 'GMAIL' ||
      a.provider === 'OUTLOOK' ||
      a.provider === 'MICROSOFT'
    );

    console.log(`📧 Email accounts: ${emailAccounts.length}\n`);

    emailAccounts.forEach(acc => {
      console.log(`Account ID: ${acc.id}`);
      console.log(`  Provider: ${acc.provider}`);
      console.log(`  Status: ${acc.connection_status}`);
      console.log(`  Email: ${acc.connection_params?.email?.email || 'N/A'}`);
      console.log(`  Name: ${acc.connection_params?.email?.name || 'N/A'}`);
      console.log('');
    });

    if (emailAccounts.length === 0) {
      console.log('⚠️  No email accounts connected');
      console.log('\nTo add an email account:');
      console.log('1. Go to Settings → Integrations');
      console.log('2. Connect Gmail or Outlook');
      console.log('3. Follow the OAuth flow');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkEmailAccounts();
