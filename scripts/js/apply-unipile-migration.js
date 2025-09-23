/**
 * Apply Unipile Table Migration
 * ============================
 * Create the user_unipile_accounts table directly
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyUnipileMigration() {
  console.log('🔧 Applying Unipile Table Migration...');
  
  try {
    // Read the migration file
    const migrationSql = readFileSync('./supabase/migrations/20250923200000_create_user_unipile_accounts.sql', 'utf8');
    
    // Split into individual statements
    const statements = migrationSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
      .map(stmt => stmt + ';');

    console.log(`📋 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`\n${i + 1}. Executing: ${statement.substring(0, 80)}...`);
      
      try {
        const { error } = await supabase.rpc('execute_sql', {
          query: statement
        });
        
        if (error) {
          if (error.message.includes('already exists')) {
            console.log(`   ✅ Already exists (ok)`);
          } else {
            console.log(`   ⚠️ Error: ${error.message}`);
          }
        } else {
          console.log(`   ✅ Success`);
        }
      } catch (err) {
        console.log(`   ⚠️ Exception: ${err.message}`);
      }
    }

    // Test the table creation
    console.log('\n🧪 Testing table access...');
    const { data, error } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .limit(1);

    if (error) {
      console.log(`❌ Table test failed: ${error.message}`);
    } else {
      console.log(`✅ Table is accessible! Current records: ${data?.length || 0}`);
    }

    // Test the helper function
    console.log('\n🧪 Testing helper function...');
    try {
      const { data: functionData, error: functionError } = await supabase.rpc('create_user_association', {
        p_user_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID for test
        p_unipile_account_id: 'test-account-123',
        p_platform: 'LINKEDIN',
        p_account_name: 'Test Account',
        p_account_email: 'test@example.com',
        p_linkedin_public_identifier: 'test-user',
        p_linkedin_profile_url: 'https://www.linkedin.com/in/test-user',
        p_connection_status: 'active'
      });

      if (functionError) {
        if (functionError.message.includes('violates foreign key')) {
          console.log(`✅ Function exists (foreign key error expected for dummy data)`);
        } else {
          console.log(`⚠️ Function error: ${functionError.message}`);
        }
      } else {
        console.log(`✅ Function works! Result: ${functionData}`);
        
        // Clean up test data
        await supabase
          .from('user_unipile_accounts')
          .delete()
          .eq('unipile_account_id', 'test-account-123');
      }
    } catch (err) {
      console.log(`⚠️ Function test exception: ${err.message}`);
    }

    console.log('\n✅ Unipile Table Migration Complete!');

  } catch (error) {
    console.error('❌ Apply Unipile Migration failed:', error);
  }
}

applyUnipileMigration();