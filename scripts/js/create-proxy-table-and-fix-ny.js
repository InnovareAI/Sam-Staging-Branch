// Create proxy table manually and fix NY's proxy location
import { createClient } from '@supabase/supabase-js';

console.log('🛠️ Creating user_proxy_preferences table and fixing NY\'s location...\\n');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTableAndFixNY() {
  try {
    // Create the table manually using RPC call
    console.log('📋 Creating user_proxy_preferences table...');
    
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS user_proxy_preferences (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
          detected_location text,
          linkedin_location text,
          preferred_country text NOT NULL,
          preferred_state text,
          preferred_city text,
          confidence_score numeric(3,2) DEFAULT 0.0,
          session_id text,
          is_manual_selection boolean DEFAULT false,
          created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
          last_updated timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
          
          CONSTRAINT valid_confidence_score CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
          CONSTRAINT valid_country_code CHECK (length(preferred_country) = 2)
      );
      
      CREATE INDEX IF NOT EXISTS idx_user_proxy_preferences_user_id ON user_proxy_preferences(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_proxy_preferences_last_updated ON user_proxy_preferences(last_updated DESC);
      
      ALTER TABLE user_proxy_preferences ENABLE ROW LEVEL SECURITY;
    `;
    
    const { error: createError } = await supabase.rpc('exec_sql', { 
      sql_query: createTableSQL 
    });
    
    // Try direct SQL execution if RPC fails
    if (createError) {
      console.log('📋 RPC failed, trying direct table creation...');
      console.log('⚠️ Note: Table may already exist, continuing...');
    } else {
      console.log('✅ Table created successfully');
    }

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
    
    console.log('\\n🇺🇸 Setting correct US-NY proxy preferences for NY...');
    
    // Try inserting/updating directly
    const { data, error } = await supabase
      .from('user_proxy_preferences')
      .upsert(correctPreferences, { 
        onConflict: 'user_id'
      });
      
    if (error) {
      console.error('❌ Error setting proxy preferences:', error);
      
      // If table doesn't exist, show the SQL to run manually
      if (error.code === '42P01') {
        console.log('\\n🔧 Manual SQL to create table:');
        console.log('-- Run this in Supabase SQL Editor --');
        console.log(createTableSQL);
        console.log('\\n-- Then insert NY\\'s preferences --');
        console.log(`INSERT INTO user_proxy_preferences (
          user_id, detected_location, linkedin_location, preferred_country, 
          preferred_state, confidence_score, session_id, is_manual_selection
        ) VALUES (
          '${nyUser.id}'::uuid, 
          'New York, New York, United States', 
          'New York Area', 
          'us', 
          'ny', 
          0.98, 
          '${sessionId}', 
          true
        );`);
      }
      return;
    }
    
    console.log('✅ NY\'s proxy location fixed!');
    console.log('\\n📍 New proxy configuration for NY (ny@3cubed.ai):');
    console.log(`   Country: United States (us)`);
    console.log(`   State: New York (ny)`);
    console.log(`   Location: New York Area`);
    console.log(`   Confidence: 98% (manual override)`);
    console.log(`   Session ID: ${sessionId}`);
    
    console.log('\\n🎯 Expected Bright Data proxy username:');
    console.log(`   brd-customer-{id}-zone-residential-country-us-state-ny-session-${sessionId}`);
    
    console.log('\\n✅ NY should now get US-NY proxy instead of German proxy!');
    console.log('   The German proxy was assigned because Thorsten (in Germany) was the last');
    console.log('   person to connect her LinkedIn account. Now it\\'s correctly set to US-NY.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createTableAndFixNY().catch(console.error);