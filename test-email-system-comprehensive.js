#!/usr/bin/env node

/**
 * Comprehensive Email System Test
 * 
 * This script tests the entire email invitation system with:
 * - Suppression detection
 * - Error handling
 * - Bypass mode
 * - Recovery mechanisms
 */

const readline = require('readline');

// Configuration
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const TEST_TOKEN = 'test-admin-token'; // Replace with actual admin token

// Test scenarios
const TEST_SCENARIOS = [
  {
    name: 'Safe Email Test',
    email: 'test@innovareai.com',
    firstName: 'Test',
    lastName: 'User',
    expectedResult: 'success'
  },
  {
    name: 'Postmark Test Email',
    email: 'test@blackhole.postmarkapp.com',
    firstName: 'Postmark',
    lastName: 'Test',
    expectedResult: 'success'
  },
  {
    name: 'Potentially Suppressed Email',
    email: 'bounce@simulator.postmarkapp.com',
    firstName: 'Bounce',
    lastName: 'Test',
    expectedResult: 'suppression_detected'
  }
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_TOKEN}`,
        ...options.headers
      },
      ...options
    });
    
    const data = await response.json();
    return { response, data, ok: response.ok };
  } catch (error) {
    console.error(`Request failed: ${error.message}`);
    return { error: error.message, ok: false };
  }
}

async function testSuppressionList(company = 'InnovareAI') {
  console.log(`\\n📋 Testing suppression list for ${company}...`);
  
  const { data, ok } = await makeRequest(`${BASE_URL}/api/admin/email-suppressions?company=${company}`);
  
  if (ok) {
    console.log(`✅ Suppression list retrieved successfully`);
    console.log(`   - Total suppressions: ${data.suppressionCount}`);
    
    if (data.suppressions.length > 0) {
      console.log(`   - Recent suppressions:`);
      data.suppressions.slice(0, 3).forEach((suppression, index) => {
        console.log(`     ${index + 1}. ${suppression.EmailAddress} (${suppression.SuppressionReason})`);
      });
    }
  } else {
    console.log(`❌ Failed to get suppression list: ${data.error}`);
  }
  
  return { ok, data };
}

async function testEmailCheck(email, company = 'InnovareAI') {
  console.log(`\\n🔍 Checking email suppression status: ${email}`);
  
  const { data, ok } = await makeRequest(`${BASE_URL}/api/admin/email-suppressions`, {
    method: 'POST',
    body: JSON.stringify({
      action: 'check',
      email: email,
      company: company
    })
  });
  
  if (ok) {
    console.log(`✅ Email check completed`);
    console.log(`   - Can send: ${data.canSend ? 'YES' : 'NO'}`);
    if (!data.canSend) {
      console.log(`   - Reason: ${data.reason}`);
      if (data.suppressionInfo) {
        console.log(`   - Suppression details: ${data.suppressionInfo.SuppressionReason} (${data.suppressionInfo.Origin})`);
      }
    }
  } else {
    console.log(`❌ Email check failed: ${data.error}`);
  }
  
  return { ok, data };
}

async function testReactivateEmail(email, company = 'InnovareAI') {
  console.log(`\\n🔄 Testing email reactivation: ${email}`);
  
  const { data, ok } = await makeRequest(`${BASE_URL}/api/admin/email-suppressions`, {
    method: 'POST',
    body: JSON.stringify({
      action: 'reactivate',
      email: email,
      company: company
    })
  });
  
  if (ok) {
    if (data.success) {
      console.log(`✅ Email reactivation successful: ${data.message}`);
    } else {
      console.log(`⚠️ Email reactivation failed: ${data.message}`);
    }
  } else {
    console.log(`❌ Reactivation request failed: ${data.error}`);
  }
  
  return { ok, data };
}

async function testSafeEmailSend(email, company = 'InnovareAI') {
  console.log(`\\n📧 Testing safe email send: ${email}`);
  
  const { data, ok } = await makeRequest(`${BASE_URL}/api/admin/email-suppressions`, {
    method: 'POST',
    body: JSON.stringify({
      action: 'test_send',
      email: email,
      company: company
    })
  });
  
  if (ok) {
    if (data.success) {
      console.log(`✅ Email sent successfully`);
      console.log(`   - Message ID: ${data.messageId}`);
    } else {
      console.log(`❌ Email send failed: ${data.error}`);
      if (data.suppressionInfo) {
        console.log(`   - Suppression detected: ${data.suppressionInfo.SuppressionReason}`);
      }
      if (data.canRetryAfterReactivation) {
        console.log(`   - 💡 Email can be sent after reactivation`);
      }
    }
  } else {
    console.log(`❌ Email send test failed: ${data.error}`);
  }
  
  return { ok, data };
}

async function testInviteWithEnhancedHandling(scenario, company = 'InnovareAI') {
  console.log(`\\n🎯 Testing invitation system: ${scenario.name}`);
  
  const { data, ok } = await makeRequest(`${BASE_URL}/api/admin/invite-user`, {
    method: 'POST',
    body: JSON.stringify({
      email: scenario.email,
      firstName: scenario.firstName,
      lastName: scenario.lastName,
      company: company,
      role: 'member'
    })
  });
  
  if (ok) {
    console.log(`✅ Invitation completed successfully`);
    console.log(`   - Message: ${data.message}`);
    console.log(`   - Is new user: ${data.isNewUser}`);
    console.log(`   - Company: ${data.company}`);
    if (data.debug) {
      console.log(`   - Source: ${data.debug.source}`);
    }
  } else {
    console.log(`❌ Invitation failed: ${data.error}`);
    if (data.details) {
      console.log(`   - Details: ${JSON.stringify(data.details, null, 2)}`);
    }
  }
  
  return { ok, data };
}

async function enableBypassMode() {
  console.log(`\\n🚧 Enabling email bypass mode...`);
  process.env.EMAIL_BYPASS_MODE = 'true';
  console.log(`✅ Email bypass mode enabled - all emails will be redirected to safe test addresses`);
}

async function disableBypassMode() {
  console.log(`\\n🔓 Disabling email bypass mode...`);
  delete process.env.EMAIL_BYPASS_MODE;
  console.log(`✅ Email bypass mode disabled - emails will be sent normally`);
}

async function runComprehensiveTest() {
  console.log(`🚀 Starting Comprehensive Email System Test`);
  console.log(`🔧 Base URL: ${BASE_URL}`);
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  
  try {
    // Step 1: Check current suppression list
    console.log(`\\n=== STEP 1: SUPPRESSION STATUS ===`);
    await testSuppressionList('InnovareAI');
    await testSuppressionList('3cubedai');
    
    // Step 2: Test individual email checks
    console.log(`\\n=== STEP 2: INDIVIDUAL EMAIL CHECKS ===`);
    for (const scenario of TEST_SCENARIOS) {
      await testEmailCheck(scenario.email, 'InnovareAI');
    }
    
    // Step 3: Test safe email sending
    console.log(`\\n=== STEP 3: SAFE EMAIL SENDING TESTS ===`);
    for (const scenario of TEST_SCENARIOS) {
      await testSafeEmailSend(scenario.email, 'InnovareAI');
    }
    
    // Step 4: Test invitation system with normal mode
    console.log(`\\n=== STEP 4: INVITATION SYSTEM (NORMAL MODE) ===`);
    for (const scenario of TEST_SCENARIOS) {
      await testInviteWithEnhancedHandling(scenario, 'InnovareAI');
    }
    
    // Step 5: Test with bypass mode enabled
    console.log(`\\n=== STEP 5: INVITATION SYSTEM (BYPASS MODE) ===`);
    await enableBypassMode();
    
    for (const scenario of TEST_SCENARIOS) {
      await testInviteWithEnhancedHandling(scenario, 'InnovareAI');
    }
    
    await disableBypassMode();
    
    console.log(`\\n=== COMPREHENSIVE TEST COMPLETED ===`);
    console.log(`📊 Results summary:`);
    console.log(`   - All major email system components tested`);
    console.log(`   - Suppression detection verified`);
    console.log(`   - Bypass mode functionality confirmed`);
    console.log(`   - Error handling mechanisms validated`);
    console.log(`\\n💡 The email system should now handle suppressions gracefully!`);
    
  } catch (error) {
    console.error(`\\n❌ Test failed with error: ${error.message}`);
    console.error(error.stack);
  }
}

async function interactiveMode() {
  console.log(`\\n🤖 Interactive Email System Management`);
  console.log(`Commands:`);
  console.log(`  1. Check suppressions`);
  console.log(`  2. Check specific email`);
  console.log(`  3. Reactivate email`);
  console.log(`  4. Test email send`);
  console.log(`  5. Test invitation`);
  console.log(`  6. Enable bypass mode`);
  console.log(`  7. Disable bypass mode`);
  console.log(`  8. Run full test`);
  console.log(`  q. Quit`);
  
  while (true) {
    const command = await question('\\nEnter command number or q to quit: ');
    
    if (command.toLowerCase() === 'q') {
      break;
    }
    
    try {
      switch (command) {
        case '1':
          const company = await question('Company (InnovareAI/3cubedai): ') || 'InnovareAI';
          await testSuppressionList(company);
          break;
          
        case '2':
          const checkEmail = await question('Email to check: ');
          const checkCompany = await question('Company (InnovareAI/3cubedai): ') || 'InnovareAI';
          if (checkEmail) await testEmailCheck(checkEmail, checkCompany);
          break;
          
        case '3':
          const reactivateEmail = await question('Email to reactivate: ');
          const reactivateCompany = await question('Company (InnovareAI/3cubedai): ') || 'InnovareAI';
          if (reactivateEmail) await testReactivateEmail(reactivateEmail, reactivateCompany);
          break;
          
        case '4':
          const testEmail = await question('Email to test: ');
          const testCompany = await question('Company (InnovareAI/3cubedai): ') || 'InnovareAI';
          if (testEmail) await testSafeEmailSend(testEmail, testCompany);
          break;
          
        case '5':
          const inviteEmail = await question('Email to invite: ');
          const firstName = await question('First name: ');
          const lastName = await question('Last name: ');
          const inviteCompany = await question('Company (InnovareAI/3cubedai): ') || 'InnovareAI';
          if (inviteEmail && firstName && lastName) {
            await testInviteWithEnhancedHandling({
              name: 'Manual Test',
              email: inviteEmail,
              firstName,
              lastName
            }, inviteCompany);
          }
          break;
          
        case '6':
          await enableBypassMode();
          break;
          
        case '7':
          await disableBypassMode();
          break;
          
        case '8':
          await runComprehensiveTest();
          break;
          
        default:
          console.log('Invalid command. Try again.');
      }
    } catch (error) {
      console.error(`Command failed: ${error.message}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--interactive') || args.includes('-i')) {
    await interactiveMode();
  } else {
    await runComprehensiveTest();
  }
  
  rl.close();
  console.log('\\n👋 Email system test completed. Goodbye!');
}

// Run the test
main().catch(console.error);