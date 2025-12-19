/**
 * Create API Key for Chrome Extension
 * Usage: node scripts/create-api-key.cjs "Key Name" workspace-id
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Generate a secure API key
 * Format: sk_live_[32 random chars]
 */
function generateApiKey() {
  const randomBytes = crypto.randomBytes(24);
  const keyString = randomBytes.toString('base64')
    .replace(/\+/g, '')
    .replace(/\//g, '')
    .replace(/=/g, '')
    .substring(0, 32);

  return `sk_live_${keyString}`;
}

/**
 * Hash API key for storage
 */
function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

async function createApiKey(name, workspaceId) {
  console.log('\n🔑 Creating API Key...\n');

  // Validate workspace exists
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('id', workspaceId)
    .single();

  if (wsError || !workspace) {
    console.error('❌ Workspace not found:', workspaceId);
    console.error('   Error:', wsError?.message);
    process.exit(1);
  }

  console.log(`📋 Workspace: ${workspace.name}`);
  console.log(`   ID: ${workspace.id}\n`);

  // Generate API key
  const apiKey = generateApiKey();
  const keyHash = hashApiKey(apiKey);
  const keyPrefix = apiKey.substring(0, 16); // sk_live_abc123de

  // Store in database
  const { data: savedKey, error: saveError } = await supabase
    .from('api_keys')
    .insert({
      workspace_id: workspaceId,
      name: name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      scopes: ['linkedin:comment:generate'],
      is_active: true,
      expires_at: null // No expiration
    })
    .select()
    .single();

  if (saveError) {
    console.error('❌ Failed to create API key:', saveError.message);
    process.exit(1);
  }

  console.log('✅ API Key Created Successfully!\n');
  console.log('━'.repeat(70));
  console.log('🔑 API KEY (SAVE THIS - IT WILL NOT BE SHOWN AGAIN):');
  console.log('━'.repeat(70));
  console.log(apiKey);
  console.log('━'.repeat(70));
  console.log('\n📋 Key Details:');
  console.log(`   Name: ${savedKey.name}`);
  console.log(`   Prefix: ${savedKey.key_prefix}...`);
  console.log(`   Workspace: ${workspace.name}`);
  console.log(`   Scopes: ${savedKey.scopes.join(', ')}`);
  console.log(`   Created: ${new Date(savedKey.created_at).toLocaleString()}`);
  console.log(`   Expires: Never\n`);

  console.log('⚠️  IMPORTANT:');
  console.log('   • Copy this API key now - you cannot retrieve it later');
  console.log('   • Store it securely (password manager, .env file, etc.)');
  console.log('   • Use it in the Chrome extension configuration');
  console.log('   • Do not share it or commit it to version control\n');

  return apiKey;
}

// Parse arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node scripts/create-api-key.cjs "Key Name" workspace-id');
  console.log('\nExample:');
  console.log('  node scripts/create-api-key.cjs "Chrome Extension" babdcab8-1a78-4b2f-913e-6e9fd9821009');
  process.exit(1);
}

const [keyName, workspaceId] = args;

createApiKey(keyName, workspaceId)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Script error:', err);
    process.exit(1);
  });
