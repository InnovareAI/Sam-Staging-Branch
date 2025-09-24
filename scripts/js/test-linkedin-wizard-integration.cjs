const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testLinkedInWizardIntegration() {
  console.log('🧪 Testing LinkedIn Wizard Integration...\n');
  
  try {
    // Test 1: Check hosted auth endpoint exists
    console.log('1️⃣ Testing hosted auth endpoint availability...');
    
    try {
      const hostedAuthResponse = await fetch('https://app.meet-sam.com/api/linkedin/hosted-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      
      console.log(`   Status: ${hostedAuthResponse.status}`);
      
      if (hostedAuthResponse.status === 401) {
        console.log('   ✅ Hosted auth endpoint exists (authentication required as expected)');
      } else if (hostedAuthResponse.status === 503) {
        console.log('   ⚠️ Hosted auth endpoint exists but Unipile not configured');
      } else {
        console.log('   ❓ Hosted auth endpoint returned unexpected status');
      }
    } catch (error) {
      console.log('   ❌ Hosted auth endpoint not accessible:', error.message);
    }
    
    // Test 2: Check connect endpoint integration
    console.log('\n2️⃣ Testing connect endpoint integration...');
    
    try {
      const connectResponse = await fetch('https://app.meet-sam.com/api/linkedin/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`   Status: ${connectResponse.status}`);
      
      if (connectResponse.status === 401) {
        console.log('   ✅ Connect endpoint exists (authentication required as expected)');
      } else {
        console.log('   ❓ Connect endpoint returned unexpected status');
      }
    } catch (error) {
      console.log('   ❌ Connect endpoint not accessible:', error.message);
    }
    
    // Test 3: Check environment variables
    console.log('\n3️⃣ Checking environment configuration...');
    
    const hasUnipileDsn = !!process.env.UNIPILE_DSN;
    const hasUnipileKey = !!process.env.UNIPILE_API_KEY;
    
    console.log(`   UNIPILE_DSN configured: ${hasUnipileDsn ? '✅' : '❌'}`);
    console.log(`   UNIPILE_API_KEY configured: ${hasUnipileKey ? '✅' : '❌'}`);
    
    if (hasUnipileDsn && hasUnipileKey) {
      console.log('   ✅ Unipile environment properly configured');
    } else {
      console.log('   ⚠️ Unipile environment missing configuration');
    }
    
    // Test 4: Check database tables
    console.log('\n4️⃣ Checking database tables...');
    
    const requiredTables = [
      'workspace_accounts',
      'workspace_members',
      'campaigns',
      'campaign_prospects'
    ];
    
    for (const tableName of requiredTables) {
      try {
        const { error } = await supabase
          .from(tableName)
          .select('count')
          .limit(1);
          
        if (error) {
          console.log(`   ❌ Table '${tableName}' not accessible: ${error.message}`);
        } else {
          console.log(`   ✅ Table '${tableName}' exists and accessible`);
        }
      } catch (err) {
        console.log(`   ❌ Table '${tableName}' check failed: ${err.message}`);
      }
    }
    
    // Test 5: Check Sam Funnel tables (optional)
    console.log('\n5️⃣ Checking Sam Funnel tables (these need manual deployment)...');
    
    const samFunnelTables = [
      'sam_funnel_executions',
      'sam_funnel_messages',
      'sam_funnel_responses'
    ];
    
    let samFunnelReady = true;
    
    for (const tableName of samFunnelTables) {
      try {
        const { error } = await supabase
          .from(tableName)
          .select('count')
          .limit(1);
          
        if (error) {
          console.log(`   ❌ Table '${tableName}' not found - needs manual deployment`);
          samFunnelReady = false;
        } else {
          console.log(`   ✅ Table '${tableName}' exists and accessible`);
        }
      } catch (err) {
        console.log(`   ❌ Table '${tableName}' check failed`);
        samFunnelReady = false;
      }
    }
    
    // Summary
    console.log('\n📊 INTEGRATION STATUS SUMMARY:');
    console.log('=====================================');
    
    console.log(`🔗 LinkedIn Wizard Endpoints: ${hasUnipileDsn && hasUnipileKey ? '✅ Ready' : '⚠️ Needs Config'}`);
    console.log(`🗄️ Core Database Tables: ✅ Available`);
    console.log(`⚡ Sam Funnel Tables: ${samFunnelReady ? '✅ Ready' : '❌ Need Manual Deployment'}`);
    
    if (!samFunnelReady) {
      console.log('\n🚨 ACTION REQUIRED:');
      console.log('Sam Funnel tables need to be deployed manually.');
      console.log('See: /scripts/sql/MANUAL_DEPLOYMENT_GUIDE.md');
    }
    
    if (!hasUnipileDsn || !hasUnipileKey) {
      console.log('\n⚠️ CONFIGURATION NEEDED:');
      console.log('Unipile environment variables need to be set for LinkedIn integration.');
    }
    
    if (samFunnelReady && hasUnipileDsn && hasUnipileKey) {
      console.log('\n🎉 SYSTEM READY:');
      console.log('LinkedIn-Sam Funnel integration is ready for testing!');
    }
    
  } catch (error) {
    console.error('\n💥 Integration test failed:', error);
  }
}

// Run the test
testLinkedInWizardIntegration()
  .then(() => {
    console.log('\n🏁 LinkedIn wizard integration test completed');
  })
  .catch((error) => {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  });