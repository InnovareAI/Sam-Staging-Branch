#!/usr/bin/env node

/**
 * Test BrightData Search Integration
 * Tests the cost-optimized search router with BrightData
 * Results are pushed to Data Approval screen
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

async function testBrightDataSearch() {
  console.log('🧪 Testing BrightData Search Integration\n');

  try {
    // Test search parameters that will trigger BrightData
    // (e.g., if user has Classic LinkedIn or searching 1st degree with Premium)
    const searchParams = {
      search_criteria: {
        title: 'CTO',
        keywords: 'SaaS',
        location: 'San Francisco',
        connectionDegree: '2nd', // Use 2nd degree for testing
        company: 'Technology'
      },
      target_count: 10,
      needs_emails: false // Set to true to test email enrichment
    };

    console.log('📋 Search Parameters:');
    console.log(JSON.stringify(searchParams, null, 2));
    console.log('\n🔍 Calling search router...\n');

    // Call the search router
    const response = await fetch(`${SITE_URL}/api/linkedin/search-router`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: This requires authentication cookie from browser
        // Run this from the browser console or with a valid session
      },
      body: JSON.stringify(searchParams)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Search failed: ${response.status}`);
      console.error(errorText);

      if (response.status === 401) {
        console.log('\n⚠️  Authentication required!');
        console.log('This script needs to be run with authentication.');
        console.log('\nOptions:');
        console.log('1. Run this code in the browser console (logged in)');
        console.log('2. Test via the ProspectSearchChat UI in the app');
        console.log('3. Use the test function below in browser DevTools\n');
        console.log('='.repeat(60));
        console.log('Copy this code to browser console (when logged in):');
        console.log('='.repeat(60));
        console.log(`
fetch('/api/linkedin/search-router', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    search_criteria: {
      title: 'CTO',
      keywords: 'SaaS',
      location: 'San Francisco',
      connectionDegree: '2nd'
    },
    target_count: 10,
    needs_emails: false
  })
})
.then(r => r.json())
.then(data => {
  console.log('✅ Search Results:', data);
  console.log('📊 Provider:', data.routing_info?.search_provider);
  console.log('💰 Cost:', data.cost_breakdown);
  console.log('📈 Prospects:', data.prospects?.length || 0);
  return data;
});
        `);
        console.log('='.repeat(60));
      }
      return;
    }

    const data = await response.json();

    console.log('✅ Search completed!\n');
    console.log('📊 Results Summary:');
    console.log('─'.repeat(60));
    console.log(`Provider: ${data.routing_info?.search_provider || 'unknown'}`);
    console.log(`Account Type: ${data.routing_info?.account_type || 'unknown'}`);
    console.log(`Prospects Found: ${data.prospects?.length || 0}`);
    console.log(`Session ID: ${data.session_id || 'N/A'}`);
    console.log('─'.repeat(60));

    if (data.cost_breakdown) {
      console.log('\n💰 Cost Breakdown:');
      Object.entries(data.cost_breakdown).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    }

    if (data.routing_info?.cost_optimization) {
      console.log('\n🎯 Cost Optimization:');
      console.log(`  ${data.routing_info.cost_optimization}`);
    }

    if (data.prospects && data.prospects.length > 0) {
      console.log(`\n👥 Sample Prospects (first 3):`);
      data.prospects.slice(0, 3).forEach((prospect, i) => {
        console.log(`\n  ${i + 1}. ${prospect.fullName || prospect.name}`);
        console.log(`     Title: ${prospect.title || 'N/A'}`);
        console.log(`     Company: ${prospect.company || 'N/A'}`);
        console.log(`     Location: ${prospect.location || 'N/A'}`);
        console.log(`     Email: ${prospect.email || 'Not enriched'}`);
      });
    }

    console.log('\n📍 Check Data Approval:');
    console.log('   Go to: Data Approval tab in the app');
    console.log(`   Look for session: ${data.session_id?.substring(0, 8) || 'Latest'}...`);
    console.log('   You should see the prospects ready for approval!');

    console.log('\n✅ Test completed successfully!\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
  }
}

// Run the test if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('\n⚠️  Note: This script requires authentication.');
  console.log('Please run the browser console version instead.\n');
  console.log('='.repeat(60));
  console.log('BROWSER CONSOLE VERSION (copy/paste when logged in):');
  console.log('='.repeat(60));
  console.log(`
// Test BrightData Search and push to Data Approval
async function testBrightDataSearch() {
  console.log('🧪 Testing BrightData Search Integration\\n');

  const response = await fetch('/api/linkedin/search-router', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      search_criteria: {
        title: 'CTO',
        keywords: 'SaaS Technology',
        location: 'San Francisco',
        connectionDegree: '2nd', // Change to '1st' to force BrightData (Premium)
        company: 'Tech'
      },
      target_count: 10,
      needs_emails: true // Set to true to test email enrichment
    })
  });

  const data = await response.json();

  console.log('✅ Search Results:', data);
  console.log('\\n📊 Provider:', data.routing_info?.search_provider);
  console.log('💰 Cost:', data.cost_breakdown);
  console.log('📈 Prospects:', data.prospects?.length || 0);
  console.log('\\n🔗 Session ID:', data.session_id);
  console.log('\\n📍 Check Data Approval tab to see the prospects!');

  return data;
}

// Run the test
testBrightDataSearch();
  `);
  console.log('='.repeat(60));
  console.log('\nAlternatively, use the ProspectSearchChat UI in the app.');
  console.log('Just type: "Find 10 CTOs in San Francisco (2nd degree)"\n');
}

export { testBrightDataSearch };
