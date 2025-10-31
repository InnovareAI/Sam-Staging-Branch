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
  // Get Blue Label workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .eq('tenant', 'bluelabel')
    .single()

  console.log('🏢 Blue Label Labs:', workspace.id, '\n')

  // Get ALL members (no select filter)
  const { data: members, error } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspace.id)

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log(`Found ${members?.length || 0} membership records:\n`)
  
  members?.forEach(m => {
    console.log('Member:', m.id)
    console.log('  User ID:', m.user_id)
    console.log('  Role:', m.role)
    console.log('  Created:', m.created_at)
    console.log('')
  })

  // Get user emails
  for (const m of members || []) {
    const { data: { user } } = await supabase.auth.admin.getUserById(m.user_id)
    console.log(`User ${m.user_id}: ${user?.email || 'unknown'}`)
  }
}

main().catch(console.error)
