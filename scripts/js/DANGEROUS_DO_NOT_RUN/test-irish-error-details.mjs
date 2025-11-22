const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const irishAccountId = 'ymtTx4xVQ6OVUFk83ctwtA';
const linkedinUrl = 'http://www.linkedin.com/in/elutsch';

console.log('🧪 Testing Irish account with full error details\n');
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
    // Capture full error details like the new code does
    const errorDetails = {
      message: profileData.message || 'Unknown error',
      status: profileRes.status,
      type: profileData.type,
      title: profileData.title,
      response: profileData
    };

    console.log('\n❌ Profile fetch failed:');
    console.log(JSON.stringify(errorDetails, null, 2));

    // Show what the error message would be
    const errorMessage = profileData.title || profileData.message || 'Unknown error';
    const errorNote = `CR failed: ${errorMessage}${profileRes.status ? ` (${profileRes.status})` : ''}${profileData.type ? ` [${profileData.type}]` : ''}`;
    console.log('\n📝 Error note that would be stored:');
    console.log(errorNote);

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
      message: 'Hi Erik! Test connection request.'
    })
  });

  console.log('Status:', inviteRes.status);
  const inviteData = await inviteRes.json();

  if (!inviteRes.ok) {
    // Capture full error details
    const errorDetails = {
      message: inviteData.message || 'Unknown error',
      status: inviteRes.status,
      type: inviteData.type,
      title: inviteData.title,
      response: inviteData
    };

    console.log('\n❌ Invitation failed:');
    console.log(JSON.stringify(errorDetails, null, 2));

    // Show what the error message would be
    const errorMessage = inviteData.title || inviteData.message || 'Unknown error';
    const errorNote = `CR failed: ${errorMessage}${inviteRes.status ? ` (${inviteRes.status})` : ''}${inviteData.type ? ` [${inviteData.type}]` : ''}`;
    console.log('\n📝 Error note that would be stored:');
    console.log(errorNote);

    process.exit(1);
  }

  console.log('\n✅✅✅ SUCCESS! CONNECTION REQUEST SENT! ✅✅✅\n');
  console.log(JSON.stringify(inviteData, null, 2));

} catch (error) {
  console.error('\n❌ Fatal error:', error.message);
  console.error('Stack:', error.stack);
}
