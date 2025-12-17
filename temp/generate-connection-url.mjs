import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com';

async function generateConnectionURL() {
  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
  const userId = 'f6885ff3-deef-4781-8721-93011c990b1b';
  const workspaceUserId = `${workspaceId}:${userId}`;

  const expirationTime = new Date();
  expirationTime.setHours(expirationTime.getHours() + 1);

  // According to Unipile docs: https://developer.unipile.com/docs/hosted-auth
  const payload = {
    provider: 'LINKEDIN',
    success_redirect_url: `${SITE_URL}/linkedin-integration?status=success`,
    failure_redirect_url: `${SITE_URL}/linkedin-integration?status=error`,
    api_url: `https://${UNIPILE_DSN}`,
    name: workspaceUserId,
    expiresOn: expirationTime.toISOString()
  };

  console.log('📋 Creating hosted auth link with payload:');
  console.log(JSON.stringify(payload, null, 2));
  console.log();

  try {
    const response = await fetch(`https://${UNIPILE_DSN}/api/v1/hosted/accounts`, {
      method: 'POST',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    console.log(`📡 Response status: ${response.status}`);
    console.log(`📡 Response body: ${responseText}`);
    console.log();

    if (!response.ok) {
      throw new Error(`API error: ${response.status} - ${responseText}`);
    }

    const data = JSON.parse(responseText);
    const authUrl = data?.url || data?.link || data?.auth_url || null;

    if (authUrl) {
      // White-label the URL
      const whitelabeledUrl = authUrl.replace(
        'https://account.unipile.com',
        'https://auth.meet-sam.com'
      );

      console.log('='.repeat(70));
      console.log('✅ CONNECTION URL GENERATED');
      console.log('='.repeat(70));
      console.log();
      console.log(whitelabeledUrl);
      console.log();
      console.log('='.repeat(70));
      console.log();
      console.log('📋 Instructions:');
      console.log('   1. Copy the URL above');
      console.log('   2. Open it in your browser');
      console.log('   3. Log in with LinkedIn credentials');
      console.log('   4. After authentication, the app will sync automatically');
      console.log();
      console.log('⏰ Link expires in 1 hour');
      console.log();
    } else {
      console.error('❌ No auth URL in response:', data);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

generateConnectionURL().catch(console.error);
