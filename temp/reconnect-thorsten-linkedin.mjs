import { createClient } from '@supabase/supabase-js';
import { UnipileClient } from 'unipile-node-sdk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com';

async function callUnipileAPI(endpoint, method = 'GET', body = null) {
  const url = `https://${UNIPILE_DSN}/api/v1/${endpoint}`;
  const options = {
    method,
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Accept': 'application/json',
      ...(body && { 'Content-Type': 'application/json' })
    },
    ...(body && { body: JSON.stringify(body) })
  };

  const response = await fetch(url, options);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Unipile API error: ${response.status} - ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function reconnectThorstenAccount() {
  const accountId = 'mERQmojtSZq5GeomZZazlw';
  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
  const userId = 'f6885ff3-deef-4781-8721-93011c990b1b';

  console.log('='.repeat(70));
  console.log('🔧 RECONNECTING THORSTEN LINZ LINKEDIN ACCOUNT');
  console.log('='.repeat(70));
  console.log();

  // Step 1: Force delete the account from Unipile (ignore errors)
  console.log('Step 1: Deleting stale account from Unipile...');
  try {
    await callUnipileAPI(`accounts/${accountId}`, 'DELETE');
    console.log('✅ Successfully deleted from Unipile');
  } catch (error) {
    console.log(`⚠️  Unipile delete failed (expected for CREDENTIALS status): ${error.message}`);
    console.log('   Continuing with database cleanup...');
  }
  console.log();

  // Step 2: Delete from database
  console.log('Step 2: Cleaning up database record...');
  const { error: deleteError } = await supabase
    .from('workspace_accounts')
    .delete()
    .eq('unipile_account_id', accountId);

  if (deleteError) {
    console.error('❌ Database delete failed:', deleteError);
    return;
  }
  console.log('✅ Database record deleted');
  console.log();

  // Step 3: Generate new connection URL using Unipile SDK
  console.log('Step 3: Generating new connection URL...');

  const client = new UnipileClient(`https://${UNIPILE_DSN}`, UNIPILE_API_KEY);

  const workspaceUserId = `${workspaceId}:${userId}`;
  const expirationTime = new Date();
  expirationTime.setHours(expirationTime.getHours() + 1);

  const payload = {
    type: 'create',
    api_url: `https://${UNIPILE_DSN}`,
    expiresOn: expirationTime.toISOString(),
    providers: ['LINKEDIN'],
    success_redirect_url: `${SITE_URL}/linkedin-integration?success=true`,
    failure_redirect_url: `${SITE_URL}/linkedin-integration?error=Authentication+failed`,
    notify_url: `${SITE_URL}/api/linkedin/callback`,
    name: workspaceUserId
  };

  let authUrl = null;

  try {
    const response = await client.account.createHostedAuthLink(payload);
    authUrl = response?.url || response?.link || response?.auth_url || null;

    if (authUrl) {
      // White-label the URL
      const whitelabeledUrl = authUrl.replace(
        'https://account.unipile.com',
        'https://auth.meet-sam.com'
      );

      console.log('✅ Connection URL generated successfully!');
      console.log();
      console.log('='.repeat(70));
      console.log('🔗 RECONNECTION LINK (click or copy to browser):');
      console.log('='.repeat(70));
      console.log();
      console.log(whitelabeledUrl);
      console.log();
      console.log('='.repeat(70));
      console.log();
      console.log('📋 Instructions:');
      console.log('   1. Click the link above or copy it to your browser');
      console.log('   2. Log in with your LinkedIn credentials');
      console.log('   3. After authentication, return to the app');
      console.log('   4. Your LinkedIn account will be reconnected');
      console.log();
      console.log('⏰ This link expires in 1 hour');
      console.log();
    } else {
      throw new Error('No auth URL in response');
    }
  } catch (error) {
    console.error('❌ Failed to generate connection URL:', error.message);
    console.log();
    console.log('🔄 Fallback: Use the UI to reconnect');
    console.log('   1. Go to: https://app.meet-sam.com/linkedin-integration');
    console.log('   2. Click "Connect LinkedIn" button');
    console.log('   3. Follow the authentication flow');
  }
}

reconnectThorstenAccount().catch(console.error);
