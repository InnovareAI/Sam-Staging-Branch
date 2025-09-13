// Integration test script to verify authentication flow

const BASE_URL = 'http://localhost:3003';

async function testSignupFlow() {
  console.log('🔄 Testing Signup Flow...\n');

  // Test data
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'TestPassword123',
    firstName: 'Test',
    lastName: 'User'
  };

  try {
    // Step 1: Test signup API
    console.log('1. Testing signup API...');
    const signupResponse = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testUser),
    });

    const signupData = await signupResponse.json();
    console.log('   Status:', signupResponse.status);
    console.log('   Response:', JSON.stringify(signupData, null, 2));

    if (signupResponse.ok) {
      console.log('   ✅ Signup API working');
    } else {
      console.log('   ❌ Signup API failed');
    }

  } catch (error) {
    console.log('   ❌ Signup API error:', error.message);
  }
}

async function testPasswordReset() {
  console.log('\n🔄 Testing Password Reset Flow...\n');

  try {
    // Test password reset API
    console.log('2. Testing password reset API...');
    const resetResponse = await fetch(`${BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const resetData = await resetResponse.json();
    console.log('   Status:', resetResponse.status);
    console.log('   Response:', JSON.stringify(resetData, null, 2));

    if (resetResponse.ok) {
      console.log('   ✅ Password reset API working');
    } else {
      console.log('   ❌ Password reset API failed');
    }

  } catch (error) {
    console.log('   ❌ Password reset API error:', error.message);
  }
}

async function testMagicLink() {
  console.log('\n🔄 Testing Magic Link Flow...\n');

  try {
    // Test magic link API
    console.log('3. Testing magic link API...');
    const magicResponse = await fetch(`${BASE_URL}/api/auth/magic-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const magicData = await magicResponse.json();
    console.log('   Status:', magicResponse.status);
    console.log('   Response:', JSON.stringify(magicData, null, 2));

    if (magicResponse.ok) {
      console.log('   ✅ Magic link API working');
    } else {
      console.log('   ❌ Magic link API failed');
    }

  } catch (error) {
    console.log('   ❌ Magic link API error:', error.message);
  }
}

async function checkServerStatus() {
  console.log('🔄 Checking Server Status...\n');
  
  try {
    const response = await fetch(`${BASE_URL}/`);
    console.log('   Server Status:', response.status);
    
    if (response.ok) {
      console.log('   ✅ Server is running');
      return true;
    } else {
      console.log('   ❌ Server returned error status');
      return false;
    }
  } catch (error) {
    console.log('   ❌ Server connection error:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🧪 SAM AI Authentication Integration Tests\n');
  console.log('==========================================\n');

  // Check if server is running
  const serverRunning = await checkServerStatus();
  
  if (!serverRunning) {
    console.log('\n❌ Server is not running. Please start the development server with: npm run dev');
    process.exit(1);
  }

  // Run individual tests
  await testSignupFlow();
  await testPasswordReset();  
  await testMagicLink();

  console.log('\n==========================================');
  console.log('🏁 Integration Tests Completed');
  console.log('==========================================');
}

// Run the tests
runTests().catch(console.error);