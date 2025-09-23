#!/usr/bin/env node

// Test what the frontend is doing by simulating the exact API calls

console.log('🧪 TESTING FRONTEND LOADING BEHAVIOR');
console.log('====================================\n');

async function testFrontendAPICalls() {
  console.log('📡 Testing frontend API calls on port 3001...');
  
  try {
    // Test the main page load first
    console.log('\n1. Testing main page load...');
    const pageResponse = await fetch('http://localhost:3001');
    console.log(`   Page status: ${pageResponse.status}`);
    console.log(`   Page content-type: ${pageResponse.headers.get('content-type')}`);
    
    // Test admin workspaces API (what frontend calls)
    console.log('\n2. Testing admin workspaces API...');
    const apiResponse = await fetch('http://localhost:3001/api/admin/workspaces', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`   API status: ${apiResponse.status}`);
    console.log(`   API content-type: ${apiResponse.headers.get('content-type')}`);
    
    if (apiResponse.ok) {
      const data = await apiResponse.json();
      console.log(`   ✅ API returns ${data.total} workspaces`);
      console.log(`   ✅ Workspace names: ${data.workspaces.map(w => w.name).join(', ')}`);
    } else {
      console.log(`   ❌ API failed with status ${apiResponse.status}`);
    }
    
    // Test auth session (what frontend checks first)
    console.log('\n3. Testing auth session...');
    const authResponse = await fetch('http://localhost:3001/api/auth/session', {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    console.log(`   Auth status: ${authResponse.status}`);
    if (authResponse.ok) {
      const authData = await authResponse.json();
      console.log(`   Auth result: ${authData ? 'User logged in' : 'No session'}`);
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

async function testLoadingIssue() {
  console.log('\n🔍 DIAGNOSING LOADING STATE ISSUE');
  console.log('=================================');
  
  console.log('Possible causes of loading state:');
  console.log('1. 🔐 Authentication/session issues');
  console.log('2. 🌐 API calls failing or timing out');
  console.log('3. 📱 Frontend JavaScript errors');
  console.log('4. 🔄 Infinite loading loops');
  
  console.log('\n💡 Quick fixes to try:');
  console.log('1. Hard refresh browser (Ctrl+F5)');
  console.log('2. Clear browser cache');
  console.log('3. Check browser console for errors');
  console.log('4. Try incognito/private mode');
}

// Import fetch for Node.js
import fetch from 'node-fetch';

async function main() {
  await testFrontendAPICalls();
  await testLoadingIssue();
  
  console.log('\n🎯 NEXT STEPS:');
  console.log('==============');
  console.log('1. Check browser console for JavaScript errors');
  console.log('2. Verify authentication state in browser');
  console.log('3. Check network tab for failed API requests');
}

main().catch(console.error);