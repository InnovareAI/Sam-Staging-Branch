import { UnipileClient } from 'unipile-node-sdk';

const unipile = new UnipileClient(
  `https://${process.env.UNIPILE_DSN}`,
  process.env.UNIPILE_API_KEY
);

const irishAccountId = 'avp6xHsCRZaP5uSPmjc2jg';
const linkedinUrl = 'http://www.linkedin.com/in/elutsch';

console.log('🧪 Testing Irish\'s account with Erik Lutsch\n');
console.log('Irish Account ID:', irishAccountId);
console.log('LinkedIn URL:', linkedinUrl);

try {
  console.log('\n1️⃣  Fetching Erik\'s profile...');
  const profile = await unipile.users.getProfile({
    account_id: irishAccountId,
    identifier: linkedinUrl
  });
  console.log('✅ Profile found!');
  console.log('   Provider ID:', profile.provider_id);
  console.log('   Name:', profile.display_name);
  
  console.log('\n2️⃣  Sending connection request...');
  const result = await unipile.users.sendInvitation({
    account_id: irishAccountId,
    provider_id: profile.provider_id,
    message: 'Hi Erik, I work with early-stage founders. Open to connecting?'
  });
  console.log('✅ CONNECTION REQUEST SENT!');
  console.log('   Result:', JSON.stringify(result, null, 2));
} catch (error) {
  console.error('\n❌ ERROR:');
  console.error('   Message:', error.message);
  console.error('   Status:', error.status);
  if (error.response?.data) {
    console.error('   Response:', JSON.stringify(error.response.data, null, 2));
  }
}
