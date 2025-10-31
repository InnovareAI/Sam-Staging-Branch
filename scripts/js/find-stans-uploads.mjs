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
  const { data: ws } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('tenant', 'bluelabel')
    .single()

  console.log(`🔍 Searching for Stan's uploads in Blue Label Labs\n`)
  console.log(`Workspace: ${ws.name} (${ws.id})\n`)

  // Check knowledge_base table
  const { data: kb } = await supabase
    .from('knowledge_base')
    .select('*')
    .eq('workspace_id', ws.id)

  console.log(`📚 knowledge_base table: ${kb?.length || 0} documents`)

  // Check knowledge_base_documents table
  const { data: docs, error: docsError } = await supabase
    .from('knowledge_base_documents')
    .select('*')
    .eq('workspace_id', ws.id)

  if (docsError) {
    console.log(`📄 knowledge_base_documents table: DOES NOT EXIST`)
    console.log(`   Error: ${docsError.message}`)
  } else {
    console.log(`📄 knowledge_base_documents table: ${docs?.length || 0} documents`)
    if (docs && docs.length > 0) {
      console.log('\n🎯 FOUND UPLOADS!\n')
      docs.forEach(d => {
        console.log(`- ${d.filename}`)
        console.log(`  Uploaded: ${d.created_at}`)
      })
    }
  }

  if ((kb?.length || 0) === 0 && (docs?.length || 0) === 0) {
    console.log('\n❌ NO UPLOADS FOUND IN ANY TABLE')
    console.log('   Stan\'s uploads are truly failing')
  }
}

main().catch(console.error)
