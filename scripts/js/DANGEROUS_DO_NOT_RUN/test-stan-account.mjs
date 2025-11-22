import { UnipileClient } from 'unipile-node-sdk';

const unipile = new UnipileClient(
  `https://${process.env.UNIPILE_DSN}`,
  process.env.UNIPILE_API_KEY
);

// Stan's Unipile account ID
const accountId = '4Vv6oZ73RvarImDN6iYbbg';

console.log('🔍 Testing Stan Bounev account...\n');

try {
  const account = await unipile.accounts.get(accountId);
  console.log('✅ Account found:', {
    id: account.id,
    provider: account.provider,
    name: account.name,
    email: account.email,
    status: account.status
  });

  // Try to get profile to test if connection works
  const profile = await unipile.users.getProfile({
    account_id: accountId,
    identifier: 'me'
  });

  console.log('\n✅ Profile fetch successful:', {
    name: profile.name,
    headline: profile.headline
  });

} catch (error) {
  console.error('\n❌ Error:', {
    message: error.message,
    status: error.status,
    type: error.type,
    title: error.title
  });
}
