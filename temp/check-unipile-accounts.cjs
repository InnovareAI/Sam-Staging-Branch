require('dotenv').config({ path: '.env.local' });

async function checkUnipileAccounts() {
  try {
    const unipileDsn = process.env.UNIPILE_DSN;
    const unipileKey = process.env.UNIPILE_API_KEY;

    if (!unipileDsn || !unipileKey) {
      console.log('❌ Unipile credentials not found in .env.local');
      return;
    }

    const response = await fetch(`https://${unipileDsn}/api/v1/accounts`, {
      headers: {
        'X-API-KEY': unipileKey,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const text = await response.text();
      console.log('❌ Unipile API error:', response.status, response.statusText);
      console.log('   Response:', text.slice(0, 200));
      return;
    }

    const data = await response.json();
    const accounts = Array.isArray(data) ? data : (data.items || data.accounts || []);

    const linkedinAccounts = accounts.filter(acc =>
      acc.provider === 'LINKEDIN' ||
      acc.type === 'linkedin' ||
      (acc.sources && acc.sources[0]?.provider === 'LINKEDIN')
    );

    console.log('✅ Total Unipile accounts:', accounts.length);
    console.log('✅ LinkedIn accounts found:', linkedinAccounts.length);
    console.log('');

    if (linkedinAccounts.length === 0) {
      console.log('⚠️  No LinkedIn accounts found in Unipile');
      console.log('   This means the LinkedIn OAuth connection was also lost');
      return [];
    }

    linkedinAccounts.forEach((acc, i) => {
      const status = acc.sources?.[0]?.status || acc.status || 'Unknown';
      console.log(`${i + 1}. Unipile Account ID: ${acc.id}`);
      console.log(`   Name: ${acc.name || 'Unknown'}`);
      console.log(`   Email: ${acc.email || 'Not available'}`);
      console.log(`   Status: ${status}`);
      console.log(`   Provider: ${acc.provider || acc.type || 'Unknown'}`);
      console.log('');
    });

    return linkedinAccounts;

  } catch (error) {
    console.log('❌ Error checking Unipile accounts:', error.message);
    return [];
  }
}

checkUnipileAccounts().then(accounts => {
  if (accounts && accounts.length > 0) {
    console.log('📋 Next step: Re-associate these accounts with user/workspace in database');
  }
  process.exit(0);
});
