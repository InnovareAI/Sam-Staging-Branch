/**
 * Get workspace ID for Chrome extension setup
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getWorkspaceId() {
  console.log('\n🔍 Fetching workspace information...\n');

  // Get all workspaces
  const { data: workspaces, error } = await supabase
    .from('workspaces')
    .select('id, name, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (!workspaces || workspaces.length === 0) {
    console.log('❌ No workspaces found!');
    return;
  }

  console.log('📋 Available Workspaces:\n');
  workspaces.forEach((ws, i) => {
    console.log(`${i + 1}. ${ws.name}`);
    console.log(`   ID: ${ws.id}`);
    console.log(`   Created: ${new Date(ws.created_at).toLocaleDateString()}\n`);
  });

  if (workspaces.length === 1) {
    console.log('✅ Your Workspace ID for Chrome Extension:');
    console.log('━'.repeat(50));
    console.log(workspaces[0].id);
    console.log('━'.repeat(50));
  } else {
    console.log(`\n💡 You have ${workspaces.length} workspaces. Use the ID from the workspace you want to use for LinkedIn commenting.`);
  }
}

getWorkspaceId()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Script error:', err);
    process.exit(1);
  });
