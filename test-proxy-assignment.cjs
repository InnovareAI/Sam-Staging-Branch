const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testTable() {
  console.log('🔍 Testing linkedin_proxy_assignments table...\n');
  
  // Test if we can query it
  const { data, error } = await supabase
    .from('linkedin_proxy_assignments')
    .select('*')
    .limit(1);
  
  if (error) {
    console.log('❌ Error:', error.message);
    return;
  }
  
  console.log('✅ Table is working!');
  console.log(`📊 Current assignments: ${data?.length || 0}\n`);
  
  if (data && data.length > 0) {
    console.log('Current proxy assignments:');
    data.forEach(assignment => {
      console.log(`  - ${assignment.linkedin_account_name}`);
      console.log(`    Country: ${assignment.proxy_country}${assignment.proxy_state ? '/' + assignment.proxy_state : ''}`);
      console.log(`    Status: ${assignment.connectivity_status}`);
    });
  } else {
    console.log('ℹ️  No proxy assignments yet');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Go to https://app.meet-sam.com/linkedin-integration');
    console.log('  2. Connect your LinkedIn account');
    console.log('  3. The callback will automatically assign a dedicated IP!');
  }
}

testTable();
