// Check Charissa Saniel's proxy assignment - she's InnovareAI Philippines
import { createClient } from '@supabase/supabase-js';

console.log('🔍 Checking Charissa Saniel proxy assignment...\n');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCharissaProxy() {
  try {
    // Find Charissa's user
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error('❌ Error fetching users:', userError);
      return;
    }
    
    const charissaUser = users.users.find(user => user.email === 'cs@innovareai.com');
    
    if (!charissaUser) {
      console.log('❌ Charissa user not found');
      return;
    }
    
    console.log('✅ Found Charissa user:', charissaUser.id);
    console.log(`   Email: ${charissaUser.email}`);
    console.log(`   Created: ${charissaUser.created_at}`);
    
    // Check LinkedIn association
    console.log('\n🔗 Checking LinkedIn association...');
    const { data: associations, error: assocError } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('user_id', charissaUser.id)
      .eq('platform', 'LINKEDIN');
      
    if (assocError) {
      console.error('❌ Error fetching LinkedIn associations:', assocError);
      return;
    }
    
    if (!associations || associations.length === 0) {
      console.log('❌ No LinkedIn associations found for Charissa');
      return;
    }
    
    console.log(`✅ Found ${associations.length} LinkedIn association(s):`);
    
    associations.forEach((assoc, index) => {
      console.log(`\n📋 Association ${index + 1}:`);
      console.log(`   Account ID: ${assoc.unipile_account_id}`);
      console.log(`   Account Name: ${assoc.account_name}`);
      console.log(`   Account Email: ${assoc.account_email}`);
      console.log(`   Connection Status: ${assoc.connection_status}`);
      console.log(`   LinkedIn Profile URL: ${assoc.linkedin_profile_url}`);
      console.log(`   LinkedIn Public ID: ${assoc.linkedin_public_identifier}`);
      console.log(`   Created: ${assoc.created_at}`);
      console.log(`   Updated: ${assoc.updated_at}`);
    });
    
    // Check if Charissa's LinkedIn account info shows her location
    console.log('\n🌍 Account location analysis:');
    const mainAssoc = associations[0];
    
    if (mainAssoc.account_name && mainAssoc.account_name.includes('Charissa')) {
      console.log('✅ This is Charissa Saniel LinkedIn account');
      console.log('📍 Charissa is InnovareAI team member, likely based in Philippines');
      console.log('🎯 Account should use Philippines/Singapore/Asia proxy, not German proxy');
      console.log('💡 Alternative: Could use US proxy for broader reach');
    }
    
    // Check if there are any proxy preferences 
    console.log('\n🔧 Checking current proxy preferences...');
    
    try {
      const { data: proxyPrefs, error: proxyError } = await supabase
        .from('user_proxy_preferences')
        .select('*')
        .eq('user_id', charissaUser.id);
        
      if (proxyError) {
        console.log('⚠️ No proxy preferences table or no data found');
        console.log('💡 This explains why she might be getting incorrect proxy assignment');
      } else if (!proxyPrefs || proxyPrefs.length === 0) {
        console.log('⚠️ No proxy preferences set for Charissa');
        console.log('💡 System is likely using fallback/default proxy assignment');
      } else {
        console.log(`✅ Found ${proxyPrefs.length} proxy preference(s):`);
        proxyPrefs.forEach((pref, index) => {
          console.log(`\n   Preference ${index + 1}:`);
          console.log(`     Country: ${pref.preferred_country}`);
          console.log(`     State: ${pref.preferred_state || 'None'}`);
          console.log(`     Detected Location: ${pref.detected_location || 'Unknown'}`);
          console.log(`     LinkedIn Location: ${pref.linkedin_location || 'Unknown'}`);
          console.log(`     Manual Selection: ${pref.is_manual_selection}`);
          console.log(`     Last Updated: ${pref.last_updated}`);
        });
      }
    } catch (error) {
      console.log('⚠️ Proxy preferences table does not exist yet');
    }
    
    console.log('\n🎯 CONCLUSION:');
    console.log('   Charissa Saniel is InnovareAI team member');
    console.log('   She should use appropriate Asia/Philippines proxy or US proxy');
    console.log('   Current German proxy assignment is likely incorrect');
    console.log('   Need to set proper proxy preferences based on her business location');
    
  } catch (error) {
    console.error('❌ Error checking Charissa proxy:', error);
  }
}

checkCharissaProxy().catch(console.error);