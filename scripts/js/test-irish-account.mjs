import { UnipileClient } from 'unipile-node-sdk';

const unipile = new UnipileClient(
  `https://${process.env.UNIPILE_DSN}`,
  process.env.UNIPILE_API_KEY
);

const unipileAccountId = 'avp6xHsCRZaP5uSPmjc2jg'; // Irish's account
const linkedinUrl = 'https://www.linkedin.com/in/testuser123';

try {
  console.log('🧪 Testing Irish\'s account (avp6xHsCRZaP5uSPmjc2jg)...\n');
  
  console.log('Step 1: Fetching profile...');
  const profile = await unipile.users.getProfile({
    account_id: unipileAccountId,
    identifier: linkedinUrl
  });
  console.log('✅ Profile found:', profile.provider_id);
  
  console.log('\nStep 2: Sending invitation...');
  const result = await unipile.users.sendInvitation({
    account_id: unipileAccountId,
    provider_id: profile.provider_id,
    message: 'Hi! Test connection request.'
  });
  console.log('✅ Success:', result);
} catch (error) {
  console.error('\n❌ ERROR DETAILS:');
  console.error('Message:', error.message);
  console.error('Status:', error.status);
  console.error('Response:', error.response?.data || 'N/A');
}
