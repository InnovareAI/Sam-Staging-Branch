import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function createDirectAssociation() {
  console.log('🔧 Creating LinkedIn association directly for tl@innovareai.com...\n');

  // Get the user ID for tl@innovareai.com using admin API
  const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
  const user = users?.find(u => u.email === 'tl@innovareai.com');
  
  if (userError || !user) {
    console.error('❌ User not found:', userError?.message);
    return;
  }

  console.log(`👤 Found user: ${user.email} (ID: ${user.id})`);

  // Create association with all available information
  const associationData = {
    user_id: user.id,
    unipile_account_id: 'NLsTJRfCSg-WZAXCBo8w7A',
    platform: 'LINKEDIN',
    account_name: 'Thorsten Linz',
    account_email: 'tl@innovareai.com',
    linkedin_public_identifier: 'tvonlinz',
    linkedin_profile_url: 'https://www.linkedin.com/in/tvonlinz',
    connection_status: 'active'
  };

  console.log('📋 Creating association with data:', associationData);

  const { data, error } = await supabase
    .from('user_unipile_accounts')
    .insert(associationData)
    .select();

  if (error) {
    console.error('❌ Insert failed:', error.message);
    console.error('   Code:', error.code);
    console.error('   Details:', error.details);
    console.error('   Hint:', error.hint);
  } else {
    console.log('✅ Association created successfully!');
    console.log('📋 Created record:', data);
  }

  // Verify the association exists
  console.log('\n🔍 Verifying association...');
  const { data: verification, error: verifyError } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .eq('user_id', user.id)
    .eq('platform', 'LINKEDIN');

  if (verifyError) {
    console.error('❌ Verification failed:', verifyError.message);
  } else if (verification && verification.length > 0) {
    console.log('✅ Association verified:', verification);
  } else {
    console.log('❌ Association not found after creation');
  }
}

createDirectAssociation().catch(console.error);