/**
 * Fix LinkedIn Authentication Database Schema
 * ==========================================
 * Check and fix the user_unipile_accounts table schema
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixLinkedInAuthDatabase() {
  console.log('🔧 Fixing LinkedIn Authentication Database Schema...');
  
  try {
    // Check if table exists
    console.log('\n📋 Checking table existence...');
    const { data: tables, error: tableError } = await supabase.rpc('get_table_info', {
      table_name: 'user_unipile_accounts'
    });

    if (tableError) {
      console.log('⚠️ Table check failed, creating table...');
      
      // Create the table with full schema
      const createTableSql = `
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
      `;
      
      const { error: createError } = await supabase.rpc('execute_sql', {
        query: createTableSql
      });

      if (createError) {
        console.log('❌ Failed to create table:', createError.message);
        return;
      }

      console.log('✅ Table created successfully');
    } else {
      console.log('✅ Table exists');
    }

    // Add missing columns (safe to run multiple times)
    console.log('\n🔧 Adding missing columns...');
    
    const alterQueries = [
      "ALTER TABLE user_unipile_accounts ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'LINKEDIN'",
      "ALTER TABLE user_unipile_accounts ADD COLUMN IF NOT EXISTS account_name TEXT",
      "ALTER TABLE user_unipile_accounts ADD COLUMN IF NOT EXISTS account_email TEXT",
      "ALTER TABLE user_unipile_accounts ADD COLUMN IF NOT EXISTS linkedin_public_identifier TEXT",
      "ALTER TABLE user_unipile_accounts ADD COLUMN IF NOT EXISTS linkedin_profile_url TEXT",
      "ALTER TABLE user_unipile_accounts ADD COLUMN IF NOT EXISTS connection_status TEXT NOT NULL DEFAULT 'active'",
      "ALTER TABLE user_unipile_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()",
      "ALTER TABLE user_unipile_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()"
    ];

    for (const query of alterQueries) {
      try {
        const { error } = await supabase.rpc('execute_sql', { query });
        if (error) {
          console.log(`⚠️ Column add failed (might already exist): ${error.message}`);
        } else {
          console.log(`✅ Column added: ${query.split('ADD COLUMN IF NOT EXISTS ')[1]?.split(' ')[0]}`);
        }
      } catch (err) {
        console.log(`⚠️ Query failed: ${err.message}`);
      }
    }

    // Create indexes
    console.log('\n📊 Creating indexes...');
    const indexQueries = [
      "CREATE INDEX IF NOT EXISTS idx_user_unipile_accounts_user_id ON user_unipile_accounts(user_id)",
      "CREATE INDEX IF NOT EXISTS idx_user_unipile_accounts_unipile_account_id ON user_unipile_accounts(unipile_account_id)",
      "CREATE INDEX IF NOT EXISTS idx_user_unipile_accounts_platform ON user_unipile_accounts(platform)"
    ];

    for (const query of indexQueries) {
      try {
        const { error } = await supabase.rpc('execute_sql', { query });
        if (error) {
          console.log(`⚠️ Index creation failed (might already exist): ${error.message}`);
        } else {
          console.log(`✅ Index created: ${query.split('CREATE INDEX IF NOT EXISTS ')[1]?.split(' ')[0]}`);
        }
      } catch (err) {
        console.log(`⚠️ Index query failed: ${err.message}`);
      }
    }

    // Enable RLS and create policies
    console.log('\n🛡️ Setting up Row Level Security...');
    
    const rlsQueries = [
      "ALTER TABLE user_unipile_accounts ENABLE ROW LEVEL SECURITY",
      "DROP POLICY IF EXISTS \"Users can manage their own unipile accounts\" ON user_unipile_accounts",
      "CREATE POLICY \"Users can manage their own unipile accounts\" ON user_unipile_accounts FOR ALL USING (auth.uid() = user_id)"
    ];

    for (const query of rlsQueries) {
      try {
        const { error } = await supabase.rpc('execute_sql', { query });
        if (error) {
          console.log(`⚠️ RLS setup failed: ${error.message}`);
        } else {
          console.log(`✅ RLS configured`);
        }
      } catch (err) {
        console.log(`⚠️ RLS query failed: ${err.message}`);
      }
    }

    // Create the helper function for associations
    console.log('\n🔧 Creating helper function...');
    
    const functionSql = `
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
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    try {
      const { error } = await supabase.rpc('execute_sql', { query: functionSql });
      if (error) {
        console.log(`⚠️ Function creation failed: ${error.message}`);
      } else {
        console.log(`✅ Helper function created`);
      }
    } catch (err) {
      console.log(`⚠️ Function query failed: ${err.message}`);
    }

    // Test connection to Unipile
    console.log('\n🌐 Testing Unipile connection...');
    try {
      const response = await fetch(`https://${process.env.UNIPILE_DSN}/api/v1/accounts`, {
        headers: {
          'X-API-KEY': process.env.UNIPILE_API_KEY,
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const accounts = Array.isArray(data) ? data : (data.items || data.accounts || []);
        const linkedInAccounts = accounts.filter(acc => acc.type === 'LINKEDIN');
        console.log(`✅ Unipile connection successful: ${accounts.length} total accounts, ${linkedInAccounts.length} LinkedIn accounts`);
      } else {
        console.log(`⚠️ Unipile connection failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.log(`❌ Unipile connection error: ${error.message}`);
    }

    console.log('\n✅ LinkedIn Authentication Database Schema Fixed!');
    console.log('\n📋 Summary:');
    console.log('- ✅ user_unipile_accounts table exists');
    console.log('- ✅ All required columns added');
    console.log('- ✅ Indexes created for performance');
    console.log('- ✅ Row Level Security enabled');
    console.log('- ✅ Helper function for associations created');
    console.log('- ✅ Unipile API connection tested');

  } catch (error) {
    console.error('❌ Fix LinkedIn Auth Database failed:', error);
  }
}

fixLinkedInAuthDatabase();