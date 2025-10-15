#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDocument() {
  const docId = '11d72bd9-ceb4-40d2-9b51-ca3ce7ac11d1';
  
  console.log('🔍 Checking document:', docId);
  
  const { data, error } = await supabase
    .from('knowledge_base_documents')
    .select('id, workspace_id, section_id, filename, status, vector_chunks')
    .eq('id', docId)
    .single();
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log('✅ Document found:');
  console.log('   Workspace ID:', data.workspace_id);
  console.log('   Section:', data.section_id);
  console.log('   Filename:', data.filename);
  console.log('   Status:', data.status);
  console.log('   Vector chunks:', data.vector_chunks);
  
  // Check if vectors exist
  const { data: vectors, error: vectorError } = await supabase
    .from('knowledge_base_vectors')
    .select('id')
    .eq('document_id', docId);
  
  if (vectorError) {
    console.error('❌ Vector query error:', vectorError);
  } else {
    console.log('   Vectors in DB:', vectors?.length || 0);
  }
}

checkDocument().catch(console.error);
