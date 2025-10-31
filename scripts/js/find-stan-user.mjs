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
  console.log('🔍 Finding Stan\'s User Account\n')

  // Find user by email
  const { data: { users }, error } = await supabase.auth.admin.listUsers()

  const stan = users?.find(u => u.email === 'stan01@signali.ai')

  if (!stan) {
    console.error('❌ User stan01@signali.ai NOT FOUND in auth.users')
    console.log('\n   Stan needs to be invited/created first!')
    return
  }

  console.log('✅ User found:')
  console.log(`   ID: ${stan.id}`)
  console.log(`   Email: ${stan.email}`)
  console.log(`   Created: ${stan.created_at}`)

  // Find which workspaces Stan is in
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('*, workspaces(name, tenant)')
    .eq('user_id', stan.id)

  console.log(`\n📋 Stan's workspace memberships: ${memberships?.length || 0}`)
  
  if (memberships && memberships.length > 0) {
    memberships.forEach(m => {
      console.log(`   - ${m.workspaces?.name} (${m.role})`)
    })
  } else {
    console.log('   ❌ Stan is not a member of ANY workspace!')
    console.log('\n   This is the problem - he needs to be added to Blue Label Labs')
  }

  // Show Blue Label Labs members
  const { data: blWorkspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('tenant', 'bluelabel')
    .single()

  const { data: blMembers } = await supabase
    .from('workspace_members')
    .select('*, users(email)')
    .eq('workspace_id', blWorkspace.id)

  console.log(`\n🏢 Blue Label Labs members: ${blMembers?.length || 0}`)
  blMembers?.forEach(m => {
    console.log(`   - ${m.users?.email} (${m.role})`)
  })
}

main().catch(console.error)
