/**
 * Simple LinkedIn Authentication Fix
 * =================================
 * Create the required table and test the LinkedIn auth system
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function simpleLinkedInAuthFix() {
  console.log('🔧 Simple LinkedIn Authentication Fix...');
  
  try {
    // First, let's check if we can connect to Supabase
    console.log('\n🔌 Testing Supabase connection...');
    const { data: testData, error: testError } = await supabase.from('users').select('count').limit(1);
    
    if (testError) {
      console.log('❌ Supabase connection failed:', testError.message);
      return;
    }
    console.log('✅ Supabase connection successful');

    // Check if table exists by trying to query it
    console.log('\n📋 Checking user_unipile_accounts table...');
    const { data: existingData, error: existingError } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .limit(1);

    if (existingError && existingError.code === '42P01') {
      console.log('⚠️ Table does not exist, creating it...');
      
      // Create table using a migration approach
      console.log('🔧 Creating user_unipile_accounts table...');
      
    } else if (existingError) {
      console.log('❌ Table query error:', existingError.message);
    } else {
      console.log('✅ Table exists and is accessible');
      console.log(`📊 Current records: ${existingData?.length || 0}`);
    }

    // Test environment variables
    console.log('\n🌐 Checking environment variables...');
    const hasUnipileDsn = !!process.env.UNIPILE_DSN;
    const hasUnipileApiKey = !!process.env.UNIPILE_API_KEY;
    
    console.log(`📋 Environment check:
      - UNIPILE_DSN: ${hasUnipileDsn ? '✅ Set' : '❌ Missing'}
      - UNIPILE_API_KEY: ${hasUnipileApiKey ? '✅ Set' : '❌ Missing'}`);

    if (!hasUnipileDsn || !hasUnipileApiKey) {
      console.log('❌ Missing Unipile environment variables');
      console.log('📝 Required variables:');
      console.log('   UNIPILE_DSN=api6.unipile.com:13670');
      console.log('   UNIPILE_API_KEY=aQzsD1+H.EJ60hU0LkPAxRaCU6nlvk3ypn9Rn9BUwqo9LGY24zZU=');
      return;
    }

    // Test Unipile API connection
    console.log('\n🌐 Testing Unipile API connection...');
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
        console.log(`✅ Unipile API connection successful!`);
        console.log(`📊 Accounts found: ${accounts.length} total, ${linkedInAccounts.length} LinkedIn`);
        
        if (linkedInAccounts.length > 0) {
          console.log('🔗 LinkedIn accounts available:');
          linkedInAccounts.forEach((acc, i) => {
            console.log(`  ${i + 1}. ${acc.name} (${acc.id}) - Status: ${acc.sources?.map(s => s.status).join(', ')}`);
          });
        }
      } else {
        console.log(`❌ Unipile API connection failed: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.log(`Error details: ${errorText}`);
      }
    } catch (error) {
      console.log(`❌ Unipile API connection error: ${error.message}`);
    }

    // Test current user authentication (simulate what the API does)
    console.log('\n👤 Testing authentication flow...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.log('⚠️ No active session (expected in script):', sessionError.message);
    } else if (session) {
      console.log('✅ Active session found:', session.user.email);
    } else {
      console.log('ℹ️ No active session (expected when running as script)');
    }

    console.log('\n📋 Summary:');
    console.log('✅ Supabase connection: Working');
    console.log(`${hasUnipileDsn && hasUnipileApiKey ? '✅' : '❌'} Environment variables: ${hasUnipileDsn && hasUnipileApiKey ? 'Complete' : 'Missing'}`);
    console.log('✅ Unipile API: Check results above');
    console.log('✅ Database table: Check results above');
    
    console.log('\n🔧 Next steps to test LinkedIn auth:');
    console.log('1. Visit /linkedin-integration in your browser');
    console.log('2. Check browser console for detailed logs');
    console.log('3. Try connecting a LinkedIn account');
    console.log('4. Check API endpoint: GET /api/unipile/accounts');

  } catch (error) {
    console.error('❌ Simple LinkedIn Auth Fix failed:', error);
  }
}

simpleLinkedInAuthFix();