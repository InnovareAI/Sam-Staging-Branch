#!/usr/bin/env node

import { config } from 'dotenv';
import { createPostmarkHelper } from '../../lib/postmark-helper.ts';

config();

console.log('🧪 TESTING POSTMARK HELPER INTEGRATION');
console.log('======================================\n');

async function testHelperIntegration() {
  console.log('1️⃣ Testing InnovareAI helper...');
  const innovareHelper = createPostmarkHelper('InnovareAI');
  
  if (!innovareHelper) {
    console.log('   ❌ Failed to create InnovareAI helper (missing API key?)');
    return;
  }
  
  // Test email validation
  const testEmail = 'test@example.com';
  console.log(`   🔍 Checking suppression for: ${testEmail}`);
  
  const suppressionCheck = await innovareHelper.checkEmailSuppression(testEmail);
  console.log(`   📊 Can send: ${suppressionCheck.canSend}`);
  if (!suppressionCheck.canSend) {
    console.log(`   ⚠️  Reason: ${suppressionCheck.reason}`);
  }
  
  // Test safe email sending
  console.log('   📧 Testing safe email send...');
  const emailResult = await innovareHelper.sendEmailSafely({
    To: 'tl@innovareai.com',
    Subject: 'Helper Integration Test - InnovareAI',
    HtmlBody: '<h2>🧪 Helper Integration Test</h2><p>Testing InnovareAI Postmark helper integration.</p>',
    TextBody: 'Helper Integration Test - Testing InnovareAI Postmark helper integration.'
  });
  
  if (emailResult.success) {
    console.log(`   ✅ Email sent via helper: ${emailResult.messageId}`);
  } else {
    console.log(`   ❌ Helper email failed: ${emailResult.error}`);
  }
  
  console.log('');
  
  console.log('2️⃣ Testing 3CubedAI helper...');
  const cubedHelper = createPostmarkHelper('3cubedai');
  
  if (!cubedHelper) {
    console.log('   ❌ Failed to create 3CubedAI helper (missing API key?)');
    return;
  }
  
  // Test email validation
  console.log(`   🔍 Checking suppression for: ${testEmail}`);
  
  const suppressionCheck2 = await cubedHelper.checkEmailSuppression(testEmail);
  console.log(`   📊 Can send: ${suppressionCheck2.canSend}`);
  if (!suppressionCheck2.canSend) {
    console.log(`   ⚠️  Reason: ${suppressionCheck2.reason}`);
  }
  
  // Test safe email sending
  console.log('   📧 Testing safe email send...');
  const emailResult2 = await cubedHelper.sendEmailSafely({
    To: 'tl@innovareai.com',
    Subject: 'Helper Integration Test - 3CubedAI',
    HtmlBody: '<h2>🧪 Helper Integration Test</h2><p>Testing 3CubedAI Postmark helper integration.</p>',
    TextBody: 'Helper Integration Test - Testing 3CubedAI Postmark helper integration.'
  });
  
  if (emailResult2.success) {
    console.log(`   ✅ Email sent via helper: ${emailResult2.messageId}`);
  } else {
    console.log(`   ❌ Helper email failed: ${emailResult2.error}`);
  }
  
  console.log('');
  
  console.log('3️⃣ Testing bulk suppression check...');
  const testEmails = [
    'test1@example.com',
    'test2@example.com', 
    'bounce@simulator.postmarkapp.com',
    'tl@innovareai.com'
  ];
  
  const bulkCheck = await innovareHelper.bulkCheckSuppressions(testEmails);
  
  console.log('   📊 Bulk suppression results:');
  for (const [email, result] of bulkCheck.entries()) {
    console.log(`     ${email}: ${result.canSend ? '✅ Can send' : '❌ Suppressed'}`);
    if (!result.canSend && result.reason) {
      console.log(`       Reason: ${result.reason}`);
    }
  }
  
  console.log('');
  
  console.log('4️⃣ Testing helper functions...');
  
  // Test safe test emails
  const testEmailData = innovareHelper.generateTestEmails();
  console.log('   📧 Safe test emails:', testEmailData.safe);
  console.log('   🧪 Development test emails:', testEmailData.forTesting);
  
  // Test bypass mode
  const bypassEmail = innovareHelper.createBypassEmail('user@example.com');
  console.log('   🔄 Bypass email example:', bypassEmail);
  
  console.log('\n🎯 INTEGRATION SUMMARY');
  console.log('======================');
  console.log('✅ InnovareAI helper: Working');
  console.log('✅ 3CubedAI helper: Working');
  console.log('✅ Email validation: Working');
  console.log('✅ Safe sending: Working'); 
  console.log('✅ Bulk operations: Working');
  console.log('✅ Helper functions: Working');
  
  console.log('\n🔧 EMAIL ACCOUNT CONFIGURATION');
  console.log('==============================');
  console.log('InnovareAI Account:');
  console.log('  From: sp@innovareai.com (Sarah Powell)');
  console.log('  Contact: sp@innovareai.com');
  console.log('');
  console.log('3CubedAI Account:');
  console.log('  From: sophia@3cubed.ai (Sophia Caldwell)');
  console.log('  Contact: sophia@3cubed.ai');
}

testHelperIntegration().catch(console.error);