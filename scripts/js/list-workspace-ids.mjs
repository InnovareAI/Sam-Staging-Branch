#!/usr/bin/env node

/**
 * List all workspace IDs with their client codes
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// Client code mappings
const CLIENT_CODES = {
  'InnovareAI Workspace': 'IAI',
  '3cubed Workspace': '3AI',
  'Blue Label Labs': 'BLL',
  'Sendingcell Workspace': 'SDC',
  'True People Consulting': 'TPC',
  'WT Matchmaker Workspace': 'WTM'
}

async function listWorkspaceIDs() {
  console.log('📋 CLIENT WORKSPACE IDs\n')
  console.log('='.repeat(100))

  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name')
    .order('name')

  console.log('\n')
  for (const workspace of workspaces) {
    const clientCode = CLIENT_CODES[workspace.name] || 'N/A'
    console.log(`🏢 ${workspace.name}`)
    console.log(`   Client Code: ${clientCode}`)
    console.log(`   Workspace ID: ${workspace.id}`)
    console.log('')
  }

  console.log('='.repeat(100))
  console.log('\n📊 QUICK REFERENCE:\n')
  for (const workspace of workspaces) {
    const clientCode = CLIENT_CODES[workspace.name] || 'N/A'
    console.log(`${clientCode.padEnd(6)} → ${workspace.id} (${workspace.name})`)
  }
  console.log('')
}

listWorkspaceIDs()
  .then(() => process.exit(0))
  .catch(console.error)
