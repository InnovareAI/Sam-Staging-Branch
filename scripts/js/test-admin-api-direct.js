#!/usr/bin/env node

import fetch from 'node-fetch';

console.log('🧪 TESTING ADMIN API ENDPOINT DIRECTLY');
console.log('=====================================\n');

async function testAdminAPI() {
  try {
    console.log('📡 Testing GET /api/admin/workspaces...');
    
    const response = await fetch('http://localhost:3000/api/admin/workspaces', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📊 Response status: ${response.status}`);
    console.log(`📊 Response headers:`, Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log(`📊 Response body (first 500 chars):`);
    console.log(responseText.substring(0, 500));
    
    if (response.headers.get('content-type')?.includes('application/json')) {
      try {
        const data = JSON.parse(responseText);
        console.log('\n✅ JSON Response:');
        console.log(JSON.stringify(data, null, 2));
        return data;
      } catch (parseError) {
        console.log('❌ Failed to parse JSON:', parseError.message);
      }
    } else {
      console.log('❌ Response is not JSON - likely HTML error page');
    }
    
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
  
  return null;
}

async function main() {
  const result = await testAdminAPI();
  
  if (result) {
    console.log('\n🎯 DIAGNOSIS: Admin API works and returns data');
    console.log('Issue is likely in frontend authentication or caching');
  } else {
    console.log('\n🎯 DIAGNOSIS: Admin API endpoint has issues');
    console.log('Need to fix the API endpoint first');
  }
}

main().catch(console.error);