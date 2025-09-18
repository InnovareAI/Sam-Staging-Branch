#!/usr/bin/env node

/**
 * Test SAM AI Memory Archival System
 * 
 * This script tests the memory archival API endpoints
 */

import https from 'https';
import http from 'http';

const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';
const API_KEY = process.env.MEMORY_ARCHIVAL_API_KEY || 'test-api-key';

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function testMemoryArchival() {
  console.log('🧪 Testing SAM AI Memory Archival System...\n');
  
  try {
    // Test 1: Check auto-archive endpoint info (GET)
    console.log('1️⃣ Testing auto-archive info endpoint...');
    const infoResponse = await makeRequest(`${SITE_URL}/api/sam/memory/auto-archive`);
    console.log(`   Status: ${infoResponse.status}`);
    console.log(`   Response:`, infoResponse.data);
    console.log('');
    
    // Test 2: Test auto-archive with API key (POST)
    console.log('2️⃣ Testing auto-archive with API key...');
    const archiveResponse = await makeRequest(`${SITE_URL}/api/sam/memory/auto-archive`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    console.log(`   Status: ${archiveResponse.status}`);
    console.log(`   Response:`, archiveResponse.data);
    console.log('');
    
    // Test 3: Test without API key (should fail)
    console.log('3️⃣ Testing auto-archive without API key (should fail)...');
    const noAuthResponse = await makeRequest(`${SITE_URL}/api/sam/memory/auto-archive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log(`   Status: ${noAuthResponse.status}`);
    console.log(`   Response:`, noAuthResponse.data);
    console.log('');
    
    // Test 4: Test memory snapshots endpoint
    console.log('4️⃣ Testing memory snapshots endpoint...');
    const snapshotsResponse = await makeRequest(`${SITE_URL}/api/sam/memory?action=snapshots`);
    console.log(`   Status: ${snapshotsResponse.status}`);
    if (snapshotsResponse.status === 401) {
      console.log(`   Response: Unauthorized (expected - requires user session)`);
    } else {
      console.log(`   Response:`, snapshotsResponse.data);
    }
    console.log('');
    
    console.log('✅ Memory archival system test completed!');
    console.log('');
    console.log('Next steps:');
    console.log('- Set MEMORY_ARCHIVAL_API_KEY environment variable');
    console.log('- Run ./scripts/setup-memory-archival-cron.sh to set up daily archival');
    console.log('- Test with real user session to access memory snapshots');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testMemoryArchival();