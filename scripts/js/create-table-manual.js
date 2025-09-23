/**
 * Create user_unipile_accounts table manually
 * =========================================
 * Since we can't use migrations, we'll provide the exact SQL to run in Supabase
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTableManual() {
  console.log('🔧 Manual Table Creation Guide...');
  
  const sql = `-- Create user_unipile_accounts table for LinkedIn authentication
-- Copy and paste this SQL into Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS user_unipile_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unipile_account_id TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL DEFAULT 'LINKEDIN',
  account_name TEXT,
  account_email TEXT,
  linkedin_public_identifier TEXT,
  linkedin_profile_url TEXT,
  connection_status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_unipile_accounts_user_id ON user_unipile_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_unipile_accounts_unipile_account_id ON user_unipile_accounts(unipile_account_id);
CREATE INDEX IF NOT EXISTS idx_user_unipile_accounts_platform ON user_unipile_accounts(platform);

-- Enable Row Level Security
ALTER TABLE user_unipile_accounts ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
DROP POLICY IF EXISTS "Users can manage their own unipile accounts" ON user_unipile_accounts;
CREATE POLICY "Users can manage their own unipile accounts" ON user_unipile_accounts 
  FOR ALL USING (auth.uid() = user_id);

-- Create helper function
CREATE OR REPLACE FUNCTION create_user_association(
  p_user_id UUID,
  p_unipile_account_id TEXT,
  p_platform TEXT,
  p_account_name TEXT,
  p_account_email TEXT,
  p_linkedin_public_identifier TEXT,
  p_linkedin_profile_url TEXT,
  p_connection_status TEXT
) RETURNS UUID AS $$
DECLARE
  result_id UUID;
BEGIN
  INSERT INTO user_unipile_accounts (
    user_id,
    unipile_account_id,
    platform,
    account_name,
    account_email,
    linkedin_public_identifier,
    linkedin_profile_url,
    connection_status,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_unipile_account_id,
    p_platform,
    p_account_name,
    p_account_email,
    p_linkedin_public_identifier,
    p_linkedin_profile_url,
    p_connection_status,
    NOW(),
    NOW()
  )
  ON CONFLICT (unipile_account_id) 
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
    platform = EXCLUDED.platform,
    account_name = EXCLUDED.account_name,
    account_email = EXCLUDED.account_email,
    linkedin_public_identifier = EXCLUDED.linkedin_public_identifier,
    linkedin_profile_url = EXCLUDED.linkedin_profile_url,
    connection_status = EXCLUDED.connection_status,
    updated_at = NOW()
  RETURNING id INTO result_id;
  
  RETURN result_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`;

  console.log('\n📋 MANUAL STEPS TO FIX LINKEDIN AUTH:\n');
  console.log('1. Open Supabase Dashboard: https://latxadqrvrrrcvkktrog.supabase.co');
  console.log('2. Go to SQL Editor');
  console.log('3. Create a new query');
  console.log('4. Copy and paste the SQL below:');
  console.log('\n' + '='.repeat(80));
  console.log(sql);
  console.log('='.repeat(80));
  console.log('\n5. Click "Run" to execute the SQL');
  console.log('6. Verify the table was created in the Table Editor');
  
  // Test if we can at least check table existence
  try {
    const { data, error } = await supabase
      .from('user_unipile_accounts')
      .select('count')
      .limit(1);

    if (error && error.code === '42P01') {
      console.log('\n❌ Table does not exist - please run the SQL above');
    } else if (error) {
      console.log('\n⚠️ Table query error:', error.message);
    } else {
      console.log('\n✅ Table already exists! LinkedIn auth should work now.');
      
      // Test the hosted auth approach by checking environment variables
      console.log('\n🌐 Environment Check:');
      console.log(`- UNIPILE_DSN: ${process.env.UNIPILE_DSN ? '✅ Set' : '❌ Missing'}`);
      console.log(`- UNIPILE_API_KEY: ${process.env.UNIPILE_API_KEY ? '✅ Set' : '❌ Missing'}`);
      
      console.log('\n🔧 After creating the table, test LinkedIn auth:');
      console.log('1. Visit http://localhost:3001/linkedin-integration');
      console.log('2. Check if LinkedIn accounts are detected');
      console.log('3. Try connecting a new LinkedIn account');
    }
  } catch (err) {
    console.log('\n⚠️ Cannot test table existence:', err.message);
  }

  console.log('\n📖 Next Steps:');
  console.log('1. Create the database table using the SQL above');
  console.log('2. Implement Unipile hosted auth (see docs: https://developer.unipile.com/docs/hosted-auth)');
  console.log('3. Test the LinkedIn integration end-to-end');
}

createTableManual();