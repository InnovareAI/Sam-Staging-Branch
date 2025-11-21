const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const irishAccountId = 'avp6xHsCRZaP5uSPmjc2jg';
const linkedinUrl = 'http://www.linkedin.com/in/elutsch';

console.log('🧪 Testing Irish account with raw fetch\n');
console.log('Irish Account:', irishAccountId);
console.log('LinkedIn URL:', linkedinUrl);
console.log('');

try {
  // Step 1: Get profile
  console.log('1️⃣  Fetching LinkedIn profile...');
  const profileUrl = `https://${UNIPILE_DSN}/api/v1/users/profile?account_id=${irishAccountId}&identifier=${encodeURIComponent(linkedinUrl)}`;

  const profileRes = await fetch(profileUrl, {
    headers: {
      'Authorization': `Bearer ${UNIPILE_API_KEY}`,
      'Accept': 'application/json'
    }
  });

  console.log('   Status:', profileRes.status);
  const profileData = await profileRes.json();

  if (!profileRes.ok) {
    console.error('❌ Profile fetch failed:');
    console.error(JSON.stringify(profileData, null, 2));
    process.exit(1);
  }

  console.log('✅ Profile found!');
  console.log('   Provider ID:', profileData.provider_id);
  console.log('   Name:', profileData.display_name);

  // Step 2: Send invitation
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
      message: 'Hi Erik! I work with early-stage founders. Open to connecting?'
    })
  });

  console.log('   Status:', inviteRes.status);
  const inviteData = await inviteRes.json();

  if (!inviteRes.ok) {
    console.error('❌ Invitation failed:');
    console.error(JSON.stringify(inviteData, null, 2));
    process.exit(1);
  }

  console.log('✅ CONNECTION REQUEST SENT SUCCESSFULLY!');
  console.log(JSON.stringify(inviteData, null, 2));

} catch (error) {
  console.error('❌ Fatal error:', error.message);
  console.error(error.stack);
}
