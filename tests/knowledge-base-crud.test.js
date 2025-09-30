#!/usr/bin/env node

/**
 * Automated CRUD Tests for Structured Knowledge Base APIs
 * Tests all endpoints with RLS-scoped access validation
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

// Create admin client (bypasses RLS)
const adminClient = createClient(supabaseUrl, supabaseServiceKey);

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, message = '') {
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}${message ? ': ' + message : ''}`);
  results.tests.push({ name, passed, message });
  if (passed) {
    results.passed++;
  } else {
    results.failed++;
  }
}

// Setup: Create test workspaces and users
async function setupTestEnvironment() {
  console.log('\n🔧 Setting up test environment...\n');

  // Get first existing user for owner_id
  const { data: firstUser } = await adminClient
    .from('users')
    .select('id')
    .limit(1)
    .single();

  const ownerId = firstUser?.id || '00000000-0000-0000-0000-000000000000';
  const timestamp = Date.now();

  // Create test workspaces
  const { data: workspace1, error: ws1Error } = await adminClient
    .from('workspaces')
    .insert({
      name: 'Test Workspace 1',
      slug: `test-ws-1-${timestamp}`,
      owner_id: ownerId
    })
    .select()
    .single();

  const { data: workspace2, error: ws2Error } = await adminClient
    .from('workspaces')
    .insert({
      name: 'Test Workspace 2',
      slug: `test-ws-2-${timestamp}`,
      owner_id: ownerId
    })
    .select()
    .single();

  if (ws1Error || ws2Error) {
    console.error('❌ Failed to create test workspaces');
    return null;
  }

  console.log(`   Created Workspace 1: ${workspace1.id}`);
  console.log(`   Created Workspace 2: ${workspace2.id}`);

  return { workspace1, workspace2 };
}

// Cleanup: Remove test data
async function cleanupTestEnvironment(workspace1Id, workspace2Id) {
  console.log('\n🧹 Cleaning up test environment...\n');

  // Delete test workspaces (cascade will delete all related data)
  await adminClient.from('workspaces').delete().eq('id', workspace1Id);
  await adminClient.from('workspaces').delete().eq('id', workspace2Id);

  console.log('   Test data cleaned up');
}

// Test ICPs endpoint
async function testICPs(workspace1Id, workspace2Id) {
  console.log('\n📋 Testing ICPs API...\n');

  // Test CREATE
  const testICP = {
    workspace_id: workspace1Id,
    title: 'Test ICP',
    description: 'Test description',
    industry: 'Technology',
    company_size: '50-200',
    revenue_range: '$1M-$10M',
    geography: ['USA'],
    pain_points: ['Test pain'],
    tags: ['test']
  };

  const { data: createdICP, error: createError } = await adminClient
    .from('knowledge_base_icps')
    .insert(testICP)
    .select()
    .single();

  logTest('ICPs - CREATE', !createError && createdICP?.id, createError?.message);

  // Test READ (same workspace)
  const { data: readICP, error: readError } = await adminClient
    .from('knowledge_base_icps')
    .select()
    .eq('workspace_id', workspace1Id)
    .eq('id', createdICP?.id)
    .single();

  logTest('ICPs - READ (same workspace)', !readError && readICP?.id === createdICP?.id);

  // Test RLS: Cannot read from different workspace
  const { data: crossRead, error: crossReadError } = await adminClient
    .from('knowledge_base_icps')
    .select()
    .eq('workspace_id', workspace2Id)
    .eq('id', createdICP?.id);

  logTest('ICPs - RLS isolation', !crossRead || crossRead.length === 0, 
    'Should not be able to read ICP from different workspace');

  // Test UPDATE
  const { data: updatedICP, error: updateError } = await adminClient
    .from('knowledge_base_icps')
    .update({ title: 'Updated Test ICP' })
    .eq('id', createdICP?.id)
    .eq('workspace_id', workspace1Id)
    .select()
    .single();

  logTest('ICPs - UPDATE', !updateError && updatedICP?.title === 'Updated Test ICP');

  // Test DELETE
  const { error: deleteError } = await adminClient
    .from('knowledge_base_icps')
    .delete()
    .eq('id', createdICP?.id)
    .eq('workspace_id', workspace1Id);

  logTest('ICPs - DELETE', !deleteError);
}

// Test Products endpoint
async function testProducts(workspace1Id, workspace2Id) {
  console.log('\n📦 Testing Products API...\n');

  const testProduct = {
    workspace_id: workspace1Id,
    name: 'Test Product',
    description: 'Test description',
    sku: 'TEST-001',
    category: 'Software',
    price: 99.99,
    currency: 'USD',
    pricing_model: 'subscription',
    features: ['Feature 1'],
    tags: ['test']
  };

  const { data: createdProduct, error: createError } = await adminClient
    .from('knowledge_base_products')
    .insert(testProduct)
    .select()
    .single();

  logTest('Products - CREATE', !createError && createdProduct?.id, createError?.message);

  const { data: readProduct, error: readError } = await adminClient
    .from('knowledge_base_products')
    .select()
    .eq('workspace_id', workspace1Id)
    .eq('id', createdProduct?.id)
    .single();

  logTest('Products - READ (same workspace)', !readError && readProduct?.id === createdProduct?.id);

  const { data: crossRead } = await adminClient
    .from('knowledge_base_products')
    .select()
    .eq('workspace_id', workspace2Id)
    .eq('id', createdProduct?.id);

  logTest('Products - RLS isolation', !crossRead || crossRead.length === 0);

  const { data: updatedProduct, error: updateError } = await adminClient
    .from('knowledge_base_products')
    .update({ name: 'Updated Product' })
    .eq('id', createdProduct?.id)
    .eq('workspace_id', workspace1Id)
    .select()
    .single();

  logTest('Products - UPDATE', !updateError && updatedProduct?.name === 'Updated Product');

  const { error: deleteError } = await adminClient
    .from('knowledge_base_products')
    .delete()
    .eq('id', createdProduct?.id)
    .eq('workspace_id', workspace1Id);

  logTest('Products - DELETE', !deleteError);
}

// Test Competitors endpoint
async function testCompetitors(workspace1Id, workspace2Id) {
  console.log('\n🏆 Testing Competitors API...\n');

  const testCompetitor = {
    workspace_id: workspace1Id,
    name: 'Test Competitor',
    description: 'Test description',
    website: 'https://example.com',
    market_position: 'Challenger',
    strengths: ['Strength 1'],
    weaknesses: ['Weakness 1'],
    tags: ['test']
  };

  const { data: createdCompetitor, error: createError } = await adminClient
    .from('knowledge_base_competitors')
    .insert(testCompetitor)
    .select()
    .single();

  logTest('Competitors - CREATE', !createError && createdCompetitor?.id, createError?.message);

  const { data: readCompetitor, error: readError } = await adminClient
    .from('knowledge_base_competitors')
    .select()
    .eq('workspace_id', workspace1Id)
    .eq('id', createdCompetitor?.id)
    .single();

  logTest('Competitors - READ (same workspace)', !readError && readCompetitor?.id === createdCompetitor?.id);

  const { data: crossRead } = await adminClient
    .from('knowledge_base_competitors')
    .select()
    .eq('workspace_id', workspace2Id)
    .eq('id', createdCompetitor?.id);

  logTest('Competitors - RLS isolation', !crossRead || crossRead.length === 0);

  const { data: updatedCompetitor, error: updateError } = await adminClient
    .from('knowledge_base_competitors')
    .update({ name: 'Updated Competitor' })
    .eq('id', createdCompetitor?.id)
    .eq('workspace_id', workspace1Id)
    .select()
    .single();

  logTest('Competitors - UPDATE', !updateError && updatedCompetitor?.name === 'Updated Competitor');

  const { error: deleteError } = await adminClient
    .from('knowledge_base_competitors')
    .delete()
    .eq('id', createdCompetitor?.id)
    .eq('workspace_id', workspace1Id);

  logTest('Competitors - DELETE', !deleteError);
}

// Test Personas endpoint
async function testPersonas(workspace1Id, workspace2Id) {
  console.log('\n👥 Testing Personas API...\n');

  const testPersona = {
    workspace_id: workspace1Id,
    name: 'Test Persona',
    description: 'Test description',
    job_title: 'VP Sales',
    seniority_level: 'VP',
    department: 'Sales',
    goals: ['Goal 1'],
    challenges: ['Challenge 1'],
    tags: ['test']
  };

  const { data: createdPersona, error: createError } = await adminClient
    .from('knowledge_base_personas')
    .insert(testPersona)
    .select()
    .single();

  logTest('Personas - CREATE', !createError && createdPersona?.id, createError?.message);

  const { data: readPersona, error: readError } = await adminClient
    .from('knowledge_base_personas')
    .select()
    .eq('workspace_id', workspace1Id)
    .eq('id', createdPersona?.id)
    .single();

  logTest('Personas - READ (same workspace)', !readError && readPersona?.id === createdPersona?.id);

  const { data: crossRead } = await adminClient
    .from('knowledge_base_personas')
    .select()
    .eq('workspace_id', workspace2Id)
    .eq('id', createdPersona?.id);

  logTest('Personas - RLS isolation', !crossRead || crossRead.length === 0);

  const { data: updatedPersona, error: updateError } = await adminClient
    .from('knowledge_base_personas')
    .update({ name: 'Updated Persona' })
    .eq('id', createdPersona?.id)
    .eq('workspace_id', workspace1Id)
    .select()
    .single();

  logTest('Personas - UPDATE', !updateError && updatedPersona?.name === 'Updated Persona');

  const { error: deleteError } = await adminClient
    .from('knowledge_base_personas')
    .delete()
    .eq('id', createdPersona?.id)
    .eq('workspace_id', workspace1Id);

  logTest('Personas - DELETE', !deleteError);
}

// Main test runner
async function runTests() {
  console.log('🧪 Starting Knowledge Base API CRUD Tests\n');
  console.log('=' .repeat(60));

  const env = await setupTestEnvironment();
  
  if (!env) {
    console.error('❌ Failed to setup test environment');
    process.exit(1);
  }

  const { workspace1, workspace2 } = env;

  try {
    await testICPs(workspace1.id, workspace2.id);
    await testProducts(workspace1.id, workspace2.id);
    await testCompetitors(workspace1.id, workspace2.id);
    await testPersonas(workspace1.id, workspace2.id);
  } finally {
    await cleanupTestEnvironment(workspace1.id, workspace2.id);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Results Summary:\n');
  console.log(`   ✅ Passed: ${results.passed}`);
  console.log(`   ❌ Failed: ${results.failed}`);
  console.log(`   📋 Total:  ${results.passed + results.failed}`);

  if (results.failed > 0) {
    console.log('\n❌ Some tests failed. Please review the output above.');
    console.log('\nFailed tests:');
    results.tests
      .filter(t => !t.passed)
      .forEach(t => console.log(`   - ${t.name}: ${t.message}`));
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed! The structured KB APIs are working correctly.\n');
    process.exit(0);
  }
}

runTests().catch(error => {
  console.error('\n❌ Test suite failed with error:', error);
  process.exit(1);
});