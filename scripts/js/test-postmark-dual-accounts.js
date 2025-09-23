#!/usr/bin/env node

import { config } from 'dotenv';
config();

console.log('🧪 TESTING DUAL POSTMARK EMAIL ACCOUNTS');
console.log('=====================================\n');

async function testPostmarkAccount(accountName, apiKey, fromEmail, toEmail) {
  console.log(`📧 Testing ${accountName} account...`);
  console.log(`   API Key: ${apiKey.substring(0, 8)}...`);
  console.log(`   From: ${fromEmail}`);
  console.log(`   To: ${toEmail}`);
  
  try {
    const response = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': apiKey
      },
      body: JSON.stringify({
        From: `${accountName} SAM AI <${fromEmail}>`,
        To: toEmail,
        Subject: `Test Email from ${accountName} - ${new Date().toLocaleString()}`,
        HtmlBody: `
          <h2>🧪 Test Email from ${accountName}</h2>
          <p>This is a test email sent from the ${accountName} Postmark account.</p>
          <p><strong>From:</strong> ${fromEmail}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Purpose:</strong> Verify dual email account configuration</p>
        `,
        TextBody: `
Test Email from ${accountName}

This is a test email sent from the ${accountName} Postmark account.
From: ${fromEmail}
Time: ${new Date().toLocaleString()}
Purpose: Verify dual email account configuration
        `,
        MessageStream: 'outbound'
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log(`   ✅ SUCCESS: Email sent successfully`);
      console.log(`   📬 Message ID: ${result.MessageID}`);
      console.log(`   📅 Submitted At: ${result.SubmittedAt}`);
      return { success: true, messageId: result.MessageID };
    } else {
      console.log(`   ❌ FAILED: ${result.Message || 'Unknown error'}`);
      console.log(`   🔧 Error Code: ${result.ErrorCode || 'N/A'}`);
      return { success: false, error: result.Message, errorCode: result.ErrorCode };
    }
  } catch (error) {
    console.log(`   ❌ NETWORK ERROR: ${error.message}`);
    return { success: false, error: error.message };
  }
  console.log('');
}

async function testAccountStatus(accountName, apiKey) {
  console.log(`🔍 Checking ${accountName} account status...`);
  
  try {
    const response = await fetch('https://api.postmarkapp.com/server', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Postmark-Server-Token': apiKey
      }
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log(`   ✅ Account Active`);
      console.log(`   📛 Server Name: ${result.Name}`);
      console.log(`   🌍 API Tokens: ${result.ApiTokens || 'N/A'}`);
      console.log(`   📊 InboundHookUrl: ${result.InboundHookUrl || 'None'}`);
      console.log(`   🔒 Color: ${result.Color || 'Default'}`);
      return { success: true, serverInfo: result };
    } else {
      console.log(`   ❌ Account Check Failed: ${result.Message}`);
      return { success: false, error: result.Message };
    }
  } catch (error) {
    console.log(`   ❌ Network Error: ${error.message}`);
    return { success: false, error: error.message };
  }
  console.log('');
}

async function main() {
  // Get environment variables
  const innovareApiKey = process.env.POSTMARK_INNOVAREAI_API_KEY;
  const cubedApiKey = process.env.POSTMARK_3CUBEDAI_API_KEY;
  
  console.log('🔑 Environment Variables Check:');
  console.log(`   POSTMARK_INNOVAREAI_API_KEY: ${innovareApiKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`   POSTMARK_3CUBEDAI_API_KEY: ${cubedApiKey ? '✅ Set' : '❌ Missing'}`);
  console.log('');

  if (!innovareApiKey || !cubedApiKey) {
    console.log('❌ Missing API keys. Please check your environment variables.');
    return;
  }

  const results = {
    innovareai: null,
    cubedai: null
  };

  // Test InnovareAI account status
  console.log('📋 ACCOUNT STATUS CHECKS');
  console.log('========================');
  const innovareStatus = await testAccountStatus('InnovareAI', innovareApiKey);
  const cubedStatus = await testAccountStatus('3CubedAI', cubedApiKey);

  // Test InnovareAI email sending
  console.log('📧 EMAIL SENDING TESTS');
  console.log('======================');
  results.innovareai = await testPostmarkAccount(
    'InnovareAI',
    innovareApiKey,
    'sp@innovareai.com',
    'tl@innovareai.com'  // Test email
  );

  // Test 3CubedAI email sending
  results.cubedai = await testPostmarkAccount(
    '3CubedAI',
    cubedApiKey,
    'sophia@3cubed.ai',
    'tl@innovareai.com'  // Test email
  );

  // Summary
  console.log('📊 SUMMARY');
  console.log('==========');
  console.log(`InnovareAI Account: ${innovareStatus.success ? '✅ Active' : '❌ Issues'}`);
  console.log(`InnovareAI Email:   ${results.innovareai.success ? '✅ Working' : '❌ Failed'}`);
  console.log(`3CubedAI Account:   ${cubedStatus.success ? '✅ Active' : '❌ Issues'}`);
  console.log(`3CubedAI Email:     ${results.cubedai.success ? '✅ Working' : '❌ Failed'}`);
  
  const allWorking = innovareStatus.success && cubedStatus.success && 
                     results.innovareai.success && results.cubedai.success;
  
  console.log(`\n🎯 Overall Status: ${allWorking ? '✅ All systems operational' : '❌ Issues detected'}`);
  
  if (!allWorking) {
    console.log('\n🔧 Troubleshooting:');
    if (!innovareStatus.success || !results.innovareai.success) {
      console.log('   - Check InnovareAI Postmark account and API key');
    }
    if (!cubedStatus.success || !results.cubedai.success) {
      console.log('   - Check 3CubedAI Postmark account and API key');
    }
    console.log('   - Verify domain configurations in Postmark dashboard');
    console.log('   - Check for any suppressed email addresses');
  }
}

main().catch(console.error);