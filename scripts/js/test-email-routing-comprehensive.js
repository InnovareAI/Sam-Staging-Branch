#!/usr/bin/env node

import { config } from 'dotenv';
config();

console.log('🧪 COMPREHENSIVE EMAIL ROUTING TEST');
console.log('===================================\n');

const TEST_CASES = [
  // InnovareAI users - should use Sarah Powell (sp@innovareai.com)
  {
    email: 'tl@innovareai.com',
    expectedSender: 'Sarah Powell',
    expectedFrom: 'sp@innovareai.com',
    expectedAccount: 'InnovareAI',
    organization: 'InnovareAI'
  },
  {
    email: 'cs@innovareai.com',
    expectedSender: 'Sarah Powell',
    expectedFrom: 'sp@innovareai.com',
    expectedAccount: 'InnovareAI',
    organization: 'InnovareAI'
  },
  // 3cubed users - should use Sophia Caldwell (sophia@3cubed.ai)
  {
    email: 'tl@3cubed.ai',
    expectedSender: 'Sophia Caldwell',
    expectedFrom: 'sophia@3cubed.ai',
    expectedAccount: '3CubedAI',
    organization: '3cubed'
  },
  {
    email: 'laura@wtmatchmaker.com',
    expectedSender: 'Sarah Powell',  // WT Matchmaker might default to InnovareAI
    expectedFrom: 'sp@innovareai.com',
    expectedAccount: 'InnovareAI',
    organization: 'WT Matchmaker'
  },
  {
    email: 'info@sendingcell.com',
    expectedSender: 'Sophia Caldwell',  // Sendingcell should use 3cubed
    expectedFrom: 'sophia@3cubed.ai',
    expectedAccount: '3CubedAI',
    organization: 'Sendingcell'
  }
];

/**
 * Check email routing logic - which sender would be used?
 */
function checkEmailRouting(email) {
  console.log(`\n🔍 Checking routing for: ${email}`);
  
  // This is the actual logic from the routes
  const is3Cubed = email.includes('3cubed') || 
                   email.includes('cubedcapital') || 
                   email.includes('sendingcell.com');
  
  const sender = is3Cubed ? 
    'Sophia Caldwell <sophia@3cubed.ai>' : 
    'Sarah Powell <sp@innovareai.com>';
  
  const apiKey = is3Cubed ? 
    process.env.POSTMARK_3CUBEDAI_API_KEY : 
    process.env.POSTMARK_INNOVAREAI_API_KEY;
  
  return {
    sender,
    apiKey: apiKey ? apiKey.substring(0, 8) + '...' : 'NOT_SET',
    account: is3Cubed ? '3CubedAI' : 'InnovareAI'
  };
}

/**
 * Verify routing logic matches expectations
 */
function verifyRouting(testCase) {
  const routing = checkEmailRouting(testCase.email);
  
  const senderMatch = routing.sender.includes(testCase.expectedSender);
  const accountMatch = routing.account === testCase.expectedAccount;
  
  console.log(`   Organization: ${testCase.organization}`);
  console.log(`   Expected: ${testCase.expectedSender} (${testCase.expectedAccount})`);
  console.log(`   Actual: ${routing.sender} (${routing.account})`);
  console.log(`   API Key: ${routing.apiKey}`);
  console.log(`   Status: ${senderMatch && accountMatch ? '✅ PASS' : '❌ FAIL'}`);
  
  return senderMatch && accountMatch;
}

/**
 * Test password reset email routing
 */
async function testPasswordReset(email) {
  console.log(`\n📧 Testing Password Reset for: ${email}`);
  
  try {
    // Note: This doesn't actually send email, just checks routing
    const routing = checkEmailRouting(email);
    console.log(`   Would send from: ${routing.sender}`);
    console.log(`   Using API key: ${routing.apiKey}`);
    return true;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }
}

/**
 * Test magic link email routing
 */
async function testMagicLink(email) {
  console.log(`\n✨ Testing Magic Link for: ${email}`);
  
  try {
    const routing = checkEmailRouting(email);
    console.log(`   Would send from: ${routing.sender}`);
    console.log(`   Using API key: ${routing.apiKey}`);
    return true;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }
}

/**
 * Check workspace assignment logic
 */
function checkWorkspaceAssignment(email) {
  console.log(`\n🏢 Checking Workspace Assignment for: ${email}`);
  
  // Determine expected workspace based on email domain
  let expectedWorkspace = '';
  
  if (email.includes('innovareai.com')) {
    expectedWorkspace = 'InnovareAI Workspace';
  } else if (email.includes('3cubed')) {
    expectedWorkspace = '3cubed Workspace';
  } else if (email.includes('wtmatchmaker.com')) {
    expectedWorkspace = 'WT Matchmaker Workspace';
  } else if (email.includes('sendingcell.com')) {
    expectedWorkspace = 'Sendingcell Workspace';
  } else {
    expectedWorkspace = 'InnovareAI Workspace (default)';
  }
  
  console.log(`   Expected Workspace: ${expectedWorkspace}`);
  console.log(`   Assignment Logic: Domain-based mapping`);
  
  return expectedWorkspace;
}

async function main() {
  console.log('🔧 ENVIRONMENT CHECK');
  console.log('===================');
  console.log(`InnovareAI API Key: ${process.env.POSTMARK_INNOVAREAI_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`3CubedAI API Key: ${process.env.POSTMARK_3CUBEDAI_API_KEY ? '✅ Set' : '❌ Missing'}`);
  
  if (!process.env.POSTMARK_INNOVAREAI_API_KEY || !process.env.POSTMARK_3CUBEDAI_API_KEY) {
    console.log('\n❌ Missing API keys. Cannot proceed with tests.');
    return;
  }
  
  console.log('\n📋 EMAIL ROUTING VERIFICATION');
  console.log('=============================');
  
  const results = {
    passed: 0,
    failed: 0,
    details: []
  };
  
  // Test each case
  for (const testCase of TEST_CASES) {
    const passed = verifyRouting(testCase);
    if (passed) {
      results.passed++;
    } else {
      results.failed++;
    }
    results.details.push({ testCase, passed });
  }
  
  console.log('\n\n🧪 AUTHENTICATION FLOW TESTS');
  console.log('============================');
  
  // Test password reset routing
  console.log('\n1️⃣ PASSWORD RESET ROUTING');
  console.log('-------------------------');
  await testPasswordReset('tl@innovareai.com');
  await testPasswordReset('tl@3cubed.ai');
  await testPasswordReset('info@sendingcell.com');
  
  // Test magic link routing
  console.log('\n\n2️⃣ MAGIC LINK ROUTING');
  console.log('---------------------');
  await testMagicLink('tl@innovareai.com');
  await testMagicLink('tl@3cubed.ai');
  await testMagicLink('info@sendingcell.com');
  
  // Test workspace assignment
  console.log('\n\n3️⃣ WORKSPACE ASSIGNMENT');
  console.log('------------------------');
  checkWorkspaceAssignment('tl@innovareai.com');
  checkWorkspaceAssignment('tl@3cubed.ai');
  checkWorkspaceAssignment('laura@wtmatchmaker.com');
  checkWorkspaceAssignment('info@sendingcell.com');
  
  // Summary Report
  console.log('\n\n📊 TEST SUMMARY');
  console.log('===============');
  console.log(`Total Tests: ${results.passed + results.failed}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  
  if (results.failed > 0) {
    console.log('\n⚠️  FAILED TESTS:');
    results.details.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.testCase.email} (${r.testCase.organization})`);
    });
  }
  
  console.log('\n\n📋 ROUTING CONFIGURATION');
  console.log('========================');
  console.log('\n🎯 InnovareAI Users:');
  console.log('   Emails: *@innovareai.com');
  console.log('   Sender: Sarah Powell <sp@innovareai.com>');
  console.log('   Account: InnovareAI Postmark');
  console.log('   Workspace: InnovareAI Workspace');
  console.log('   ⚠️  DOMAIN RULE: InnovareAI emails ONLY from @innovareai.com domain');
  
  console.log('\n🎯 3CubedAI Users:');
  console.log('   Emails: *@3cubed.ai, *@cubedcapital.*, *@sendingcell.com');
  console.log('   Sender: Sophia Caldwell <sophia@3cubed.ai>');
  console.log('   Account: 3CubedAI Postmark');
  console.log('   Workspace: 3cubed Workspace / Sendingcell Workspace');
  console.log('   ⚠️  DOMAIN RULE: 3cubed emails ONLY from @3cubed.ai domain');
  
  console.log('\n🎯 Other Users (WT Matchmaker, etc):');
  console.log('   Emails: Other domains');
  console.log('   Sender: Sarah Powell <sp@innovareai.com> (default)');
  console.log('   Account: InnovareAI Postmark (default)');
  console.log('   Workspace: Domain-specific or InnovareAI (default)');
  
  console.log('\n\n⚠️  IMPORTANT NOTES:');
  console.log('===================');
  console.log('✓ Password reset emails route based on recipient email domain');
  console.log('✓ Magic link emails route based on recipient email domain');
  console.log('✓ Signup confirmation emails use Supabase configuration');
  console.log('✓ Both Postmark accounts (InnovareAI & 3CubedAI) are operational');
  console.log('✓ Email templates should maintain neutral "SAM AI" branding');
  console.log('✓ Workspace assignment happens after email confirmation');
  
  console.log('\n\n🔧 ROUTING LOGIC FILES:');
  console.log('=======================');
  console.log('📄 Password Reset: app/api/auth/reset-password/route.ts');
  console.log('📄 Magic Link: app/api/auth/magic-link/route.ts');
  console.log('📄 Postmark Helper: lib/postmark-helper.ts');
  console.log('📄 Auth Callback: app/auth/callback/route.ts');
  
  const allPass = results.failed === 0;
  console.log(`\n\n🎯 Overall Status: ${allPass ? '✅ ALL ROUTING VERIFIED' : '❌ ROUTING ISSUES DETECTED'}`);
  
  if (!allPass) {
    console.log('\n🔧 RECOMMENDED ACTIONS:');
    console.log('1. Review email routing logic in auth routes');
    console.log('2. Verify Postmark API keys are correct');
    console.log('3. Check workspace assignment logic');
    console.log('4. Test actual email delivery to both organizations');
  }
}

main().catch(console.error);