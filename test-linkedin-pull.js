#!/usr/bin/env node

/**
 * Test LinkedIn pull-connections API
 * Tests if we can fetch LinkedIn connections via Unipile
 */

async function testPullConnections() {
  try {
    console.log('Testing /api/linkedin/pull-connections...\n');

    const response = await fetch('http://localhost:3000/api/linkedin/pull-connections', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ count: 10 })
    });

    const result = await response.json();

    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(result, null, 2));

    if (result.success) {
      console.log(`\n✅ SUCCESS: Found ${result.count} connections`);
      if (result.connections && result.connections.length > 0) {
        console.log('\nFirst 3 connections:');
        result.connections.slice(0, 3).forEach((conn, i) => {
          console.log(`${i + 1}. ${conn.name} - ${conn.title} at ${conn.company}`);
        });
      }
    } else {
      console.log(`\n❌ FAILED: ${result.error}`);
      if (result.help) console.log(`   ${result.help}`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testPullConnections();
