const michelleAccountId = 'MT39bAEDTJ6e_ZPY337UgQ';
const linkedinUrl = 'http://www.linkedin.com/in/elutsch';

console.log('🧪 Testing Michelle account\n');

try {
  const profileUrl = `https://${process.env.UNIPILE_DSN}/api/v1/users/profile?account_id=${michelleAccountId}&identifier=${encodeURIComponent(linkedinUrl)}`;

  const profileRes = await fetch(profileUrl, {
    headers: {
      'Authorization': `Bearer ${process.env.UNIPILE_API_KEY}`,
      'Accept': 'application/json'
    }
  });

  const profileData = await profileRes.json();

  if (!profileRes.ok) {
    console.error('❌ Profile failed:', JSON.stringify(profileData, null, 2));
    process.exit(1);
  }

  console.log('✅ Profile found:', profileData.display_name);

  const inviteUrl = `https://${process.env.UNIPILE_DSN}/api/v1/users/invitation`;

  const inviteRes = await fetch(inviteUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.UNIPILE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      account_id: michelleAccountId,
      provider_id: profileData.provider_id,
      message: 'Hi Erik! I work with early-stage founders. Open to connecting?'
    })
  });

  const inviteData = await inviteRes.json();

  if (!inviteRes.ok) {
    console.error('❌ Invite failed:', JSON.stringify(inviteData, null, 2));
    process.exit(1);
  }

  console.log('\n✅✅✅ SUCCESS! CONNECTION REQUEST SENT! ✅✅✅\n');

} catch (error) {
  console.error('❌ Error:', error.message);
}
