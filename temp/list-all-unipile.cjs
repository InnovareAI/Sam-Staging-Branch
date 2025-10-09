require('dotenv').config({ path: '.env.local' });

async function listAllAccounts() {
  try {
    const unipileDsn = process.env.UNIPILE_DSN;
    const unipileKey = process.env.UNIPILE_API_KEY;

    const response = await fetch(`https://${unipileDsn}/api/v1/accounts`, {
      headers: {
        'X-API-KEY': unipileKey,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.log('❌ Unipile API error:', response.status);
      return;
    }

    const data = await response.json();
    const accounts = Array.isArray(data) ? data : (data.items || data.accounts || []);

    console.log('📊 All Unipile accounts:');
    console.log('');

    accounts.forEach((acc, i) => {
      console.log(`${i + 1}. ID: ${acc.id}`);
      console.log(`   Name: ${acc.name || 'Unknown'}`);
      console.log(`   Provider: ${acc.provider || 'Not set'}`);
      console.log(`   Type: ${acc.type || 'Not set'}`);
      console.log(`   Email: ${acc.email || 'Not set'}`);

      if (acc.sources && acc.sources.length > 0) {
        console.log(`   Source Provider: ${acc.sources[0].provider || 'Not set'}`);
        console.log(`   Source Status: ${acc.sources[0].status || 'Unknown'}`);
      }

      console.log('');
    });

  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

listAllAccounts().then(() => process.exit(0));
