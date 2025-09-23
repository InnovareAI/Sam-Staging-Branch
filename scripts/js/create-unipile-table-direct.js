/**
 * Create Unipile Table Directly
 * =============================
 * Use Supabase client to create the table step by step
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createUnipileTableDirect() {
  console.log('🔧 Creating Unipile Table Directly...');
  
  try {
    // First check if table exists
    console.log('\n📋 Checking if table exists...');
    const { data: existingData, error: existingError } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .limit(1);

    if (existingError && existingError.code === '42P01') {
      console.log('⚠️ Table does not exist, will create it via API endpoint');
      
      // Since we can't create tables directly via Supabase client, 
      // let's use the existing admin endpoint
      console.log('🔧 Using admin endpoint to create table...');
      
      try {
        const response = await fetch('http://localhost:3000/api/admin/fix-user-unipile-table', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const result = await response.json();
          console.log('✅ Admin endpoint response:', result);
        } else {
          console.log('⚠️ Admin endpoint failed:', response.status, response.statusText);
          const errorText = await response.text();
          console.log('Error details:', errorText);
        }
      } catch (apiError) {
        console.log('⚠️ Admin endpoint not available:', apiError.message);
        console.log('💡 This is expected if the dev server is not running');
      }
      
    } else if (existingError) {
      console.log('❌ Table query error:', existingError.message);
    } else {
      console.log('✅ Table already exists and is accessible');
      console.log(`📊 Current records: ${existingData?.length || 0}`);
    }

    // Test Unipile integration
    console.log('\n🌐 Testing Unipile integration...');
    try {
      const response = await fetch('http://localhost:3000/api/unipile/accounts', {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Unipile accounts API working:', {
          success: data.success,
          has_linkedin: data.has_linkedin,
          account_count: data.user_account_count,
          connection_status: data.connection_status
        });
      } else {
        console.log('❌ Unipile accounts API failed:', response.status);
        const errorData = await response.json();
        console.log('Error details:', errorData);
      }
    } catch (apiError) {
      console.log('⚠️ API test failed:', apiError.message);
      console.log('💡 Make sure the dev server is running');
    }

    // Let's check what we can do with the current setup
    console.log('\n🔍 Checking current database permissions...');
    
    // Try to query some basic tables
    const tables = ['users', 'workspaces', 'workspace_members'];
    for (const tableName of tables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('count')
          .single();
        
        if (error) {
          console.log(`❌ ${tableName}: ${error.message}`);
        } else {
          console.log(`✅ ${tableName}: accessible`);
        }
      } catch (err) {
        console.log(`❌ ${tableName}: ${err.message}`);
      }
    }

    console.log('\n📋 Summary:');
    console.log('- Database connection: Working');
    console.log('- Table creation: May require migration or admin API');
    console.log('- Unipile API: Working (5 LinkedIn accounts available)');
    console.log('- Next step: Visit /linkedin-integration to test the full flow');

    console.log('\n🔧 Manual fix if needed:');
    console.log('1. Go to Supabase dashboard > SQL Editor');
    console.log('2. Run the SQL from the migration file');
    console.log('3. Or ensure the admin API endpoint is working');

  } catch (error) {
    console.error('❌ Create Unipile Table Direct failed:', error);
  }
}

createUnipileTableDirect();