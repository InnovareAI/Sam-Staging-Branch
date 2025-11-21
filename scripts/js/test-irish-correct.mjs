const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const irishAccountId = 'ymtTx4xVQ6OVUFk83ctwtA';
const linkedinUrl = 'http://www.linkedin.com/in/elutsch';

console.log('🧪 Testing Irish account with correct ID\n');
console.log('Account:', irishAccountId);
console.log('Target:', linkedinUrl);
console.log('');

try {
  console.log('1️⃣  Fetching profile...');
  const profileUrl = `https://${UNIPILE_DSN}/api/v1/users/profile?account_id=${irishAccountId}&identifier=${encodeURIComponent(linkedinUrl)}`;

  const profileRes = await fetch(profileUrl, {
    headers: {
      'Authorization': `Bearer ${UNIPILE_API_KEY}`,
      'Accept': 'application/json'
    }
  });

  console.log('Status:', profileRes.status);
  const profileData = await profileRes.json();

  if (!profileRes.ok) {
    console.error('❌ Failed:', JSON.stringify(profileData, null, 2));
    process.exit(1);
  }

  console.log('✅ Profile:', profileData.display_name);
  console.log('Provider ID:', profileData.provider_id);

  console.log('\n2️⃣  Sending connection request...');
  const inviteUrl = `https://${UNIPILE_DSN}/api/v1/users/invitation`;

  const inviteRes = await fetch(inviteUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${UNIPILE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      account_id: irishAccountId,
      provider_id: profileData.provider_id,
      message: 'Hi Erik! I work with early-stage founders on scaling outbound. Open to connecting?'
    })
  });

  console.log('Status:', inviteRes.status);
  const inviteData = await inviteRes.json();

  if (!inviteRes.ok) {
    console.error('❌ Failed:', JSON.stringify(inviteData, null, 2));
    process.exit(1);
  }

  console.log('\n✅✅✅ SUCCESS! CONNECTION REQUEST SENT! ✅✅✅\n');
  console.log(JSON.stringify(inviteData, null, 2));

} catch (error) {
  console.error('❌ Error:', error.message);
}
