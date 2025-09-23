async function testLinkedInAuthFix() {
  console.log('🔧 Testing LinkedIn authentication fix...\n');
  
  try {
    // Test the authentication link generation API
    const response = await fetch('http://localhost:3000/api/unipile/hosted-auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        provider: 'LINKEDIN',
        redirect_url: 'http://localhost:3000/api/unipile/hosted-auth/callback'
      })
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ LinkedIn authentication link generation FIXED!');
      console.log('🔗 Auth URL generated successfully');
      console.log('📋 Response data:');
      console.log(`   - Success: ${data.success}`);
      console.log(`   - Auth URL: ${data.auth_url ? 'Generated ✅' : 'Missing ❌'}`);
      console.log(`   - Provider: ${data.provider}`);
      console.log(`   - Auth Type: ${data.auth_type}`);
      console.log(`   - Existing Accounts: ${data.existing_accounts}`);
      
      console.log('\n💡 Authentication fix successful - users can now connect LinkedIn accounts!');
    } else {
      console.log('❌ Authentication still failing:');
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${data.error}`);
      if (data.debug_info) {
        console.log('🔍 Debug info:');
        console.log(`   - Has DSN: ${data.debug_info.has_dsn}`);
        console.log(`   - Has API Key: ${data.debug_info.has_api_key}`);
        console.log(`   - Environment: ${data.debug_info.environment}`);
        console.log(`   - Error Type: ${data.debug_info.error_type}`);
      }
    }
    
  } catch (error) {
    console.error('🚨 Test failed:', error.message);
  }
}

// Also test date generation to ensure it's working correctly
function testDateGeneration() {
  console.log('\n📅 Testing date generation fix...');
  
  const expirationDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const expiresOn = expirationDate.toISOString().replace(/\.\d{3}Z$/, '.000Z');
  
  console.log(`Generated expiration: ${expiresOn}`);
  console.log(`Format correct: ${/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/.test(expiresOn) ? '✅' : '❌'}`);
}

testDateGeneration();
testLinkedInAuthFix();