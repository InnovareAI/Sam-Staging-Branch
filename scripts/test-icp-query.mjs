#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const workspaceId = 'dea5a7f2-673c-4429-972d-6ba5fca473fb';

console.log('\n📊 Testing ICP document query...\n');

// Test the exact query from the code (FIXED - removed is_active)
const { data: icpDocs, error } = await supabase
  .from('knowledge_base_documents')
  .select('id, filename, section_id, created_at')
  .eq('workspace_id', workspaceId)
  .or('section_id.eq.icp,section_id.eq.ideal-customer,filename.ilike.%ideal%client%,filename.ilike.%icp%')
  .order('created_at', { ascending: false });

if (error) {
  console.error('❌ Error:', error);
} else {
  const count = icpDocs ? icpDocs.length : 0;
  console.log(`✅ Found ${count} ICP documents:`);
  if (icpDocs) {
    icpDocs.forEach(d => {
      console.log(`  - ${d.filename}`);
      console.log(`    section_id: "${d.section_id}"`);
    });
  }
}

// Test if "Ideal Client" file exists in products
console.log('\n🔍 Looking for "Ideal Client" in products section...\n');
const { data: idealClient } = await supabase
  .from('knowledge_base_documents')
  .select('id, filename, section_id')
  .eq('workspace_id', workspaceId)
  .ilike('filename', '%ideal%client%');

const idealCount = idealClient ? idealClient.length : 0;
console.log(`✅ Found ${idealCount} documents with "Ideal Client" in name:`);
if (idealClient) {
  idealClient.forEach(d => {
    console.log(`  - ${d.filename}`);
    console.log(`    section_id: "${d.section_id}"`);
  });
}
