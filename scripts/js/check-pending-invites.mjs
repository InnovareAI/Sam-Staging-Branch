// Check pending invitations on Irish's account
const DSN = 'api6.unipile.com:13670';
const API_KEY = '8QrwPJ9i.1dX5352mYYWLctVvd1QWgh4/krY+wWg1tJE87IavwGc=';
const accountId = 'ymtTx4xVQ6OVUFk83ctwtA'; // Irish's account

console.log('🔍 Checking pending invitations on Irish\'s LinkedIn account\n');

try {
  // Try to get sent invitations
  const response = await fetch(
    `https://${DSN}/api/v1/users/invitations?account_id=${accountId}&status=pending`,
    {
      headers: {
        'X-Api-Key': API_KEY,
        'Accept': 'application/json'
      }
    }
  );

  console.log(`Status: ${response.status}`);

  if (response.ok) {
    const data = await response.json();
    console.log('Pending invitations:', JSON.stringify(data, null, 2));
  } else {
    const error = await response.json();
    console.log('Error:', JSON.stringify(error, null, 2));
  }

  // Also try alternative endpoint
  console.log('\n🔍 Trying alternative endpoint...\n');

  const response2 = await fetch(
    `https://${DSN}/api/v1/chats?account_id=${accountId}&limit=50`,
    {
      headers: {
        'X-Api-Key': API_KEY,
        'Accept': 'application/json'
      }
    }
  );

  console.log(`Status: ${response2.status}`);

  if (response2.ok) {
    const data2 = await response2.json();
    console.log('Recent connections:', JSON.stringify(data2, null, 2));
  } else {
    const error2 = await response2.json();
    console.log('Error:', JSON.stringify(error2, null, 2));
  }

} catch (error) {
  console.error('Failed:', error.message);
}
