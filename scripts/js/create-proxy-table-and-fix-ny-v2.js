// Create proxy table manually and fix NY's proxy location - V2
import { createClient } from '@supabase/supabase-js';

console.log('🛠️ Creating user_proxy_preferences table and fixing NY location...\n');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTableAndFixNY() {
  try {
    // Find NY's user first
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
    
    // Generate new US session ID
    const sessionId = `us_ny_${Date.now().toString(36)}_${Math.random().toString(36).substring(2)}`;
    
    // Set correct US-NY proxy for NY (she's in New York!)
    const correctPreferences = {
      user_id: nyUser.id,
      detected_location: 'New York, New York, United States',
      linkedin_location: 'New York Area',
      preferred_country: 'us',
      preferred_state: 'ny',
      preferred_city: null,
      confidence_score: 0.98,
      session_id: sessionId,
      is_manual_selection: true,
      last_updated: new Date().toISOString()
    };
    
    console.log('🇺🇸 Setting correct US-NY proxy preferences for NY...');
    
    // Try inserting/updating directly - this will tell us if table exists
    const { data, error } = await supabase
      .from('user_proxy_preferences')
      .upsert(correctPreferences, { 
        onConflict: 'user_id'
      });
      
    if (error) {
      console.error('❌ Error setting proxy preferences:', error);
      
      // If table doesn't exist, we need to create it manually in Supabase
      if (error.code === '42P01') {
        console.log('\n🔧 TABLE DOES NOT EXIST - Manual steps required:');
        console.log('1. Go to Supabase SQL Editor: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql');
        console.log('2. Run this SQL:');
        console.log('');
        console.log('CREATE TABLE user_proxy_preferences (');
        console.log('    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),');
        console.log('    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,');
        console.log('    detected_location text,');
        console.log('    linkedin_location text,');
        console.log('    preferred_country text NOT NULL,');
        console.log('    preferred_state text,');
        console.log('    preferred_city text,');
        console.log('    confidence_score numeric(3,2) DEFAULT 0.0,');
        console.log('    session_id text,');
        console.log('    is_manual_selection boolean DEFAULT false,');
        console.log('    created_at timestamp with time zone DEFAULT timezone(\'utc\'::text, now()) NOT NULL,');
        console.log('    last_updated timestamp with time zone DEFAULT timezone(\'utc\'::text, now()) NOT NULL');
        console.log(');');
        console.log('');
        console.log('CREATE INDEX idx_user_proxy_preferences_user_id ON user_proxy_preferences(user_id);');
        console.log('ALTER TABLE user_proxy_preferences ENABLE ROW LEVEL SECURITY;');
        console.log('');
        console.log('3. Then run this to fix NY proxy:');
        console.log('');
        console.log(`INSERT INTO user_proxy_preferences (`);
        console.log(`  user_id, detected_location, linkedin_location, preferred_country,`);
        console.log(`  preferred_state, confidence_score, session_id, is_manual_selection`);
        console.log(`) VALUES (`);
        console.log(`  '${nyUser.id}'::uuid,`);
        console.log(`  'New York, New York, United States',`);
        console.log(`  'New York Area',`);
        console.log(`  'us',`);
        console.log(`  'ny',`);
        console.log(`  0.98,`);
        console.log(`  '${sessionId}',`);
        console.log(`  true`);
        console.log(`);`);
      }
      return;
    }
    
    console.log('✅ NY proxy location fixed!');
    console.log('\n📍 New proxy configuration for NY (ny@3cubed.ai):');
    console.log('   Country: United States (us)');
    console.log('   State: New York (ny)');
    console.log('   Location: New York Area');
    console.log('   Confidence: 98% (manual override)');
    console.log(`   Session ID: ${sessionId}`);
    
    console.log('\n🎯 Expected Bright Data proxy username:');
    console.log(`   brd-customer-{id}-zone-residential-country-us-state-ny-session-${sessionId}`);
    
    console.log('\n✅ NY should now get US-NY proxy instead of German proxy!');
    console.log('   The German proxy was assigned because Thorsten (in Germany) was the last');
    console.log('   person to connect her LinkedIn account. Now it is correctly set to US-NY.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createTableAndFixNY().catch(console.error);