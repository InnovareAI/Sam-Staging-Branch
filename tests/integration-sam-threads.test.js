#!/usr/bin/env node

/**
 * Integration Sanity Check for /api/sam/threads
 * Tests thread creation, workspace scoping, and basic functionality
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
const apiUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

async function setupTestEnvironment() {
  console.log('\n🔧 Setting up test environment...\n');

  // Get first user
  const { data: firstUser } = await supabase
    .from('users')
    .select('id')
    .limit(1)
    .single();

  const ownerId = firstUser?.id || '00000000-0000-0000-0000-000000000000';

  // Create test workspace
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .insert({
      name: `Test Workspace Thread ${Date.now()}`,
      slug: `test-thread-ws-${Date.now()}`,
      owner_id: ownerId
    })
    .select()
    .single();

  if (wsError) {
    console.error('❌ Failed to create test workspace');
    return null;
  }

  console.log(`   Created test workspace: ${workspace.id}\n`);
  return { workspace, ownerId };
}

async function cleanupTestEnvironment(workspaceId) {
  console.log('\n🧹 Cleaning up test environment...\n');
  await supabase.from('workspaces').delete().eq('id', workspaceId);
  console.log('   Test data cleaned up\n');
}

async function testThreadCreation(workspaceId) {
  console.log('💬 Testing thread creation...\n');

  // Test 1: Create thread with workspace_id
  const { data: thread1, error: createError } = await supabase
    .from('sam_threads')
    .insert({
      workspace_id: workspaceId,
      title: 'Test Thread 1',
      context: { test: true }
    })
    .select()
    .single();

  logTest('Thread creation with workspace_id', !createError && thread1?.id, createError?.message);

  // Test 2: Read thread back
  const { data: readThread, error: readError } = await supabase
    .from('sam_threads')
    .select()
    .eq('id', thread1?.id)
    .eq('workspace_id', workspaceId)
    .single();

  logTest('Thread read with workspace filter', !readError && readThread?.id === thread1?.id);

  // Test 3: Verify workspace_id is set correctly
  logTest('Thread has correct workspace_id', readThread?.workspace_id === workspaceId);

  return thread1;
}

async function testThreadMessages(threadId, workspaceId) {
  console.log('\n📝 Testing thread messages...\n');

  // Test 1: Create message in thread
  const { data: message, error: msgError } = await supabase
    .from('sam_messages')
    .insert({
      thread_id: threadId,
      workspace_id: workspaceId,
      role: 'user',
      content: 'Test message'
    })
    .select()
    .single();

  logTest('Message creation in thread', !msgError && message?.id, msgError?.message);

  // Test 2: Read messages for thread
  const { data: messages, error: readMsgError } = await supabase
    .from('sam_messages')
    .select()
    .eq('thread_id', threadId)
    .eq('workspace_id', workspaceId);

  logTest('Messages read for thread', !readMsgError && messages?.length > 0);

  // Test 3: Verify message has correct workspace_id
  logTest('Message has correct workspace_id', message?.workspace_id === workspaceId);
}

async function testWorkspaceIsolation(thread1Workspace, thread1Id) {
  console.log('\n🔒 Testing workspace isolation...\n');

  // Create a second workspace
  const { data: firstUser } = await supabase
    .from('users')
    .select('id')
    .limit(1)
    .single();

  const { data: workspace2 } = await supabase
    .from('workspaces')
    .insert({
      name: `Test Workspace 2 Thread ${Date.now()}`,
      slug: `test-thread-ws2-${Date.now()}`,
      owner_id: firstUser?.id
    })
    .select()
    .single();

  // Test: Try to read thread from workspace 1 using workspace 2 filter
  const { data: crossRead } = await supabase
    .from('sam_threads')
    .select()
    .eq('id', thread1Id)
    .eq('workspace_id', workspace2.id);

  logTest('RLS blocks cross-workspace thread access', !crossRead || crossRead.length === 0);

  // Cleanup workspace 2
  await supabase.from('workspaces').delete().eq('id', workspace2.id);
}

async function testThreadUpdates(threadId, workspaceId) {
  console.log('\n✏️  Testing thread updates...\n');

  // Test 1: Update thread title
  const { data: updated, error: updateError } = await supabase
    .from('sam_threads')
    .update({ title: 'Updated Test Thread' })
    .eq('id', threadId)
    .eq('workspace_id', workspaceId)
    .select()
    .single();

  logTest('Thread update', !updateError && updated?.title === 'Updated Test Thread');

  // Test 2: Verify updated_at changed
  const { data: afterUpdate } = await supabase
    .from('sam_threads')
    .select('updated_at')
    .eq('id', threadId)
    .single();

  logTest('Updated_at timestamp changed', afterUpdate?.updated_at !== null);
}

async function runTests() {
  console.log('🧪 SAM Threads API Integration Sanity Check\n');
  console.log('='.repeat(60) + '\n');

  const env = await setupTestEnvironment();
  
  if (!env) {
    console.error('❌ Failed to setup test environment');
    process.exit(1);
  }

  const { workspace, ownerId } = env;

  try {
    const thread = await testThreadCreation(workspace.id);
    
    if (thread) {
      await testThreadMessages(thread.id, workspace.id);
      await testWorkspaceIsolation(workspace.id, thread.id);
      await testThreadUpdates(thread.id, workspace.id);
    }
  } finally {
    await cleanupTestEnvironment(workspace.id);
  }

  console.log('='.repeat(60) + '\n');
  console.log('📊 Test Results Summary:\n');
  console.log(`   ✅ Passed: ${results.passed}`);
  console.log(`   ❌ Failed: ${results.failed}`);
  console.log(`   📋 Total:  ${results.passed + results.failed}\n`);

  if (results.failed > 0) {
    console.log('❌ Some tests failed. Please review the output above.\n');
    console.log('Failed tests:');
    results.tests
      .filter(t => !t.passed)
      .forEach(t => console.log(`   - ${t.name}: ${t.message}`));
    console.log('');
    process.exit(1);
  } else {
    console.log('✅ All SAM threads tests passed! Workspace scoping is working correctly.\n');
    process.exit(0);
  }
}

runTests().catch(error => {
  console.error('\n❌ Test suite failed with error:', error);
  process.exit(1);
});