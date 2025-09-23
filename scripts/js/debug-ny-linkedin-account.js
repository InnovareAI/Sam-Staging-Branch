// Debug NY's LinkedIn account association to understand proxy assignment
import { createClient } from '@supabase/supabase-js';

console.log('🔍 Debugging NY\'s LinkedIn account association...\\n');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugNYLinkedInAccount() {
  try {
    // Find NY's user
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error('❌ Error fetching users:', userError);
      return;
    }
    
    const nyUser = users.users.find(user => user.email === 'ny@3cubed.ai');
    
    if (!nyUser) {
      console.log('❌ NY user not found');
      return;
    }
    
    console.log('✅ Found NY user:', nyUser.id);
    console.log(`   Email: ${nyUser.email}`);
    console.log(`   Created: ${nyUser.created_at}`);
    
    // Check LinkedIn association
    console.log('\\n🔗 Checking LinkedIn association...');
    const { data: associations, error: assocError } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('user_id', nyUser.id)
      .eq('platform', 'LINKEDIN');
      
    if (assocError) {
      console.error('❌ Error fetching LinkedIn associations:', assocError);
      return;
    }
    
    if (!associations || associations.length === 0) {
      console.log('❌ No LinkedIn associations found for NY');
      return;
    }
    
    console.log(`✅ Found ${associations.length} LinkedIn association(s):`);
    
    associations.forEach((assoc, index) => {
      console.log(`\\n📋 Association ${index + 1}:`);
      console.log(`   Account ID: ${assoc.unipile_account_id}`);
      console.log(`   Account Name: ${assoc.account_name}`);
      console.log(`   Account Email: ${assoc.account_email}`);
      console.log(`   Connection Status: ${assoc.connection_status}`);
      console.log(`   LinkedIn Profile URL: ${assoc.linkedin_profile_url}`);
      console.log(`   LinkedIn Public ID: ${assoc.linkedin_public_identifier}`);
      console.log(`   Created: ${assoc.created_at}`);
      console.log(`   Updated: ${assoc.updated_at}`);
    });
    
    // Check if NY's LinkedIn account info shows her location
    console.log('\\n🌍 Account location analysis:');
    const mainAssoc = associations[0];
    
    if (mainAssoc.account_name && mainAssoc.account_name.includes('Noriko')) {
      console.log('✅ This is Noriko Yokoi\'s LinkedIn account');
      console.log('📍 Noriko is based in New York, NY, USA');
      console.log('🎯 Account should use US-NY proxy, not German proxy');
    }
    
    // Check if there are any proxy preferences 
    console.log('\\n🔧 Checking current proxy preferences...');
    
    try {
      const { data: proxyPrefs, error: proxyError } = await supabase
        .from('user_proxy_preferences')
        .select('*')
        .eq('user_id', nyUser.id);
        
      if (proxyError) {
        console.log('⚠️ No proxy preferences table or no data found');
        console.log('💡 This explains why she might be getting incorrect proxy assignment');
      } else if (!proxyPrefs || proxyPrefs.length === 0) {
        console.log('⚠️ No proxy preferences set for NY');
        console.log('💡 System is likely using fallback/default proxy assignment');
      } else {
        console.log(`✅ Found ${proxyPrefs.length} proxy preference(s):`);
        proxyPrefs.forEach((pref, index) => {
          console.log(`\\n   Preference ${index + 1}:`);
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
    
    console.log('\\n🎯 CONCLUSION:');
    console.log('   NY (Noriko Yokoi) is based in New York, NY, USA');
    console.log('   Her LinkedIn account should use US-NY proxy');
    console.log('   Current German proxy assignment is incorrect');
    console.log('   Need to set proper proxy preferences based on her actual location');
    
  } catch (error) {
    console.error('❌ Error debugging NY LinkedIn account:', error);
  }
}

debugNYLinkedInAccount().catch(console.error);