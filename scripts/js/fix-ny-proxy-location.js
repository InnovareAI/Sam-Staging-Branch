// Fix NY's proxy location - she should have US proxy, not German
import { createClient } from '@supabase/supabase-js';

console.log('🇺🇸 Fixing NY\'s proxy location from Germany to US...\\n');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixNYProxyLocation() {
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
    
    // Check current proxy preferences
    const { data: currentPrefs, error: fetchError } = await supabase
      .from('user_proxy_preferences')
      .select('*')
      .eq('user_id', nyUser.id)
      .order('last_updated', { ascending: false })
      .limit(1);
      
    if (fetchError) {
      console.error('❌ Error fetching current preferences:', fetchError);
      return;
    }
    
    console.log('\\n📍 Current proxy preferences:');
    if (currentPrefs && currentPrefs.length > 0) {
      const pref = currentPrefs[0];
      console.log(`   Country: ${pref.preferred_country}`);
      console.log(`   State: ${pref.preferred_state || 'None'}`);
      console.log(`   City: ${pref.preferred_city || 'None'}`);
      console.log(`   Detected Location: ${pref.detected_location || 'Unknown'}`);
      console.log(`   LinkedIn Location: ${pref.linkedin_location || 'Unknown'}`);
      console.log(`   Manual Selection: ${pref.is_manual_selection || false}`);
      console.log(`   Last Updated: ${pref.last_updated}`);
    } else {
      console.log('   No proxy preferences found');
    }
    
    // Generate new US session ID
    const sessionId = `fix_${Date.now().toString(36)}_${Math.random().toString(36).substring(2)}`;
    
    // Set correct US-NY proxy for NY
    const correctPreferences = {
      user_id: nyUser.id,
      detected_location: 'New York, New York, United States',
      linkedin_location: 'New York, New York',
      preferred_country: 'us',
      preferred_state: 'ny',
      preferred_city: null,
      confidence_score: 0.98,
      session_id: sessionId,
      is_manual_selection: true,
      last_updated: new Date().toISOString()
    };
    
    console.log('\\n🔧 Setting correct US proxy preferences...');
    const { data, error } = await supabase
      .from('user_proxy_preferences')
      .upsert(correctPreferences);
      
    if (error) {
      console.error('❌ Error setting proxy preferences:', error);
      return;
    }
    
    console.log('✅ NY\'s proxy location fixed!');
    console.log('\\n📍 New proxy configuration:');
    console.log(`   Country: United States (us)`);
    console.log(`   State: New York (ny)`);
    console.log(`   Confidence: 98%`);
    console.log(`   Session ID: ${sessionId}`);
    console.log(`   Manual Selection: Yes`);
    
    console.log('\\n🎯 Expected Bright Data proxy username format:');
    console.log(`   brd-customer-{customer_id}-zone-residential-country-us-state-ny-session-${sessionId}`);
    
    console.log('\\n🔍 NY should now get US-based LinkedIn proxy instead of German!');
    
  } catch (error) {
    console.error('❌ Error fixing NY proxy location:', error);
  }
}

fixNYProxyLocation().catch(console.error);