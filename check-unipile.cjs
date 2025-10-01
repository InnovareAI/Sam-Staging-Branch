require('dotenv').config({ path: '.env.local' });

async function checkUnipileAccounts() {
  const unipileDsn = process.env.UNIPILE_DSN;
  const unipileApiKey = process.env.UNIPILE_API_KEY;
  
  const response = await fetch(`https://${unipileDsn}/api/v1/accounts`, {
    headers: {
      'X-API-KEY': unipileApiKey,
      'Accept': 'application/json'
    }
  });
  
  const data = await response.json();
  const linkedInAccounts = data.items?.filter(acc => acc.type === 'LINKEDIN') || [];
  
  console.log(`\n📊 Found ${linkedInAccounts.length} LinkedIn accounts in Unipile:\n`);
  
  linkedInAccounts.forEach((acc, i) => {
    console.log(`${i+1}. ${acc.name}`);
    console.log(`   ID: ${acc.id}`);
    console.log(`   Email: ${acc.connection_params?.im?.email || 'N/A'}`);
    console.log(`   LinkedIn ID: ${acc.connection_params?.im?.id || 'N/A'}`);
    console.log(`   Status: ${acc.sources?.[0]?.status || 'Unknown'}`);
    console.log(`   Created: ${new Date(acc.created_at).toLocaleString()}`);
    console.log('');
  });
  
  // Check for duplicates
  const emailMap = new Map();
  const linkedInIdMap = new Map();
  
  linkedInAccounts.forEach(acc => {
    const email = acc.connection_params?.im?.email;
    const linkedInId = acc.connection_params?.im?.id;
    
    if (email) {
      if (!emailMap.has(email)) emailMap.set(email, []);
      emailMap.set(email, [...emailMap.get(email), acc]);
    }
    
    if (linkedInId) {
      if (!linkedInIdMap.has(linkedInId)) linkedInIdMap.set(linkedInId, []);
      linkedInIdMap.set(linkedInId, [...linkedInIdMap.get(linkedInId), acc]);
    }
  });
  
  console.log('\n🔍 Duplicate Detection:\n');
  
  let hasDuplicates = false;
  for (const [email, accounts] of emailMap.entries()) {
    if (accounts.length > 1) {
      hasDuplicates = true;
      console.log(`❌ Duplicate by email (${email}): ${accounts.length} accounts`);
      accounts.forEach(acc => console.log(`   - ${acc.id} (created ${new Date(acc.created_at).toLocaleString()})`));
    }
  }
  
  for (const [linkedInId, accounts] of linkedInIdMap.entries()) {
    if (accounts.length > 1) {
      hasDuplicates = true;
      console.log(`❌ Duplicate by LinkedIn ID (${linkedInId}): ${accounts.length} accounts`);
      accounts.forEach(acc => console.log(`   - ${acc.id} (created ${new Date(acc.created_at).toLocaleString()})`));
    }
  }
  
  if (!hasDuplicates) {
    console.log('✅ No duplicates found!');
  }
}

checkUnipileAccounts().catch(console.error);
