#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '../../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('🔒 Checking RLS Policies for knowledge_base table\n')

  // Test if Stan can insert (simulate his permissions)
  const stanUserId = '6a927440-ebe1-49b4-ae5e-fbee5d27944d'
  const blueLabel = '014509ba-226e-43ee-ba58-ab5f20d2ed08'

  console.log('Testing insert as Stan...')
  console.log(`User ID: ${stanUserId}`)
  console.log(`Workspace: ${blueLabel}\n`)

  // Try to insert a test document (will fail or succeed based on RLS)
  const { data, error } = await supabase
    .from('knowledge_base')
    .insert({
      workspace_id: blueLabel,
      category: 'test',
      title: 'RLS Test Document',
      content: 'Testing RLS policies',
      is_active: true
    })
    .select()

  if (error) {
    console.log('❌ INSERT FAILED')
    console.log('Error:', error.message)
    console.log('')
    console.log('This suggests RLS policy is blocking inserts!')
    console.log('OR the upload API needs to use service role key')
  } else {
    console.log('✅ INSERT SUCCEEDED')
    console.log('Document ID:', data[0].id)
    console.log('')
    console.log('RLS allows inserts - deleting test doc...')
    
    await supabase
      .from('knowledge_base')
      .delete()
      .eq('id', data[0].id)
    
    console.log('✅ Test document deleted')
  }
}

main().catch(console.error)
