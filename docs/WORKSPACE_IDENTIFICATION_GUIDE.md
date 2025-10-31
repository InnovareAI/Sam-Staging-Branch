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

console.log('🔍 Workspace Identification Examples\n')
console.log('=' .repeat(80))

// Example 1: Find workspace by email
console.log('\n📧 Example 1: Find workspace by owner email')
console.log('```sql')
console.log(`SELECT * FROM identify_workspace('user@example.com');`)
console.log('```\n')

const { data: byEmail } = await supabase.rpc('identify_workspace', {
  p_identifier: 'tl@innovareai.com'
})
if (byEmail && byEmail.length > 0) {
  console.log('Result:')
  console.log(`  Workspace: ${byEmail[0].workspace_name}`)
  console.log(`  ID: ${byEmail[0].workspace_id}`)
  console.log(`  Tenant: ${byEmail[0].tenant}`)
  console.log(`  Type: ${byEmail[0].workspace_type}`)
  console.log(`  Owner: ${byEmail[0].owner_email}`)
}

// Example 2: List all workspaces
console.log('\n📋 Example 2: List all workspaces')
console.log('```sql')
console.log(`SELECT * FROM workspace_directory;`)
console.log('```\n')

const { data: allWorkspaces } = await supabase
  .from('workspace_directory')
  .select('*')
  .limit(5)

if (allWorkspaces) {
  console.log('Results:')
  allWorkspaces.forEach((w, idx) => {
    console.log(`\n  ${idx + 1}. ${w.workspace_name}`)
    console.log(`     Owner: ${w.owner_email}`)
    console.log(`     Type: ${w.workspace_type}`)
    console.log(`     Prospects: ${w.prospect_count}`)
    console.log(`     Campaigns: ${w.campaign_count}`)
  })
}

// Example 3: Find InnovareAI workspace
console.log('\n\n🏢 Example 3: Find InnovareAI workspace')
console.log('```sql')
console.log(`SELECT * FROM identify_workspace('innovare');`)
console.log('```\n')

const { data: innovare } = await supabase.rpc('identify_workspace', {
  p_identifier: 'innovare'
})
if (innovare && innovare.length > 0) {
  console.log('Result:')
  console.log(`  Workspace: ${innovare[0].workspace_name}`)
  console.log(`  Type: ${innovare[0].workspace_type}`)
  console.log(`  Members: ${innovare[0].member_count}`)
}

console.log('\n' + '=' .repeat(80))
console.log('\n✅ Identification methods available:\n')
console.log('   1. Owner email → workspace')
console.log('   2. Workspace ID → details')
console.log('   3. Tenant slug → workspace')
console.log('   4. User ID → workspace')
console.log('   5. View all → workspace_directory\n')
