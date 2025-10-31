#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TRUE_PEOPLE_ID = 'dea5a7f2-673c-4429-972d-6ba5fca473fb'

console.log('📦 Migrating Samantha KB\n')

const { data: oldDocs } = await supabase
  .from('knowledge_base_documents')
  .select('*')
  .eq('workspace_id', TRUE_PEOPLE_ID)

console.log(`Found ${oldDocs?.length || 0} documents\n`)

let migrated = 0
for (const doc of oldDocs || []) {
  const { error } = await supabase
    .from('knowledge_base')
    .insert({
      workspace_id: doc.workspace_id,
      title: doc.filename || doc.original_filename || 'Untitled',
      content: doc.extracted_content || doc.summary || '',
      category: doc.section || doc.suggested_section || 'uncategorized',
      source_type: 'document_upload',
      source_metadata: {
        original_filename: doc.original_filename,
        file_size: doc.file_size,
        migrated_from_id: doc.id
      },
      is_active: true
    })

  if (!error) {
    migrated++
    console.log(`✅ ${migrated}/${oldDocs.length}: ${doc.original_filename}`)
  } else {
    console.log(`❌ ${doc.original_filename}: ${error.message}`)
  }
}

console.log(`\n✅ Migrated ${migrated}/${oldDocs?.length || 0} documents`)
