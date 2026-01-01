import { createClient } from '@supabase/supabase-js'

async function checkTenantConstraint() {
  console.log('🔍 Checking existing tenant values...\n')

  // Get all unique tenant values
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('name, tenant')
    .order('tenant')

  const tenants = new Set(workspaces?.map(w => w.tenant || 'null'))

  console.log('Existing tenant values:')
  tenants.forEach(tenant => {
    const count = workspaces?.filter(w => (w.tenant || 'null') === tenant).length
    console.log(`  - ${tenant} (${count} workspace${count !== 1 ? 's' : ''})`)
  })

  console.log('\n📋 All workspaces:')
  workspaces?.forEach(ws => {
    console.log(`  ${ws.name}: tenant = "${ws.tenant || 'null'}"`)
  })
}

checkTenantConstraint().catch(console.error)
