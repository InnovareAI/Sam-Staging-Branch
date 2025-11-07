require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function testConnection() {
  console.log('🔍 Testing Supabase Connection\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Test 1: Check workspaces table
  console.log('Test 1: Workspaces table...');
  const { data: workspaces, error: wsError } = await supabase
    .from('workspaces')
    .select('*')
    .limit(5);

  if (wsError) {
    console.log('❌ Error:', wsError.message);
  } else {
    console.log(`✅ Found ${workspaces?.length || 0} workspaces`);
    if (workspaces && workspaces.length > 0) {
      console.log('   First workspace:', workspaces[0].name);
    }
  }

  // Test 2: Check campaigns table
  console.log('\nTest 2: Campaigns table...');
  const { data: campaigns, error: campError } = await supabase
    .from('campaigns')
    .select('id, name, workspace_id')
    .limit(5);

  if (campError) {
    console.log('❌ Error:', campError.message);
  } else {
    console.log(`✅ Found ${campaigns?.length || 0} campaigns`);
  }

  // Test 3: Check campaign_prospects table
  console.log('\nTest 3: Campaign prospects table...');
  const { data: prospects, error: prospError } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name')
    .limit(5);

  if (prospError) {
    console.log('❌ Error:', prospError.message);
  } else {
    console.log(`✅ Found ${prospects?.length || 0} prospects`);
    if (prospects && prospects.length > 0) {
      console.log('   First prospect:', prospects[0].first_name, prospects[0].last_name);
    }
  }
}

testConnection().catch(console.error);
