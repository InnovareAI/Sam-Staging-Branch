const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function removeMyLinkedIn() {
  try {
    console.log('🔍 Finding your user account...');
    
    // Find your user by email
    const { data: authUser } = await supabase.auth.admin.listUsers();
    const user = authUser?.users?.find(u => u.email === 'tl@innovareai.com');
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log(`✅ Found user: ${user.email} (${user.id})`);
    
    // Get user's internal ID from users table
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();
    
    if (!userData) {
      console.log('⚠️ User not found in users table, using auth ID');
    }
    
    const userId = userData?.id || user.id;
    
    // Delete from linkedin_proxy_assignments
    console.log('\n🗑️ Removing LinkedIn proxy assignments...');
    const { data: proxyData, error: proxyError } = await supabase
      .from('linkedin_proxy_assignments')
      .delete()
      .eq('user_id', userId)
      .select();
    
    if (proxyError) {
      console.log('⚠️ Error removing proxy assignments:', proxyError.message);
    } else {
      console.log(`✅ Removed ${proxyData?.length || 0} proxy assignments`);
    }
    
    // Delete from user_unipile_accounts
    console.log('\n🗑️ Removing Unipile account associations...');
    const { data: unipileData, error: unipileError } = await supabase
      .from('user_unipile_accounts')
      .delete()
      .eq('user_id', userId)
      .eq('platform', 'LINKEDIN')
      .select();
    
    if (unipileError) {
      console.log('⚠️ Error removing Unipile accounts:', unipileError.message);
    } else {
      console.log(`✅ Removed ${unipileData?.length || 0} Unipile account associations`);
    }
    
    // Delete from integrations table
    console.log('\n🗑️ Removing integration records...');
    const { data: integrationData, error: integrationError } = await supabase
      .from('integrations')
      .delete()
      .eq('user_id', userId)
      .eq('provider', 'linkedin')
      .select();
    
    if (integrationError) {
      console.log('⚠️ Error removing integrations:', integrationError.message);
    } else {
      console.log(`✅ Removed ${integrationData?.length || 0} integration records`);
    }
    
    // Delete from user_proxy_preferences
    console.log('\n🗑️ Removing proxy preferences...');
    const { data: prefData, error: prefError } = await supabase
      .from('user_proxy_preferences')
      .delete()
      .eq('user_id', userId)
      .select();
    
    if (prefError) {
      console.log('⚠️ Error removing proxy preferences:', prefError.message);
    } else {
      console.log(`✅ Removed ${prefData?.length || 0} proxy preferences`);
    }
    
    console.log('\n✅ All LinkedIn data removed from database!');
    console.log('📝 Note: You may still need to disconnect from Unipile dashboard');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

removeMyLinkedIn();
