#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyApiKey() {
  const testKey = 'sk_live_qbfolkYqB1ZMDeqEKpfaffdop1g1L';
  const keyHash = crypto.createHash('sha256').update(testKey).digest('hex');

  console.log('\n🔍 Verifying API Key...\n');
  console.log('Test Key:', testKey);
  console.log('Key Hash:', keyHash);
  console.log('');

  // Check if key exists in database
  const { data: apiKeyRecord, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('key_hash', keyHash)
    .single();

  if (error) {
    console.error('❌ Error looking up key:', error.message);

    // List all keys
    const { data: allKeys } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, workspace_id, is_active, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    console.log('\n📋 Recent API keys in database:');
    if (allKeys && allKeys.length > 0) {
      allKeys.forEach((key, i) => {
        console.log(`  ${i + 1}. ${key.name}`);
        console.log(`     Prefix: ${key.key_prefix}`);
        console.log(`     Workspace: ${key.workspace_id}`);
        console.log(`     Active: ${key.is_active}`);
        console.log(`     Created: ${key.created_at}`);
        console.log('');
      });
    } else {
      console.log('  No API keys found!');
    }

    return;
  }

  console.log('✅ API Key Found in Database!\n');
  console.log('Details:');
  console.log('  ID:', apiKeyRecord.id);
  console.log('  Name:', apiKeyRecord.name);
  console.log('  Workspace ID:', apiKeyRecord.workspace_id);
  console.log('  Prefix:', apiKeyRecord.key_prefix);
  console.log('  Active:', apiKeyRecord.is_active);
  console.log('  Scopes:', apiKeyRecord.scopes);
  console.log('  Expires:', apiKeyRecord.expires_at || 'Never');
  console.log('  Created:', apiKeyRecord.created_at);
  console.log('');

  // Test if it matches validation logic
  if (!apiKeyRecord.is_active) {
    console.log('❌ Key is inactive!');
    return;
  }

  if (apiKeyRecord.expires_at && new Date(apiKeyRecord.expires_at) < new Date()) {
    console.log('❌ Key is expired!');
    return;
  }

  const requiredScope = 'linkedin:comment:generate';
  if (!apiKeyRecord.scopes || !apiKeyRecord.scopes.includes(requiredScope)) {
    console.log(`❌ Key missing required scope: ${requiredScope}`);
    return;
  }

  console.log('✅ All validation checks passed!');
  console.log('✅ This key should work with the API');
}

verifyApiKey()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Script error:', err);
    process.exit(1);
  });
