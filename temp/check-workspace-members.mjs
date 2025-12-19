import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
)

const workspaces = [
  'cd57981a-e63b-401c-bde1-ac71752c2293',
  '7f0341da-88db-476b-ae0a-fc0da5b70861',
  '96c03b38-a2f4-40de-9e16-43098599e1d4'
]

console.log('=== CHECKING WORKSPACE MEMBERS ===\n')

for (const wsId of workspaces) {
  console.log(`\nWorkspace: ${wsId}`)

  // Get workspace name
  const { data: ws } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', wsId)
    .single()

  const wsName = ws ? ws.name : 'Unknown'
  console.log(`Name: ${wsName}`)

  // Get ALL members (not just owner)
  const { data: allMembers, error } = await supabase
    .from('workspace_members')
    .select('user_id, role, users(email, full_name)')
    .eq('workspace_id', wsId)

  if (error) {
    console.error('Error:', error)
  } else if (!allMembers || allMembers.length === 0) {
    console.log('❌ NO MEMBERS FOUND AT ALL!')
  } else {
    console.log(`Members found: ${allMembers.length}`)
    allMembers.forEach(member => {
      const fullName = member.users ? member.users.full_name : null
      const email = member.users ? member.users.email : null
      console.log(`  - ${member.role}: ${fullName || 'Unknown'} (${email})`)
    })
  }
}

// Check if there's a workspaces table with user_id
console.log('\n\n=== CHECKING WORKSPACES TABLE FOR OWNER ===\n')
for (const wsId of workspaces) {
  const { data: ws } = await supabase
    .from('workspaces')
    .select('id, name, user_id, created_by')
    .eq('id', wsId)
    .single()

  const wsName = ws ? ws.name : wsId
  console.log(`\nWorkspace: ${wsName}`)
  const userId = ws ? ws.user_id : null
  const createdBy = ws ? ws.created_by : null
  console.log(`User ID: ${userId || 'N/A'}`)
  console.log(`Created By: ${createdBy || 'N/A'}`)

  if (userId) {
    const { data: user } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', userId)
      .single()

    if (user) {
      const userFullName = user.full_name || 'Unknown'
      console.log(`Owner: ${userFullName} (${user.email})`)
    }
  }
}
