#!/usr/bin/env node
/**
 * Split Sendingcell Workspace into Personal Workspaces
 * Creates one personal workspace per member with their own copy of data
 */

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
  console.log('🔀 Splitting Sendingcell Workspace\n')
  console.log('=' .repeat(80))

  // Step 1: Find Sendingcell workspace
  const { data: sendingcellWorkspace, error: wsError } = await supabase
    .from('workspaces')
    .select('*')
    .or('name.ilike.%sendingcell%,tenant.ilike.%sending%')
    .single()

  if (wsError || !sendingcellWorkspace) {
    console.error('❌ Sendingcell workspace not found')
    return
  }

  console.log(`✅ Found workspace: ${sendingcellWorkspace.name}`)
  console.log(`   ID: ${sendingcellWorkspace.id}`)
  console.log(`   Tenant: ${sendingcellWorkspace.tenant}\n`)

  // Step 2: Get all members
  const { data: members, error: membersError } = await supabase
    .from('workspace_members')
    .select('*, users(*)')
    .eq('workspace_id', sendingcellWorkspace.id)
    .order('created_at', { ascending: true })

  if (membersError || !members || members.length === 0) {
    console.error('❌ No members found')
    return
  }

  console.log(`👥 Found ${members.length} members:\n`)
  members.forEach((m, idx) => {
    console.log(`   ${idx + 1}. ${m.users.email} (${m.role})`)
  })

  console.log('\n📋 Migration Plan:\n')
  console.log(`   Create ${members.length} personal workspaces`)
  console.log(`   Copy data from Sendingcell to each workspace`)
  console.log(`   Archive original Sendingcell workspace\n`)

  // Step 3: Get data counts
  const { data: prospects } = await supabase
    .from('workspace_prospects')
    .select('id')
    .eq('workspace_id', sendingcellWorkspace.id)

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id')
    .eq('workspace_id', sendingcellWorkspace.id)

  const { data: kbDocs } = await supabase
    .from('knowledge_base')
    .select('id')
    .eq('workspace_id', sendingcellWorkspace.id)

  console.log('📊 Data to Copy:\n')
  console.log(`   Prospects: ${prospects?.length || 0}`)
  console.log(`   Campaigns: ${campaigns?.length || 0}`)
  console.log(`   KB Docs: ${kbDocs?.length || 0}\n`)

  // Step 4: Create personal workspaces for each member
  console.log('🚀 Creating Personal Workspaces:\n')

  const newWorkspaces = []

  for (const member of members) {
    const user = member.users

    console.log(`\n👤 Processing: ${user.email}`)

    // Create personal workspace
    const { data: newWorkspace, error: createError } = await supabase
      .from('workspaces')
      .insert({
        name: `${user.email}'s Workspace`,
        tenant: `user-${user.id}`,
        owner_id: user.id,
        workspace_type: 'personal',
        metadata: {
          migrated_from: 'Sendingcell',
          original_workspace_id: sendingcellWorkspace.id,
          migration_date: new Date().toISOString()
        }
      })
      .select()
      .single()

    if (createError) {
      console.error(`   ❌ Failed to create workspace: ${createError.message}`)
      continue
    }

    console.log(`   ✅ Created workspace: ${newWorkspace.id}`)
    newWorkspaces.push({ user, workspace: newWorkspace })

    // Copy prospects
    if (prospects && prospects.length > 0) {
      const { error: prospectError } = await supabase.rpc('duplicate_workspace_data', {
        p_source_workspace_id: sendingcellWorkspace.id,
        p_target_workspace_id: newWorkspace.id,
        p_copy_prospects: true,
        p_copy_campaigns: false,
        p_copy_knowledge_base: false
      })

      if (prospectError) {
        console.error(`   ⚠️  Failed to copy prospects: ${prospectError.message}`)
      } else {
        console.log(`   ✅ Copied ${prospects.length} prospects`)
      }
    }

    // Copy campaigns
    if (campaigns && campaigns.length > 0) {
      const { error: campaignError } = await supabase.rpc('duplicate_workspace_data', {
        p_source_workspace_id: sendingcellWorkspace.id,
        p_target_workspace_id: newWorkspace.id,
        p_copy_prospects: false,
        p_copy_campaigns: true,
        p_copy_knowledge_base: false
      })

      if (campaignError) {
        console.error(`   ⚠️  Failed to copy campaigns: ${campaignError.message}`)
      } else {
        console.log(`   ✅ Copied ${campaigns.length} campaigns`)
      }
    }

    // Copy knowledge base
    if (kbDocs && kbDocs.length > 0) {
      const { error: kbError } = await supabase.rpc('duplicate_workspace_data', {
        p_source_workspace_id: sendingcellWorkspace.id,
        p_target_workspace_id: newWorkspace.id,
        p_copy_prospects: false,
        p_copy_campaigns: false,
        p_copy_knowledge_base: true
      })

      if (kbError) {
        console.error(`   ⚠️  Failed to copy KB: ${kbError.message}`)
      } else {
        console.log(`   ✅ Copied ${kbDocs.length} KB documents`)
      }
    }
  }

  // Step 5: Archive original workspace
  console.log('\n📦 Archiving Original Workspace:\n')

  const { error: archiveError } = await supabase
    .from('workspaces')
    .update({
      name: `[ARCHIVED] ${sendingcellWorkspace.name}`,
      workspace_type: 'archived',
      metadata: {
        ...sendingcellWorkspace.metadata,
        archived_at: new Date().toISOString(),
        archived_reason: 'Split into personal workspaces',
        new_workspace_ids: newWorkspaces.map(nw => nw.workspace.id)
      }
    })
    .eq('id', sendingcellWorkspace.id)

  if (archiveError) {
    console.error(`   ❌ Failed to archive: ${archiveError.message}`)
  } else {
    console.log(`   ✅ Archived: ${sendingcellWorkspace.name}`)
  }

  // Step 6: Summary
  console.log('\n' + '=' .repeat(80))
  console.log('\n✅ Migration Complete!\n')

  console.log('📋 Summary:\n')
  newWorkspaces.forEach(({ user, workspace }, idx) => {
    console.log(`   ${idx + 1}. ${user.email}`)
    console.log(`      Workspace ID: ${workspace.id}`)
    console.log(`      Tenant: ${workspace.tenant}`)
    console.log(`      URL: https://app.meet-sam.com/workspace/${workspace.id}\n`)
  })

  console.log('📧 Next Steps:\n')
  console.log('   1. Notify users about their new personal workspaces')
  console.log('   2. Each user needs to reconnect their LinkedIn account')
  console.log('   3. Verify data copied correctly')
  console.log('   4. Delete archived workspace after 30 days\n')
}

main().catch(console.error)
