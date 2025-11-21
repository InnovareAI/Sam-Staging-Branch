console.log('🔍 Checking all Unipile accounts\n');

try {
  const url = `https://${process.env.UNIPILE_DSN}/api/v1/accounts`;
  
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${process.env.UNIPILE_API_KEY}`,
      'Accept': 'application/json'
    }
  });

  const data = await res.json();
  
  if (!res.ok) {
    console.error('❌ Failed:', JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log('✅ Found', data.items.length, 'accounts:\n');
  
  data.items.forEach(account => {
    console.log('---');
    console.log('Name:', account.name);
    console.log('ID:', account.id);
    console.log('Provider:', account.provider);
    console.log('Type:', account.type);
    console.log('Status:', account.status || 'N/A');
  });
  
  // Look for Irish
  const irish = data.items.find(a => a.name && a.name.toLowerCase().includes('irish'));
  if (irish) {
    console.log('\n✅ Found Irish account:');
    console.log(JSON.stringify(irish, null, 2));
  }

} catch (error) {
  console.error('❌ Error:', error.message);
}
