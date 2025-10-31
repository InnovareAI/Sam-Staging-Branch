#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const INNOVARE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'

console.log('🔀 Splitting InnovareAI Workspace\n')

// Get members
const { data: members } = await supabase
  .from('workspace_members')
  .select('user_id, role')
  .eq('workspace_id', INNOVARE_ID)

console.log(`Found ${members.length} members\n`)

// Get prospects & campaigns count
const { data: prospects } = await supabase
  .from('workspace_prospects')
  .select('id')
  .eq('workspace_id', INNOVARE_ID)

const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id')
  .eq('workspace_id', INNOVARE_ID)

console.log(`Data to copy:`)
console.log(`  Prospects: ${prospects?.length || 0}`)
console.log(`  Campaigns: ${campaigns?.length || 0}\n`)

// Create workspace for each member
for (const member of members) {
  const { data: user } = await supabase
    .from('users')
    .select('email')
    .eq('id', member.user_id)
    .single()

  console.log(`\n▶ ${user.email}`)

  // Create personal workspace
  const { data: newWs, error: wsError } = await supabase
    .from('workspaces')
    .insert({
      name: `${user.email}'s Workspace`,
      tenant: `user-${member.user_id}`,
      owner_id: member.user_id
    })
    .select()
    .single()

  if (wsError) {
    console.log(`  ❌ ${wsError.message}`)
    continue
  }

  console.log(`  ✅ Created workspace: ${newWs.id}`)

  // Copy prospects
  if (prospects && prospects.length > 0) {
    const { data: copiedProspects } = await supabase
      .from('workspace_prospects')
      .select('*')
      .eq('workspace_id', INNOVARE_ID)

    if (copiedProspects) {
      const toInsert = copiedProspects.map(p => ({
        ...p,
        id: undefined,
        workspace_id: newWs.id,
        created_at: undefined,
        updated_at: undefined
      }))

      const { error: pError } = await supabase
        .from('workspace_prospects')
        .insert(toInsert)

      if (!pError) {
        console.log(`  ✅ Copied ${toInsert.length} prospects`)
      } else {
        console.log(`  ⚠️ Prospects error: ${pError.message}`)
      }
    }
  }

  // Copy campaigns
  if (campaigns && campaigns.length > 0) {
    const { data: copiedCampaigns } = await supabase
      .from('campaigns')
      .select('*')
      .eq('workspace_id', INNOVARE_ID)

    if (copiedCampaigns) {
      const toInsert = copiedCampaigns.map(c => ({
        ...c,
        id: undefined,
        workspace_id: newWs.id,
        status: 'draft',
        created_at: undefined,
        updated_at: undefined
      }))

      const { error: cError } = await supabase
        .from('campaigns')
        .insert(toInsert)

      if (!cError) {
        console.log(`  ✅ Copied ${toInsert.length} campaigns (as drafts)`)
      } else {
        console.log(`  ⚠️ Campaigns error: ${cError.message}`)
      }
    }
  }
}

// Archive original
console.log(`\n📦 Archiving original workspace...`)
const { error: archiveError } = await supabase
  .from('workspaces')
  .update({
    name: '[ARCHIVED] InnovareAI Workspace'
  })
  .eq('id', INNOVARE_ID)

if (!archiveError) {
  console.log('  ✅ Archived\n')
} else {
  console.log(`  ❌ ${archiveError.message}\n`)
}

console.log('✅ Split complete!')
