#!/usr/bin/env node

import fetch from 'node-fetch';

console.log('🧪 TESTING ORGANIZATION-SPECIFIC AUTH FLOWS');
console.log('===========================================\n');

// Test configurations for both organizations
const orgs = {
  innovareai: {
    name: 'InnovareAI',
    domain: 'innovareai.com',
    testEmail: 'test+innovare@innovareai.com',
    expectedSender: 'sp@innovareai.com',
    expectedSenderName: 'Sarah Powell',
    workspace: 'InnovareAI Workspace'
  },
  cubedai: {
    name: '3CubedAI', 
    domain: '3cubed.ai',
    testEmail: 'test+3cubed@3cubed.ai',
    expectedSender: 'sophia@3cubed.ai',
    expectedSenderName: 'Sophia Caldwell',
    workspace: '3cubed Workspace'
  }
};

async function testSignupFlow(org) {
  console.log(`📝 Testing Signup Flow for ${org.name}...`);
  
  try {
    const signupData = {
      firstName: 'Test',
      lastName: 'User',
      email: org.testEmail,
      password: 'TestPassword123!'
    };
    
    const response = await fetch('http://localhost:3001/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(signupData)
    });
    
    const result = await response.json();
    
    console.log(`   📊 Status: ${response.status}`);
    console.log(`   📧 Email: ${org.testEmail}`);
    
    if (response.ok) {
      console.log(`   ✅ Signup successful: ${result.message}`);
      console.log(`   🔐 Requires verification: ${result.requiresVerification || false}`);
      return { success: true, data: result };
    } else {
      console.log(`   ❌ Signup failed: ${result.error}`);
      return { success: false, error: result.error };
    }
    
  } catch (error) {
    console.log(`   ❌ Network error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testPasswordReset(org) {
  console.log(`🔑 Testing Password Reset for ${org.name}...`);
  
  try {
    const resetData = {
      email: org.testEmail
    };
    
    const response = await fetch('http://localhost:3001/api/auth/reset-password', {
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(resetData)
    });
    
    const result = await response.json();
    
    console.log(`   📊 Status: ${response.status}`);
    console.log(`   📧 Email: ${org.testEmail}`);
    
    if (response.ok) {
      console.log(`   ✅ Reset request successful: ${result.message}`);
      return { success: true, data: result };
    } else {
      console.log(`   ❌ Reset failed: ${result.error}`);
      return { success: false, error: result.error };
    }
    
  } catch (error) {
    console.log(`   ❌ Network error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testMagicLink(org) {
  console.log(`✨ Testing Magic Link for ${org.name}...`);
  
  try {
    const magicLinkData = {
      email: org.testEmail
    };
    
    const response = await fetch('http://localhost:3001/api/auth/magic-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(magicLinkData)
    });
    
    const result = await response.json();
    
    console.log(`   📊 Status: ${response.status}`);
    console.log(`   📧 Email: ${org.testEmail}`);
    
    if (response.ok) {
      console.log(`   ✅ Magic link sent: ${result.message}`);
      return { success: true, data: result };
    } else {
      console.log(`   ❌ Magic link failed: ${result.error}`);
      return { success: false, error: result.error };
    }
    
  } catch (error) {
    console.log(`   ❌ Network error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function checkEmailConfiguration() {
  console.log('📧 Checking Email Configuration...');
  
  try {
    const response = await fetch('http://localhost:3001/api/test-postmark-accounts');
    const result = await response.json();
    
    if (response.ok && result.summary) {
      console.log('   ✅ Postmark accounts configured:');
      console.log(`     InnovareAI: ${result.summary.configuration.innovareai.from} (${result.summary.configuration.innovareai.contactName})`);
      console.log(`     3CubedAI: ${result.summary.configuration.cubedai.from} (${result.summary.configuration.cubedai.contactName})`);
      console.log(`     Status: ${result.summary.status.innovareai.email && result.summary.status.cubedai.email ? '✅ Both working' : '❌ Issues detected'}`);
      return true;
    } else {
      console.log('   ❌ Email configuration check failed');
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Error checking email config: ${error.message}`);
    return false;
  }
}

async function checkWorkspaceAssignment() {
  console.log('🏢 Checking Workspace Assignment Logic...');
  
  try {
    const response = await fetch('http://localhost:3001/api/admin/workspaces');
    const result = await response.json();
    
    if (response.ok && result.workspaces) {
      console.log(`   ✅ Found ${result.total} workspaces:`);
      result.workspaces.forEach(workspace => {
        console.log(`     - ${workspace.name} (${workspace.slug})`);
      });
      
      // Check if we can identify organization by email domain
      const innovareWorkspace = result.workspaces.find(w => w.name.includes('InnovareAI') || w.slug.includes('innovareai'));
      const cubedWorkspace = result.workspaces.find(w => w.name.includes('3cubed') || w.slug.includes('3cubed'));
      
      console.log(`   📊 InnovareAI workspace: ${innovareWorkspace ? '✅ Found' : '❌ Missing'}`);
      console.log(`   📊 3CubedAI workspace: ${cubedWorkspace ? '✅ Found' : '❌ Missing'}`);
      
      return { innovareWorkspace, cubedWorkspace };
    } else {
      console.log('   ❌ Workspace check failed');
      return null;
    }
  } catch (error) {
    console.log(`   ❌ Error checking workspaces: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🔧 PRE-FLIGHT CHECKS');
  console.log('====================');
  
  // Check email configuration
  const emailConfigOk = await checkEmailConfiguration();
  console.log('');
  
  // Check workspace setup
  const workspaces = await checkWorkspaceAssignment();
  console.log('');
  
  if (!emailConfigOk) {
    console.log('❌ Email configuration issues detected. Skipping auth flow tests.');
    return;
  }
  
  console.log('🧪 AUTHENTICATION FLOW TESTS');
  console.log('=============================');
  
  const results = {};
  
  // Test both organizations
  for (const [orgKey, org] of Object.entries(orgs)) {
    console.log(`\n🏢 Testing ${org.name} Organization`);
    console.log('─'.repeat(40));
    
    results[orgKey] = {
      signup: await testSignupFlow(org),
      passwordReset: await testPasswordReset(org), 
      magicLink: await testMagicLink(org)
    };
    
    console.log('');
  }
  
  console.log('📊 SUMMARY REPORT');
  console.log('=================');
  
  console.log('\n📧 Email Routing Configuration:');
  console.log('InnovareAI (@innovareai.com) → sp@innovareai.com (Sarah Powell)');
  console.log('3CubedAI (@3cubed.ai) → sophia@3cubed.ai (Sophia Caldwell)');
  
  console.log('\n🧪 Test Results:');
  for (const [orgKey, org] of Object.entries(orgs)) {
    const result = results[orgKey];
    console.log(`\n${org.name}:`);
    console.log(`  Signup: ${result.signup.success ? '✅ Working' : '❌ Failed'}`);
    console.log(`  Password Reset: ${result.passwordReset.success ? '✅ Working' : '❌ Failed'}`);
    console.log(`  Magic Link: ${result.magicLink.success ? '✅ Working' : '❌ Failed'}`);
    
    if (!result.signup.success || !result.passwordReset.success || !result.magicLink.success) {
      console.log(`  Issues detected for ${org.name}`);
    }
  }
  
  // Overall status
  const allWorking = Object.values(results).every(orgResult => 
    orgResult.signup.success && orgResult.passwordReset.success && orgResult.magicLink.success
  );
  
  console.log(`\n🎯 Overall Status: ${allWorking ? '✅ All auth flows working for both organizations' : '❌ Issues detected'}`);
  
  if (!allWorking) {
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check Postmark account configurations');
    console.log('2. Verify email domain routing logic');
    console.log('3. Check Supabase email template configurations');
    console.log('4. Verify workspace assignment logic');
    console.log('5. Check environment variables for both organizations');
  }
  
  console.log('\n💡 Next Steps:');
  console.log('1. Test actual email delivery by checking inboxes');
  console.log('2. Verify email templates use correct sender addresses');
  console.log('3. Test workspace assignment based on email domain');
  console.log('4. Confirm neutral SAM AI branding in email templates');
}

main().catch(console.error);