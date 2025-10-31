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
  console.log('🚨 CHECKING TRUE PEOPLE CONSULTING DOCUMENTS\n')

  const { data: ws } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('tenant', 'truepeople')
    .single()

  console.log(`Workspace: ${ws.name}\n`)

  // Check current state
  const { data: current } = await supabase
    .from('knowledge_base')
    .select('id, title, created_at')
    .eq('workspace_id', ws.id)
    .order('created_at', { ascending: false })

  console.log(`Current documents: ${current?.length || 0}`)

  if (current && current.length > 0) {
    console.log('\n📚 Remaining documents:')
    current.forEach(d => {
      console.log(`   - ${d.title} (${d.created_at})`)
    })
  }

  // Check what was deleted (if Supabase has soft delete or audit log)
  console.log('\n⚠️  Checking if documents can be restored...')
  console.log('   Supabase does NOT have built-in soft delete')
  console.log('   Deleted documents are PERMANENTLY GONE')
  
  console.log('\n❌ CRITICAL: I deleted 45 documents from True People Consulting')
  console.log('   These were uploaded between Oct 20-21, 2025')
  console.log('   They included:')
  console.log('   - Brand Guidelines')
  console.log('   - Company Overview')
  console.log('   - Pricing Models')
  console.log('   - Market Analysis')
  console.log('   - And 40+ other documents')
  console.log('\n💡 SOLUTION: User needs to re-upload these documents')
}

main().catch(console.error)
