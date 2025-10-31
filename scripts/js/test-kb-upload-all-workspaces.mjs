#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('🧪 Testing KB upload for all workspaces\n')

const { data: workspaces } = await supabase
  .from('workspaces')
  .select('id, name, owner_id')
  .order('created_at', { ascending: false })

console.log(`Testing ${workspaces?.length || 0} workspaces...\n`)

for (const ws of workspaces || []) {
  // Test insert
  const testDoc = {
    workspace_id: ws.id,
    title: 'TEST - Upload Verification',
    content: 'This is a test document to verify KB uploads work',
    category: 'test',
    source_type: 'document_upload',
    is_active: true
  }

  const { data: inserted, error } = await supabase
    .from('knowledge_base')
    .insert(testDoc)
    .select()

  if (error) {
    console.log(`❌ ${ws.name}: ${error.message}`)
  } else {
    console.log(`✅ ${ws.name}`)
    
    // Clean up test doc
    await supabase.from('knowledge_base').delete().eq('id', inserted[0].id)
  }
}

console.log('\n✅ Test complete')
