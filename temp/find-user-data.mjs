import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
)

const workspaces = [
  'cd57981a-e63b-401c-bde1-ac71752c2293', // Jennifer Fleming
  '7f0341da-88db-476b-ae0a-fc0da5b70861', // Charissa Saniel
  '96c03b38-a2f4-40de-9e16-43098599e1d4'  // Irish Maguad
]

console.log('=== FINDING USER DATA ===\n')

// 1. Check workspace_members table structure
console.log('1. WORKSPACE_MEMBERS TABLE (first row):')
const { data: memberSample } = await supabase
  .from('workspace_members')
  .select('*')
  .limit(1)

if (memberSample && memberSample.length > 0) {
  console.log('Columns:', Object.keys(memberSample[0]).join(', '))
} else {
  console.log('NO ROWS IN TABLE')
}

// 2. Check workspaces table for user_id or owner info
console.log('\n2. WORKSPACES TABLE STRUCTURE:')
const { data: wsSample } = await supabase
  .from('workspaces')
  .select('*')
  .limit(1)

if (wsSample && wsSample.length > 0) {
  console.log('Columns:', Object.keys(wsSample[0]).join(', '))
}

// 3. Get full workspace records for our target workspaces
console.log('\n3. WORKSPACE RECORDS:')
for (const wsId of workspaces) {
  const { data: ws } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', wsId)
    .single()

  if (ws) {
    console.log(`\n${ws.name}:`)
    console.log(JSON.stringify(ws, null, 2))
  }
}

// 4. Check user_unipile_accounts for owner info
console.log('\n\n4. USER_UNIPILE_ACCOUNTS (might have user info):')
for (const wsId of workspaces) {
  const { data: accounts } = await supabase
    .from('user_unipile_accounts')
    .select('account_name, account_email, user_id')
    .eq('workspace_id', wsId)
    .limit(1)

  if (accounts && accounts.length > 0) {
    console.log(`\n${wsId}:`)
    console.log(JSON.stringify(accounts[0], null, 2))
  }
}

// 5. Check if there's a users table and get Jennifer, Charissa, Irish
console.log('\n\n5. CHECKING USERS TABLE:')
const names = ['Jennifer', 'Charissa', 'Irish']
for (const name of names) {
  const { data: users } = await supabase
    .from('users')
    .select('id, email, full_name')
    .ilike('full_name', `%${name}%`)

  if (users && users.length > 0) {
    console.log(`\n${name}:`)
    console.log(JSON.stringify(users, null, 2))
  }
}
