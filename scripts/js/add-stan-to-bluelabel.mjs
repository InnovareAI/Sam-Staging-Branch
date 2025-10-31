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
  console.log('👤 Adding Stan to Blue Label Labs Workspace\n')

  // Get Stan's user ID
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const stan = users?.find(u => u.email === 'stan01@signali.ai')

  if (!stan) {
    console.error('❌ Stan user not found')
    return
  }

  console.log(`✅ Stan user ID: ${stan.id}`)

  // Get Blue Label Labs workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .eq('tenant', 'bluelabel')
    .single()

  console.log(`✅ Blue Label Labs workspace ID: ${workspace.id}\n`)

  // Add Stan as owner
  console.log('🔄 Adding Stan as owner...')
  
  const { data: membership, error } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspace.id,
      user_id: stan.id,
      role: 'owner'
    })
    .select()
    .single()

  if (error) {
    console.error('❌ Error:', error.message)
    return
  }

  console.log('✅ SUCCESS! Stan is now an owner of Blue Label Labs\n')
  console.log('Stan can now:')
  console.log('  ✓ Upload documents to Knowledge Base')
  console.log('  ✓ Create and activate campaigns')
  console.log('  ✓ Manage prospects')
  console.log('  ✓ Configure ICP settings')
  console.log('  ✓ Full workspace access')
}

main().catch(console.error)
