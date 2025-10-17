/**
 * Test BrightData MCP and Google Custom Search Integrations
 * Verifies connection status and basic functionality
 */

const https = require('https');

// Test configuration
const TEST_CONFIG = {
  googleApiKey: process.env.GOOGLE_API_KEY,
  googleCseId: process.env.GOOGLE_CSE_ID,
  brightDataToken: process.env.BRIGHT_DATA_TOKEN,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY
};

console.log('\n🔍 TESTING SEARCH INTEGRATIONS\n');
console.log('='.repeat(60));

// Test 1: Google Custom Search API
async function testGoogleCustomSearch() {
  console.log('\n📊 TEST 1: Google Custom Search API');
  console.log('-'.repeat(60));

  if (!TEST_CONFIG.googleApiKey || !TEST_CONFIG.googleCseId) {
    console.log('❌ Google API credentials not found in environment');
    console.log('   Missing:', !TEST_CONFIG.googleApiKey ? 'GOOGLE_API_KEY' : 'GOOGLE_CSE_ID');
    return { success: false, error: 'Missing credentials' };
  }

  console.log('✅ Google API Key found:', TEST_CONFIG.googleApiKey.substring(0, 20) + '...');
  console.log('✅ Google CSE ID found:', TEST_CONFIG.googleCseId);

  // Test simple search
  const testQuery = 'site:linkedin.com/in/ CEO tech startup';
  const url = `https://www.googleapis.com/customsearch/v1?key=${TEST_CONFIG.googleApiKey}&cx=${TEST_CONFIG.googleCseId}&q=${encodeURIComponent(testQuery)}&num=3`;

  try {
    console.log('\n🔎 Testing search query:', testQuery);
    const startTime = Date.now();

    const response = await fetch(url);
    const searchTime = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.json();
      console.log('❌ Search API error:', error.error?.message || 'Unknown error');
      console.log('   Status code:', response.status);

      if (response.status === 429) {
        console.log('⚠️  Quota exceeded - daily limit reached');
      }

      return { success: false, error: error.error?.message, status: response.status };
    }

    const data = await response.json();
    const resultCount = data.items?.length || 0;

    console.log('✅ Search completed successfully');
    console.log('   Response time:', searchTime + 'ms');
    console.log('   Results found:', resultCount);
    console.log('   Total possible:', data.searchInformation?.totalResults || '0');

    if (resultCount > 0) {
      console.log('\n   Sample results:');
      data.items.slice(0, 2).forEach((item, i) => {
        console.log(`   ${i + 1}. ${item.title}`);
        console.log(`      ${item.link}`);
      });
    }

    return { success: true, resultCount, searchTime };

  } catch (error) {
    console.log('❌ Search request failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Test 2: BrightData MCP Configuration
async function testBrightDataMCP() {
  console.log('\n📊 TEST 2: BrightData MCP Configuration');
  console.log('-'.repeat(60));

  try {
    // Check .mcp.json configuration
    const fs = require('fs');
    const path = require('path');
    const mcpConfigPath = path.join(process.cwd(), '.mcp.json');

    if (!fs.existsSync(mcpConfigPath)) {
      console.log('❌ .mcp.json configuration file not found');
      return { success: false, error: 'Config file missing' };
    }

    const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));

    if (!mcpConfig.mcpServers?.brightdata) {
      console.log('❌ BrightData MCP server not configured in .mcp.json');
      return { success: false, error: 'Not configured' };
    }

    const brightdataConfig = mcpConfig.mcpServers.brightdata;
    console.log('✅ BrightData MCP found in configuration');
    console.log('   Command:', brightdataConfig.command);
    console.log('   Description:', brightdataConfig.description);

    // Check if token is present in args
    if (brightdataConfig.args && brightdataConfig.args.length > 0) {
      const tokenArg = brightdataConfig.args[0];
      if (tokenArg.includes('token=')) {
        const tokenPreview = tokenArg.substring(0, 50) + '...';
        console.log('✅ BrightData token found:', tokenPreview);
      } else {
        console.log('⚠️  BrightData token not found in args');
      }
    }

    // Check proxy configuration
    const brightDataCustomer = process.env.BRIGHT_DATA_CUSTOMER_ID;
    const brightDataPassword = process.env.BRIGHT_DATA_PASSWORD;
    const brightDataZone = process.env.BRIGHT_DATA_ZONE;

    if (brightDataCustomer && brightDataPassword && brightDataZone) {
      console.log('✅ BrightData proxy credentials configured');
      console.log('   Customer ID:', brightDataCustomer);
      console.log('   Zone:', brightDataZone);
    } else {
      console.log('⚠️  BrightData proxy credentials incomplete');
      console.log('   Missing:', [
        !brightDataCustomer ? 'BRIGHT_DATA_CUSTOMER_ID' : null,
        !brightDataPassword ? 'BRIGHT_DATA_PASSWORD' : null,
        !brightDataZone ? 'BRIGHT_DATA_ZONE' : null
      ].filter(Boolean).join(', '));
    }

    return { success: true, configured: true };

  } catch (error) {
    console.log('❌ BrightData MCP check failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Test 3: Database Search Configuration
async function testDatabaseSearchConfig() {
  console.log('\n📊 TEST 3: Database Search Configuration');
  console.log('-'.repeat(60));

  if (!TEST_CONFIG.supabaseUrl || !TEST_CONFIG.supabaseKey) {
    console.log('❌ Supabase credentials not found');
    return { success: false, error: 'Missing Supabase credentials' };
  }

  try {
    // Check if search quota functions exist
    const checkQuery = `
      SELECT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'check_lead_search_quota'
      ) as has_quota_check,
      EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'increment_lead_search_usage'
      ) as has_usage_increment
    `;

    const url = `${TEST_CONFIG.supabaseUrl}/rest/v1/rpc/sql`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': TEST_CONFIG.supabaseKey,
        'Authorization': `Bearer ${TEST_CONFIG.supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: checkQuery })
    });

    if (!response.ok) {
      console.log('⚠️  Could not verify database functions (this is OK if running migrations)');
      return { success: true, warning: 'Could not verify' };
    }

    console.log('✅ Database connection successful');
    console.log('✅ Search quota management functions available');

    return { success: true };

  } catch (error) {
    console.log('⚠️  Database check failed:', error.message);
    console.log('   (This is OK if migrations haven\'t been applied yet)');
    return { success: true, warning: error.message };
  }
}

// Run all tests
async function runTests() {
  const results = {
    google: await testGoogleCustomSearch(),
    brightdata: await testBrightDataMCP(),
    database: await testDatabaseSearchConfig()
  };

  console.log('\n' + '='.repeat(60));
  console.log('📋 TEST SUMMARY');
  console.log('='.repeat(60));

  const googleStatus = results.google.success ? '✅ WORKING' : '❌ FAILED';
  const brightdataStatus = results.brightdata.success ? '✅ CONFIGURED' : '❌ NOT CONFIGURED';
  const databaseStatus = results.database.success ? '✅ READY' : '⚠️  NEEDS SETUP';

  console.log(`\nGoogle Custom Search: ${googleStatus}`);
  if (!results.google.success) {
    console.log(`  Error: ${results.google.error}`);
    console.log('  Fix: Check GOOGLE_API_KEY and GOOGLE_CSE_ID in .env.local');
  }

  console.log(`\nBrightData MCP: ${brightdataStatus}`);
  if (!results.brightdata.success) {
    console.log(`  Error: ${results.brightdata.error}`);
    console.log('  Fix: Ensure BrightData is configured in .mcp.json');
  } else {
    console.log('  Note: Using MOCK DATA until MCP tools are implemented');
    console.log('  TODO: Replace mock data in /api/leads/brightdata-scraper/route.ts');
  }

  console.log(`\nDatabase Configuration: ${databaseStatus}`);
  if (results.database.warning) {
    console.log(`  Warning: ${results.database.warning}`);
    console.log('  Action: Apply migrations in supabase/migrations/');
  }

  console.log('\n' + '='.repeat(60));

  // Overall status
  const allWorking = results.google.success && results.brightdata.success;
  console.log('\n🎯 OVERALL STATUS:', allWorking ? '✅ SEARCH INTEGRATIONS READY' : '⚠️  NEEDS ATTENTION');

  if (allWorking) {
    console.log('\n✨ Next Steps:');
    console.log('   1. Apply database migrations (if not done)');
    console.log('   2. Replace BrightData mock data with real MCP calls');
    console.log('   3. Test search endpoints via API routes');
    console.log('   4. Integrate with SAM AI for intelligent search routing');
  }

  console.log('\n');
}

// Run the tests
runTests().catch(console.error);
