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
  console.log('🔧 Fixing Blue Label Labs Ownership\n')

  // Find workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .eq('tenant', 'bluelabel')
    .single()

  console.log('🏢 Workspace:', workspace.name)

  // Get all members
  const { data: members } = await supabase
    .from('workspace_members')
    .select('*, users(email)')
    .eq('workspace_id', workspace.id)

  console.log(`\n👥 Current members: ${members?.length || 0}`)
  members?.forEach(m => {
    console.log(`   - ${m.users?.email} (${m.role})`)
  })

  // Find Stan
  const stan = members?.find(m => m.users?.email === 'stan01@signali.ai')

  if (!stan) {
    console.error('\n❌ Stan not found in workspace members!')
    return
  }

  console.log(`\n🎯 Stan's current role: ${stan.role}`)

  if (stan.role === 'owner') {
    console.log('✅ Stan is already an owner')
    return
  }

  // Promote Stan to owner
  console.log('\n🔄 Promoting Stan to owner...')
  const { error } = await supabase
    .from('workspace_members')
    .update({ role: 'owner' })
    .eq('id', stan.id)

  if (error) {
    console.error('❌ Error:', error.message)
    return
  }

  console.log('✅ Stan is now an owner of Blue Label Labs workspace!')
  console.log('\nThis should enable:')
  console.log('  - Document upload permissions')
  console.log('  - Campaign creation')
  console.log('  - Full workspace access')
}

main().catch(console.error)
