import { createClient } from '@supabase/supabase-js'

async function verifyMigrations() {
  console.log('🔍 Verifying workspace migrations...\n')

  // Get all workspaces with new fields
  const { data: workspaces, error } = await supabase
    .from('workspaces')
    .select('name, tenant, reseller_affiliation')
    .order('name')

  if (error) {
    console.error('❌ Error fetching workspaces:', error)
    return
  }

  console.log('📊 All Workspaces:\n')
  console.log('─'.repeat(90))
  console.log('| Workspace Name                  | Tenant        | Reseller Affiliation |')
  console.log('─'.repeat(90))

  workspaces?.forEach(ws => {
    const name = ws.name.padEnd(31)
    const tenant = (ws.tenant || 'null').padEnd(13)
    const reseller = (ws.reseller_affiliation || 'null').padEnd(20)
    console.log(`| ${name} | ${tenant} | ${reseller} |`)
  })

  console.log('─'.repeat(90))

  // Verify constraints
  console.log('\n✅ Verification Results:')

  const hasReseller = workspaces?.every(ws => ws.reseller_affiliation !== null)
  const hasTenant = workspaces?.every(ws => ws.tenant !== null)

  console.log(`   - All workspaces have tenant: ${hasTenant ? '✅' : '❌'}`)
  console.log(`   - All workspaces have reseller_affiliation: ${hasReseller ? '✅' : '❌'}`)

  // Check specific values
  const threeCubedCount = workspaces?.filter(ws => ws.reseller_affiliation === '3cubed').length
  const innovareaiCount = workspaces?.filter(ws => ws.reseller_affiliation === 'innovareai').length

  console.log(`\n📈 Reseller Distribution:`)
  console.log(`   - 3cubed (invite-only): ${threeCubedCount} workspaces`)
  console.log(`   - innovareai (Stripe): ${innovareaiCount} workspaces`)

  console.log('\n✨ Migration verification complete!')
}

verifyMigrations().catch(console.error)
