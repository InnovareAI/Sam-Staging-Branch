#!/usr/bin/env node
/**
 * Test API Endpoints Script
 * Verifies all recently created API endpoints are accessible
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

async function testEndpoint(name, method, path, body = null, expectedStatuses = [200, 201, 400, 401, 403]) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${BASE_URL}${path}`, options);
    const status = response.status;
    const isExpected = expectedStatuses.includes(status);

    let responseData;
    try {
      responseData = await response.json();
    } catch {
      responseData = await response.text();
    }

    return {
      name,
      path,
      method,
      status,
      success: isExpected,
      response: responseData,
      accessible: true
    };
  } catch (error) {
    return {
      name,
      path,
      method,
      status: 0,
      success: false,
      error: error.message,
      accessible: false
    };
  }
}

async function testAllEndpoints() {
  console.log(`🧪 Testing API Endpoints at ${BASE_URL}\n`);

  const tests = [
    // CRM API Endpoints
    {
      category: 'CRM Integration',
      endpoints: [
        {
          name: 'CRM OAuth Initiate',
          method: 'POST',
          path: '/api/crm/oauth/initiate',
          body: { workspace_id: 'test-id', crm_type: 'hubspot' },
          expectedStatuses: [401, 400] // Expect auth error without valid session
        },
        {
          name: 'CRM Connections List',
          method: 'GET',
          path: '/api/crm/connections?workspace_id=test-id',
          expectedStatuses: [401, 400] // Expect auth error
        },
        {
          name: 'CRM Disconnect',
          method: 'POST',
          path: '/api/crm/disconnect',
          body: { workspace_id: 'test-id', crm_type: 'hubspot' },
          expectedStatuses: [401, 400] // Expect auth error
        }
      ]
    },

    // Auth API Endpoints
    {
      category: 'Authentication',
      endpoints: [
        {
          name: 'Password Reset Request',
          method: 'POST',
          path: '/api/auth/reset-password',
          body: { email: 'test@example.com' },
          expectedStatuses: [200, 503] // Success or service unavailable
        },
        {
          name: 'Magic Link Verify',
          method: 'POST',
          path: '/api/auth/magic-link/verify',
          body: { token: 'invalid-token' },
          expectedStatuses: [404, 400] // Expect invalid token
        },
        {
          name: 'Password Reset Confirm',
          method: 'POST',
          path: '/api/auth/reset-password-confirm',
          body: { email: 'test@example.com', password: 'newpass123' },
          expectedStatuses: [200, 400] // Success or validation error
        }
      ]
    },

    // Billing API Endpoints (will fail if tables not deployed)
    {
      category: 'Billing Management',
      endpoints: [
        {
          name: 'Track Usage',
          method: 'POST',
          path: '/api/billing/track-usage',
          body: {
            workspace_id: 'test-id',
            metric_type: 'emails_sent',
            quantity: 10
          },
          expectedStatuses: [401, 400, 500] // Auth error or DB error if tables missing
        },
        {
          name: 'Generate Invoice',
          method: 'POST',
          path: '/api/billing/generate-invoice',
          body: {
            tenant_id: 'test-id',
            amount: 9900,
            description: 'Test invoice'
          },
          expectedStatuses: [401, 400, 500] // Auth error or DB error
        }
      ]
    },

    // UI Pages
    {
      category: 'UI Pages',
      endpoints: [
        {
          name: 'Password Reset Page',
          method: 'GET',
          path: '/reset-password',
          expectedStatuses: [200, 308] // Success or redirect
        },
        {
          name: 'Signin Page',
          method: 'GET',
          path: '/api/auth/signin',
          expectedStatuses: [200] // Should load HTML
        }
      ]
    }
  ];

  const results = [];

  for (const category of tests) {
    console.log(`\n📁 ${category.category}:`);

    for (const endpoint of category.endpoints) {
      const result = await testEndpoint(
        endpoint.name,
        endpoint.method,
        endpoint.path,
        endpoint.body,
        endpoint.expectedStatuses
      );

      results.push(result);

      const icon = result.accessible ? (result.success ? '✅' : '⚠️') : '❌';
      const statusText = result.accessible
        ? `Status ${result.status}${result.success ? ' (Expected)' : ' (Unexpected)'}`
        : `Not Accessible: ${result.error}`;

      console.log(`   ${icon} ${result.name}`);
      console.log(`      ${result.method} ${result.path}`);
      console.log(`      ${statusText}`);

      if (!result.accessible) {
        console.log(`      Error: ${result.error}`);
      } else if (!result.success) {
        console.log(`      Unexpected status. Expected one of: ${endpoint.expectedStatuses.join(', ')}`);
      }
    }
  }

  // Summary
  const accessible = results.filter(r => r.accessible).length;
  const successful = results.filter(r => r.success).length;
  const total = results.length;

  console.log(`\n📊 Summary:`);
  console.log(`   Accessible: ${accessible}/${total}`);
  console.log(`   Expected Responses: ${successful}/${total}`);

  if (accessible < total) {
    console.log(`\n⚠️  Some endpoints are not accessible. Possible issues:`);
    console.log(`   - Server not running (start with: npm run dev)`);
    console.log(`   - Network connectivity issues`);
    console.log(`   - BASE_URL incorrect: ${BASE_URL}`);
  }

  const billingEndpoints = results.filter(r =>
    r.path.includes('/billing/') && r.status === 500
  );

  if (billingEndpoints.length > 0) {
    console.log(`\n⚠️  Billing endpoints returning 500 errors:`);
    console.log(`   This likely means billing tables are not deployed.`);
    console.log(`   Run: Deploy migration in Supabase dashboard`);
    console.log(`   File: supabase/migrations/20251005000002_create_3cubed_billing.sql`);
  }

  return { total, accessible, successful };
}

// Run tests
testAllEndpoints()
  .then(stats => {
    process.exit(stats.accessible === stats.total && stats.successful === stats.total ? 0 : 1);
  })
  .catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
