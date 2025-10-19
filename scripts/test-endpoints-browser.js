/**
 * BROWSER CONSOLE TEST - Run this in browser DevTools
 * Tests all search endpoints with authentication
 *
 * INSTRUCTIONS:
 * 1. Open your app (localhost:3000 or production)
 * 2. Make sure you're logged in
 * 3. Press F12 to open DevTools
 * 4. Go to Console tab
 * 5. Paste this entire file and press Enter
 */

async function testAllEndpoints() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           TESTING ALL SEARCH ENDPOINTS                       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  const results = {
    mcp: null,
    brightdata: null,
    searchRouter: null,
    unipileSearch: null
  };

  // Test 1: MCP Status
  console.log('━'.repeat(70));
  console.log('TEST 1: MCP Status & Available Tools');
  console.log('━'.repeat(70));
  console.log('');

  try {
    const mcpResponse = await fetch('/api/mcp');
    const mcpData = await mcpResponse.json();

    console.log('MCP Response:', mcpData);
    console.log('');

    if (mcpData.success && mcpData.tools) {
      const brightdataTools = mcpData.tools.filter(t => t.name?.includes('brightdata'));

      if (brightdataTools.length > 0) {
        console.log('✅ BrightData MCP Tools Found:');
        brightdataTools.forEach(t => console.log(`   - ${t.name}`));
        results.mcp = 'CONNECTED';
      } else {
        console.log('⚠️  BrightData MCP Tools NOT found');
        console.log('   Available tools:', mcpData.tools.map(t => t.name).join(', '));
        results.mcp = 'NO_BRIGHTDATA';
      }
    } else {
      console.log('❌ MCP endpoint failed');
      results.mcp = 'FAILED';
    }
  } catch (error) {
    console.error('❌ MCP test failed:', error.message);
    results.mcp = 'ERROR';
  }

  console.log('');
  console.log('');

  // Test 2: BrightData Health
  console.log('━'.repeat(70));
  console.log('TEST 2: BrightData Scraper Health Check');
  console.log('━'.repeat(70));
  console.log('');

  try {
    const brightdataResponse = await fetch('/api/leads/brightdata-scraper');
    const brightdataData = await brightdataResponse.json();

    console.log('BrightData Health Response:', brightdataData);
    console.log('');

    if (brightdataData.service && brightdataData.status) {
      console.log('✅ BrightData endpoint is responding');
      console.log('   Service:', brightdataData.service);
      console.log('   Status:', brightdataData.status);
      console.log('   MCP Tools Available:', brightdataData.mcp_tools_available);
      results.brightdata = 'RESPONDING';
    } else {
      console.log('⚠️  Unexpected response format');
      results.brightdata = 'UNKNOWN';
    }
  } catch (error) {
    console.error('❌ BrightData health check failed:', error.message);
    results.brightdata = 'ERROR';
  }

  console.log('');
  console.log('');

  // Test 3: Search Router
  console.log('━'.repeat(70));
  console.log('TEST 3: Search Router (Cost-Optimized Routing)');
  console.log('━'.repeat(70));
  console.log('');

  try {
    const routerResponse = await fetch('/api/linkedin/search-router', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        search_criteria: {
          title: 'CEO',
          keywords: 'startup technology',
          location: 'Seattle',
          connectionDegree: '2nd'
        },
        target_count: 5,
        needs_emails: false
      })
    });

    const routerData = await routerResponse.json();

    console.log('Search Router Response:', routerData);
    console.log('');

    if (routerData.success) {
      console.log('✅ Search Router SUCCESS!');
      console.log('   Provider:', routerData.routing_info?.search_provider);
      console.log('   Account Type:', routerData.routing_info?.account_type);
      console.log('   Prospects Found:', routerData.prospects?.length || 0);
      console.log('   Cost Breakdown:', routerData.cost_breakdown);
      console.log('');

      if (routerData.prospects && routerData.prospects.length > 0) {
        console.log('   Sample Prospects:');
        routerData.prospects.slice(0, 3).forEach((p, i) => {
          console.log(`   ${i + 1}. ${p.fullName || p.name}`);
          console.log(`      Title: ${p.title}`);
          console.log(`      Company: ${p.company}`);
        });
      }

      results.searchRouter = 'SUCCESS';
    } else {
      console.log('❌ Search failed:', routerData.error);
      results.searchRouter = 'FAILED';
    }
  } catch (error) {
    console.error('❌ Search router test failed:', error.message);
    results.searchRouter = 'ERROR';
  }

  console.log('');
  console.log('');

  // Test 4: Direct Unipile Search
  console.log('━'.repeat(70));
  console.log('TEST 4: Direct Unipile Search (Your FREE searches)');
  console.log('━'.repeat(70));
  console.log('');

  try {
    const unipileResponse = await fetch('/api/linkedin/search/simple', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        search_criteria: {
          title: 'CEO',
          keywords: 'startup',
          location: 'Seattle',
          connectionDegree: '2nd'
        },
        target_count: 5
      })
    });

    const unipileData = await unipileResponse.json();

    console.log('Unipile Search Response:', unipileData);
    console.log('');

    if (unipileData.success) {
      console.log('✅ Unipile Search SUCCESS!');
      console.log('   API Used:', unipileData.api || 'unknown');
      console.log('   Prospects Found:', unipileData.count || 0);
      console.log('   Session ID:', unipileData.session_id?.substring(0, 16) + '...');
      console.log('');

      if (unipileData.prospects && unipileData.prospects.length > 0) {
        console.log('   REAL LinkedIn Prospects:');
        unipileData.prospects.slice(0, 3).forEach((p, i) => {
          console.log(`   ${i + 1}. ${p.fullName || p.name}`);
          console.log(`      Title: ${p.title}`);
          console.log(`      Company: ${p.company}`);
          console.log(`      LinkedIn: ${p.linkedinUrl}`);
        });
      }

      results.unipileSearch = 'SUCCESS';
    } else {
      console.log('❌ Unipile search failed:', unipileData.error);
      results.unipileSearch = 'FAILED';
    }
  } catch (error) {
    console.error('❌ Unipile search test failed:', error.message);
    results.unipileSearch = 'ERROR';
  }

  // Final Summary
  console.log('');
  console.log('');
  console.log('━'.repeat(70));
  console.log('FINAL SUMMARY');
  console.log('━'.repeat(70));
  console.log('');

  const statusIcon = (status) => {
    if (status === 'SUCCESS' || status === 'CONNECTED' || status === 'RESPONDING') return '✅';
    if (status === 'NO_BRIGHTDATA') return '⚠️';
    return '❌';
  };

  console.log(`${statusIcon(results.mcp)} MCP Status: ${results.mcp}`);
  console.log(`${statusIcon(results.brightdata)} BrightData Health: ${results.brightdata}`);
  console.log(`${statusIcon(results.searchRouter)} Search Router: ${results.searchRouter}`);
  console.log(`${statusIcon(results.unipileSearch)} Unipile Search: ${results.unipileSearch}`);
  console.log('');

  // Recommendations
  console.log('RECOMMENDATIONS:');
  console.log('');

  if (results.unipileSearch === 'SUCCESS') {
    console.log('✅ Your LinkedIn searches are WORKING!');
    console.log('   - You can search for prospects right now');
    console.log('   - All searches are FREE (Sales Navigator via Unipile)');
    console.log('   - Results appear in Data Approval tab');
  } else {
    console.log('⚠️  LinkedIn searches not working - check:');
    console.log('   - Are you logged in?');
    console.log('   - Is your LinkedIn account connected in Settings?');
    console.log('   - Check browser console for error details');
  }

  console.log('');

  if (results.mcp === 'NO_BRIGHTDATA') {
    console.log('⚠️  BrightData MCP not connected (optional):');
    console.log('   - Email enrichment will not work');
    console.log('   - This is OPTIONAL - Unipile searches work without it');
    console.log('   - To connect: Start Claude Desktop with .mcp.json config');
  }

  console.log('');
  console.log('━'.repeat(70));

  return results;
}

// Run the tests
console.log('Starting endpoint tests...\n');
testAllEndpoints().then(results => {
  console.log('\n✅ All tests complete!');
  console.log('Results object:', results);
}).catch(error => {
  console.error('\n❌ Test suite failed:', error);
});
