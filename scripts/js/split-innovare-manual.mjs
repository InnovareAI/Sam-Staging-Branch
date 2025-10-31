#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('🔀 Splitting Innovare Workspace\n')

// Find Innovare
const { data: workspaces } = await supabase
  .from('workspaces')
  .select('*')
  .ilike('name', '%innovare%')

console.log('Found workspaces:', workspaces?.map(w => w.name))

if (!workspaces?.[0]) {
  console.log('❌ No Innovare workspace found')
  process.exit(1)
}

const innovare = workspaces[0]
console.log(`✅ ${innovare.name} (${innovare.id})\n`)

// Get members
const { data: members } = await supabase
  .from('workspace_members')
  .select('*, users(*)')
  .eq('workspace_id', innovare.id)

console.log(`👥 ${members.length} members:\n`)
members.forEach((m, i) => console.log(`${i+1}. ${m.users.email} (${m.role})`))

console.log('\n✅ Run node scripts/js/split-innovare-manual.mjs to see members')
console.log('Then manually create workspaces in Supabase dashboard')
