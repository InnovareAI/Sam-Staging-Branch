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
  console.log('🗑️  Removing Fake/Seed KB Data\n')

  // Get all workspaces
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name')

  console.log(`Found ${workspaces.length} workspaces\n`)

  for (const ws of workspaces) {
    console.log(`🏢 ${ws.name}`)

    // Delete from knowledge_base where it's seed data (no source, created around Oct 21)
    const { data: deleted, error } = await supabase
      .from('knowledge_base')
      .delete()
      .eq('workspace_id', ws.id)
      .is('source_attachment_id', null)
      .lt('created_at', '2025-10-22T00:00:00')
      .select('id, title')

    if (error) {
      console.log(`   ❌ Error: ${error.message}`)
    } else {
      console.log(`   🗑️  Deleted ${deleted?.length || 0} seed documents`)
      if (deleted && deleted.length > 0) {
        deleted.forEach(d => console.log(`      - ${d.title}`))
      }
    }
  }

  console.log('\n✅ Fake data removal complete')
}

main().catch(console.error)
