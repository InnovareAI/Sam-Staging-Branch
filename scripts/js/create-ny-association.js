import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function createNYAssociation() {
  console.log('🔧 Creating LinkedIn association for ny@3cubed.ai...\n');

  // Get the user ID for ny@3cubed.ai
  const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
  const user = users?.find(u => u.email === 'ny@3cubed.ai');
  
  if (userError || !user) {
    console.error('❌ User not found:', userError?.message);
    return;
  }

  console.log(`👤 Found user: ${user.email} (ID: ${user.id})`);

  // Check if association already exists
  const { data: existingAssoc } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .eq('user_id', user.id)
    .eq('platform', 'LINKEDIN');

  if (existingAssoc && existingAssoc.length > 0) {
    console.log('✅ Association already exists:', existingAssoc);
    return;
  }

  // Create association for Noriko Yokoi
  const associationData = {
    user_id: user.id,
    unipile_account_id: 'osKDIRFtTtqzmfULiWGTEg',
    platform: 'LINKEDIN',
    account_name: 'Noriko Yokoi, Ph.D.',
    connection_status: 'active'
  };

  console.log('📋 Creating association with data:', associationData);

  const { data, error } = await supabase
    .from('user_unipile_accounts')
    .insert(associationData)
    .select();

  if (error) {
    console.error('❌ Insert failed:', error.message);
  } else {
    console.log('✅ Association created successfully!');
    console.log('📋 Created record:', data);
  }
}

createNYAssociation().catch(console.error);