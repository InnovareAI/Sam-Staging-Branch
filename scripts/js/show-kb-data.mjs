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
  console.log('📚 Knowledge Base Data\n')

  const { data: docs, error } = await supabase
    .from('knowledge_base')
    .select('*')
    .limit(20)

  if (error) {
    console.error('❌ Error:', error.message)
    return
  }

  console.log(`Found ${docs?.length || 0} documents\n`)
  
  if (docs && docs.length > 0) {
    docs.forEach((doc, i) => {
      console.log(`${i + 1}. ${doc.title}`)
      console.log(`   Category: ${doc.category}`)
      console.log(`   Subcategory: ${doc.subcategory || 'none'}`)
      console.log(`   Workspace: ${doc.workspace_id}`)
      console.log(`   Created: ${doc.created_at}`)
      console.log('')
    })
  } else {
    console.log('No documents found')
  }
}

main().catch(console.error)
