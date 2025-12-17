import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

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

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Unipile API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

async function fixAccount() {
  const accountId = 'mERQmojtSZq5GeomZZazlw';

  console.log('🔧 Fixing Thorsten Linz LinkedIn account...\n');

  // Step 1: Delete from Unipile (force delete even with CREDENTIALS status)
  console.log('Step 1: Deleting account from Unipile...');
  try {
    await callUnipileAPI(`accounts/${accountId}`, 'DELETE');
    console.log('✅ Successfully deleted from Unipile');
  } catch (error) {
    console.log(`⚠️  Unipile delete failed (might be OK): ${error.message}`);
  }

  // Step 2: Update database to disconnected status
  console.log('\nStep 2: Updating database...');
  const { data: updated, error: updateError } = await supabase
    .from('workspace_accounts')
    .update({
      connection_status: 'disconnected',
      unipile_sources: [{ id: `${accountId}_MESSAGING`, status: 'CREDENTIALS' }],
      error_details: 'Account requires re-authentication',
      updated_at: new Date().toISOString()
    })
    .eq('unipile_account_id', accountId)
    .select();

  if (updateError) {
    console.error('❌ Database update failed:', updateError);
    return;
  }

  console.log('✅ Database updated:', updated);

  // Step 3: Generate new connection URL
  console.log('\nStep 3: Generating new connection URL...');
  try {
    const result = await callUnipileAPI('hosted/accounts', 'POST', {
      provider: 'LINKEDIN',
      success_redirect_url: 'https://app.meet-sam.com/linkedin-integration?status=success',
      error_redirect_url: 'https://app.meet-sam.com/linkedin-integration?status=error'
    });

    console.log('✅ New connection URL generated:');
    console.log('\n🔗 RECONNECTION LINK:');
    console.log(result.url);
    console.log('\n📋 Copy this link and visit it to reconnect your LinkedIn account.');
  } catch (error) {
    console.error('❌ Failed to generate connection URL:', error.message);
  }
}

fixAccount().catch(console.error);
