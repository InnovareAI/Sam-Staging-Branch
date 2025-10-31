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

console.log('🔄 Workspace Architecture Migration: Multi-User → Single-User\n')
console.log('=' .repeat(80))

async function main() {
  // Step 1: Audit current state
  console.log('\n📊 Step 1: Auditing current workspace state...\n')

  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('*')
    .order('created_at')

  console.log(`Found ${workspaces.length} total workspaces`)

  const multiUserWorkspaces = []

  for (const ws of workspaces) {
    const { data: members } = await supabase
      .from('workspace_members')
      .select('user_id, role')
      .eq('workspace_id', ws.id)

    const memberCount = members?.length || 0

    if (memberCount > 1) {
      multiUserWorkspaces.push({
        workspace: ws,
        members,
        memberCount,
      })

      console.log(`\n🏢 ${ws.name}`)
      console.log(`   Tenant: ${ws.tenant}`)
      console.log(`   Members: ${memberCount}`)
      members.forEach((m) => {
        console.log(`     - ${m.user_id} (${m.role})`)
      })
    }
  }

  console.log(`\n✅ Single-user workspaces: ${workspaces.length - multiUserWorkspaces.length}`)
  console.log(`⚠️  Multi-user workspaces: ${multiUserWorkspaces.length}`)

  if (multiUserWorkspaces.length === 0) {
    console.log('\n🎉 No multi-user workspaces found! Migration not needed.')
    return
  }

  // Step 2: Plan migration
  console.log('\n📋 Step 2: Migration Plan\n')

  for (const { workspace, members } of multiUserWorkspaces) {
    console.log(`\n${workspace.name}:`)

    if (workspace.name === 'InnovareAI' || workspace.tenant.includes('innovare')) {
      console.log('  → Keep as SHARED workspace (internal team)')
      console.log('  → Mark workspace_type = "shared"')
      console.log('  → Set owner_id to first owner member')
    } else if (workspace.name === 'Sendingcell' || workspace.tenant.includes('sending')) {
      console.log('  → Keep as SHARED workspace (paused but multi-user)')
      console.log('  → Mark workspace_type = "shared"')
      console.log('  → Set owner_id to first owner member')
      console.log('  → Note: Customer paused for 4 weeks')
    } else {
      console.log('  → Split into PERSONAL workspaces (one per member)')
      console.log(`  → Create ${members.length} new personal workspaces`)
      console.log('  → Duplicate data for each user')
    }
  }

  // Step 3: Execute migration
  console.log('\n🚀 Step 3: Execute Migration? (DRY RUN)\n')
  console.log('The migration SQL has been created at:')
  console.log('  supabase/migrations/20251031000004_convert_to_single_user_workspaces.sql')
  console.log('\nTo apply migration:')
  console.log('  1. Review the SQL file')
  console.log('  2. Run in Supabase SQL Editor')
  console.log('  3. Verify with: SELECT * FROM workspaces WHERE workspace_type IS NOT NULL;')

  // Step 4: API Updates
  console.log('\n📝 Step 4: API Updates Required\n')
  console.log('Replace all instances of:')
  console.log('  ❌ workspace_members checks')
  console.log('  ✅ workspace owner_id checks (for personal workspaces)')
  console.log('\nUse new helper: lib/workspace-auth.ts')
  console.log('  - authorizeWorkspaceAccess()')
  console.log('  - getUserWorkspaces()')
  console.log('  - getUserDefaultWorkspace()')

  console.log('\n' + '=' .repeat(80))
  console.log('✅ Migration plan complete. Ready to execute when you are.\n')
}

main().catch(console.error)
