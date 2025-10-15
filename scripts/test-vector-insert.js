#!/usr/bin/env node
/**
 * Test script to diagnose knowledge base vector insertion issues
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testVectorInsertion() {
  console.log('🧪 Testing Knowledge Base Vector Insertion...\n');

  // Check if tables exist
  console.log('1️⃣ Checking if knowledge_base_vectors table exists...');
  const { data: tableCheck, error: tableError } = await supabase
    .from('knowledge_base_vectors')
    .select('id')
    .limit(1);

  if (tableError) {
    console.error('❌ Table check failed:', tableError);
    return;
  }
  console.log('✅ Table exists\n');

  // Get a real workspace first
  console.log('2️⃣ Finding a real workspace...');
  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id')
    .limit(1)
    .single();

  if (workspaceError || !workspace) {
    console.error('❌ No workspace found:', workspaceError);
    return;
  }
  console.log('✅ Found workspace:', workspace.id + '\n');

  // Create a test document first
  console.log('3️⃣ Creating test document...');
  const testDocId = randomUUID();
  const { error: docError } = await supabase
    .from('knowledge_base_documents')
    .insert({
      id: testDocId,
      workspace_id: workspace.id,
      section_id: 'test',
      filename: 'test-doc.txt',
      original_filename: 'test-doc.txt',
      file_type: 'text/plain',
      file_size: 12,
      storage_path: 'inline://test',
      extracted_content: 'Test content',
      uploaded_by: workspace.id // Using workspace id as placeholder
    });

  if (docError) {
    console.error('❌ Document creation failed:', docError);
    return;
  }
  console.log('✅ Test document created\n');

  // Create a test vector
  console.log('4️⃣ Testing vector insertion...');
  const testVector = Array.from({ length: 1536 }, () => Math.random());
  
  const testEntry = {
    id: randomUUID(),
    workspace_id: workspace.id,
    document_id: testDocId,
    section_id: 'test',
    chunk_index: 0,
    content: 'This is a test chunk for vector insertion',
    embedding: testVector,
    metadata: { test: true },
    tags: ['test']
  };

  const { data: insertData, error: insertError } = await supabase
    .from('knowledge_base_vectors')
    .insert(testEntry);

  if (insertError) {
    console.error('❌ Vector insertion failed:', insertError);
    console.error('Error details:', JSON.stringify(insertError, null, 2));
    return;
  }

  console.log('✅ Vector inserted successfully\n');

  // Clean up
  console.log('5️⃣ Cleaning up test data...');
  await supabase
    .from('knowledge_base_vectors')
    .delete()
    .eq('id', testEntry.id);
  
  await supabase
    .from('knowledge_base_documents')
    .delete()
    .eq('id', testDocId);

  console.log('✅ Test complete!\n');
}

testVectorInsertion().catch(console.error);
