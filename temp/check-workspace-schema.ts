import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkWorkspaceSchema() {
  console.log('🔍 Checking workspaces table schema...\n')

  // Get one workspace to see all columns
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .limit(1)
    .single()

  if (!workspace) {
    console.log('No workspaces found')
    return
  }

  console.log('Available columns in workspaces table:')
  Object.keys(workspace).forEach(column => {
    const value = workspace[column]
    const type = typeof value
    console.log(`  - ${column}: ${type} = ${JSON.stringify(value)}`)
  })

  console.log('\n📋 Current workspace structure:')
  console.log(JSON.stringify(workspace, null, 2))
}

checkWorkspaceSchema().catch(console.error)
