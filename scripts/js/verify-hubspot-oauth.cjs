/**
 * HubSpot OAuth Verification Script
 * Checks if HubSpot OAuth is properly configured
 */

require('dotenv').config({ path: '.env.local' });

async function verifyHubSpotOAuth() {
  console.log('🔍 Verifying HubSpot OAuth Configuration\n');

  const issues = [];
  const warnings = [];
  const nextSteps = [];

  // ================================================================
  // STEP 1: Check Environment Variables
  // ================================================================
  console.log('1. Checking Environment Variables...');

  const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
  const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
  const HUBSPOT_REDIRECT_URI = process.env.HUBSPOT_REDIRECT_URI;

  if (!HUBSPOT_CLIENT_ID) {
    console.log('   ❌ HUBSPOT_CLIENT_ID: NOT SET');
    issues.push('HUBSPOT_CLIENT_ID missing in .env.local');
  } else {
    console.log(`   ✅ HUBSPOT_CLIENT_ID: ${HUBSPOT_CLIENT_ID.substring(0, 8)}...`);
  }

  if (!HUBSPOT_CLIENT_SECRET) {
    console.log('   ❌ HUBSPOT_CLIENT_SECRET: NOT SET');
    issues.push('HUBSPOT_CLIENT_SECRET missing in .env.local');
  } else {
    console.log(`   ✅ HUBSPOT_CLIENT_SECRET: ${HUBSPOT_CLIENT_SECRET.substring(0, 8)}...`);
  }

  if (!HUBSPOT_REDIRECT_URI) {
    console.log('   ❌ HUBSPOT_REDIRECT_URI: NOT SET');
    issues.push('HUBSPOT_REDIRECT_URI missing in .env.local');
  } else {
    console.log(`   ✅ HUBSPOT_REDIRECT_URI: ${HUBSPOT_REDIRECT_URI}`);

    // Validate redirect URI format
    if (!HUBSPOT_REDIRECT_URI.includes('/api/crm/oauth/callback')) {
      warnings.push('HUBSPOT_REDIRECT_URI should end with /api/crm/oauth/callback');
    }
  }

  // ================================================================
  // STEP 2: Check OAuth API Routes
  // ================================================================
  console.log('\n2. Checking OAuth API Routes...');

  const fs = require('fs');
  const path = require('path');

  const initiateRoute = path.join(process.cwd(), 'app/api/crm/oauth/initiate/route.ts');
  const callbackRoute = path.join(process.cwd(), 'app/api/crm/oauth/callback/route.ts');

  if (fs.existsSync(initiateRoute)) {
    console.log('   ✅ /api/crm/oauth/initiate - EXISTS');
  } else {
    console.log('   ❌ /api/crm/oauth/initiate - MISSING');
    issues.push('OAuth initiate route missing');
  }

  if (fs.existsSync(callbackRoute)) {
    console.log('   ✅ /api/crm/oauth/callback - EXISTS');
  } else {
    console.log('   ❌ /api/crm/oauth/callback - MISSING');
    issues.push('OAuth callback route missing');
  }

  // ================================================================
  // STEP 3: Check HubSpot Adapter
  // ================================================================
  console.log('\n3. Checking HubSpot Adapter...');

  const adapterPath = path.join(process.cwd(), 'mcp-crm-server/src/adapters/hubspot.ts');

  if (fs.existsSync(adapterPath)) {
    console.log('   ✅ HubSpot adapter - EXISTS');

    // Check if adapter has required methods
    const adapterContent = fs.readFileSync(adapterPath, 'utf8');

    const requiredMethods = [
      'getContacts',
      'createContact',
      'updateContact',
      'getCompanies',
      'createCompany'
    ];

    let allMethodsExist = true;
    requiredMethods.forEach(method => {
      if (adapterContent.includes(method)) {
        console.log(`   ✅ Method ${method}() - EXISTS`);
      } else {
        console.log(`   ⚠️  Method ${method}() - MISSING`);
        warnings.push(`HubSpot adapter missing ${method}() method`);
        allMethodsExist = false;
      }
    });

  } else {
    console.log('   ❌ HubSpot adapter - MISSING');
    issues.push('HubSpot adapter file missing');
  }

  // ================================================================
  // STEP 4: Check Database Tables
  // ================================================================
  console.log('\n4. Checking CRM Integration Tables...');

  const { createClient } = require('@supabase/supabase-js');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const tables = ['crm_connections', 'crm_sync_logs'];

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);

    if (error) {
      console.log(`   ❌ ${table}: NOT DEPLOYED`);
      issues.push(`Table ${table} not deployed`);
    } else {
      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      console.log(`   ✅ ${table}: EXISTS (${count} records)`);
    }
  }

  // ================================================================
  // STEP 5: Test OAuth URL Generation
  // ================================================================
  console.log('\n5. Testing OAuth URL Generation...');

  if (HUBSPOT_CLIENT_ID && HUBSPOT_REDIRECT_URI) {
    const testState = 'test-state-12345';
    const authUrl = `https://app.hubspot.com/oauth/authorize` +
      `?client_id=${encodeURIComponent(HUBSPOT_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(HUBSPOT_REDIRECT_URI)}` +
      `&scope=crm.objects.contacts.read crm.objects.contacts.write crm.objects.companies.read crm.objects.companies.write crm.objects.deals.read crm.objects.deals.write` +
      `&state=${testState}`;

    console.log('   ✅ OAuth URL generated successfully');
    console.log(`   🔗 Test URL (first 100 chars): ${authUrl.substring(0, 100)}...`);
  } else {
    console.log('   ❌ Cannot generate OAuth URL - missing credentials');
  }

  // ================================================================
  // STEP 6: Check MCP Server Build
  // ================================================================
  console.log('\n6. Checking MCP CRM Server Build...');

  const mcpBuildPath = path.join(process.cwd(), 'mcp-crm-server/build/index.js');

  if (fs.existsSync(mcpBuildPath)) {
    console.log('   ✅ MCP server built');
  } else {
    console.log('   ⚠️  MCP server not built');
    warnings.push('MCP CRM server needs to be built');
    nextSteps.push('Run: cd mcp-crm-server && npm run build');
  }

  // ================================================================
  // SUMMARY
  // ================================================================
  console.log('\n' + '='.repeat(60));
  console.log('📊 VERIFICATION SUMMARY\n');

  if (issues.length === 0 && warnings.length === 0) {
    console.log('✅ All systems operational!');
  } else {
    if (issues.length > 0) {
      console.log(`❌ CRITICAL ISSUES (${issues.length}):\n`);
      issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
    }

    if (warnings.length > 0) {
      console.log(`\n⚠️  WARNINGS (${warnings.length}):\n`);
      warnings.forEach((warning, i) => {
        console.log(`   ${i + 1}. ${warning}`);
      });
    }
  }

  // ================================================================
  // NEXT STEPS
  // ================================================================
  console.log('\n' + '='.repeat(60));
  console.log('🚀 NEXT STEPS TO COMPLETE HUBSPOT OAUTH SETUP\n');

  if (!HUBSPOT_CLIENT_ID || !HUBSPOT_CLIENT_SECRET) {
    console.log('1. CREATE HUBSPOT APP IN DEVELOPER PORTAL:');
    console.log('   • Visit: https://developers.hubspot.com/');
    console.log('   • Click "Apps" → "Create app"');
    console.log('   • App name: SAM AI CRM Integration');
    console.log('   • Configure Auth tab:');
    console.log('     - Redirect URL: https://app.meet-sam.com/api/crm/oauth/callback');
    console.log('     - Add scopes (see docs/HUBSPOT_OAUTH_SETUP.md for full list)');
    console.log('   • Copy Client ID and Client Secret');
    console.log('');
    console.log('2. ADD CREDENTIALS TO .env.local:');
    console.log('   HUBSPOT_CLIENT_ID=your_client_id_here');
    console.log('   HUBSPOT_CLIENT_SECRET=your_client_secret_here');
    console.log('   HUBSPOT_REDIRECT_URI=https://app.meet-sam.com/api/crm/oauth/callback');
    console.log('');
  }

  if (nextSteps.length > 0) {
    console.log('3. BUILD AND DEPLOY:');
    nextSteps.forEach((step, i) => {
      console.log(`   ${i + 1}. ${step}`);
    });
    console.log('');
  }

  console.log('4. DEPLOY TO NETLIFY:');
  console.log('   netlify env:set HUBSPOT_CLIENT_ID "your_client_id"');
  console.log('   netlify env:set HUBSPOT_CLIENT_SECRET "your_client_secret"');
  console.log('   netlify env:set HUBSPOT_REDIRECT_URI "https://app.meet-sam.com/api/crm/oauth/callback"');
  console.log('');

  console.log('5. TEST OAUTH FLOW:');
  console.log('   • Go to https://app.meet-sam.com');
  console.log('   • Navigate to workspace settings');
  console.log('   • Click "Connect HubSpot"');
  console.log('   • Authorize and verify connection');
  console.log('');

  console.log('📖 Full documentation: docs/HUBSPOT_OAUTH_SETUP.md');

  console.log('='.repeat(60));
}

verifyHubSpotOAuth().catch(console.error);
