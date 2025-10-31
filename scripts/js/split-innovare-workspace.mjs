#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('🔀 Splitting Innovare Workspace\n')

// 1. Find Innovare workspace
const { data: innovare } = await supabase.rpc('identify_workspace', {
  p_identifier: 'innovare'
})

if (!innovare?.[0]) throw new Error('Innovare workspace not found')

console.log(`✅ Found: ${innovare[0].workspace_name}`)
console.log(`   ID: ${innovare[0].workspace_id}\n`)

// 2. Get members
const { data: members } = await supabase
  .from('workspace_members')
  .select('*, users(*)')
  .eq('workspace_id', innovare[0].workspace_id)

console.log(`👥 Members: ${members.length}\n`)

// 3. Create personal workspaces
for (const m of members) {
  console.log(`▶ ${m.users.email}`)

  const { data: ws } = await supabase
    .from('workspaces')
    .insert({
      name: `${m.users.email}'s Workspace`,
      tenant: `user-${m.user_id}`,
      owner_id: m.user_id,
      workspace_type: 'personal'
    })
    .select()
    .single()

  if (!ws) {
    console.log(`  ❌ Failed`)
    continue
  }

  // Copy data
  await supabase.rpc('duplicate_workspace_data', {
    p_source_workspace_id: innovare[0].workspace_id,
    p_target_workspace_id: ws.id,
    p_copy_prospects: true,
    p_copy_campaigns: true,
    p_copy_knowledge_base: true
  })

  console.log(`  ✅ Created: ${ws.id}`)
}

// 4. Archive Innovare
await supabase
  .from('workspaces')
  .update({
    name: `[ARCHIVED] ${innovare[0].workspace_name}`,
    workspace_type: 'archived'
  })
  .eq('id', innovare[0].workspace_id)

console.log(`\n✅ Split complete`)
