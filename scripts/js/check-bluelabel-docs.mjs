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
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .eq('tenant', 'bluelabel')
    .single()

  console.log('🏢 Blue Label Labs')
  console.log(`   ID: ${workspace.id}\n`)

  const { data: docs } = await supabase
    .from('knowledge_base')
    .select('*')
    .eq('workspace_id', workspace.id)

  console.log(`📚 Documents: ${docs?.length || 0}\n`)

  if (docs && docs.length > 0) {
    docs.forEach(doc => {
      console.log(`- ${doc.title}`)
      console.log(`  Category: ${doc.category}`)
      console.log(`  Created: ${doc.created_at}`)
      console.log('')
    })
  } else {
    console.log('✅ Confirmed: Blue Label Labs has ZERO KB documents')
    console.log('   This explains why Stan can\'t proceed with campaigns')
  }
}

main().catch(console.error)
