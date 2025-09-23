// Debug script to check LinkedIn connection status
import fetch from 'node-fetch';

async function debugLinkedInStatus() {
  try {
    console.log('🔍 Debugging LinkedIn connection status...\n');

    // Check Unipile accounts directly
    const unipileDsn = process.env.UNIPILE_DSN;
    const unipileApiKey = process.env.UNIPILE_API_KEY;

    if (!unipileDsn || !unipileApiKey) {
      console.error('❌ Missing Unipile credentials');
      return;
    }

    console.log(`🔗 Checking accounts in Unipile (${unipileDsn})...`);
    
    const response = await fetch(`https://${unipileDsn}/api/v1/accounts`, {
      headers: {
        'X-API-KEY': unipileApiKey,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`❌ Unipile API error: ${response.status} ${response.statusText}`);
      return;
    }

    const data = await response.json();
    const accounts = Array.isArray(data) ? data : (data.items || data.accounts || []);
    
    console.log(`📊 Total accounts in Unipile: ${accounts.length}`);
    
    const linkedInAccounts = accounts.filter(acc => acc.type === 'LINKEDIN');
    console.log(`🔗 LinkedIn accounts found: ${linkedInAccounts.length}\n`);

    linkedInAccounts.forEach((account, index) => {
      console.log(`LinkedIn Account ${index + 1}:`);
      console.log(`  ID: ${account.id}`);
      console.log(`  Name: ${account.name}`);
      console.log(`  Type: ${account.type}`);
      console.log(`  Created: ${account.created_at}`);
      console.log(`  Sources: ${account.sources?.length || 0}`);
      
      if (account.sources && account.sources.length > 0) {
        account.sources.forEach((source, sIndex) => {
          console.log(`    Source ${sIndex + 1}: ${source.status} (${source.type})`);
        });
      }
      
      if (account.connection_params?.im) {
        const im = account.connection_params.im;
        console.log(`  Username: ${im.username || 'N/A'}`);
        console.log(`  Email: ${im.email || 'N/A'}`);
        console.log(`  Public ID: ${im.publicIdentifier || 'N/A'}`);
      }
      
      console.log('');
    });

    // Now check our database associations
    console.log('🗄️ Checking database associations...\n');
    
    // We can't easily query Supabase from here without more setup,
    // but we can provide the account IDs for manual association
    
    if (linkedInAccounts.length > 0) {
      console.log('🔧 To manually associate these accounts, use:');
      linkedInAccounts.forEach((account, index) => {
        console.log(`\nAccount ${index + 1} (${account.name}):`);
        console.log(`curl -X POST "https://app.meet-sam.com/api/unipile/accounts" \\`);
        console.log(`  -H "Content-Type: application/json" \\`);
        console.log(`  -d '{`);
        console.log(`    "action": "manual_associate",`);
        console.log(`    "unipile_account_id": "${account.id}"`);
        console.log(`  }'`);
      });
    }

  } catch (error) {
    console.error('❌ Error debugging LinkedIn status:', error.message);
  }
}

debugLinkedInStatus();