import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function deleteTestAccounts() {
  const accountsToDelete = [
    'tl+2@chillmine.io',
    'test@innovareai.com',
    'innovareatl+14@innovareai.com'
  ]

  console.log('🗑️  Deleting test accounts...\n')

  // Get all users first
  const { data: authUsers } = await supabase.auth.admin.listUsers()

  for (const email of accountsToDelete) {
    const user = authUsers.users.find(u => u.email === email)

    if (!user) {
      console.log(`❌ ${email} - Not found`)
      continue
    }

    console.log(`Deleting ${email} (${user.id})...`)

    // Delete from auth.users (cascades to related tables)
    const { error } = await supabase.auth.admin.deleteUser(user.id)

    if (error) {
      console.error(`  ❌ Failed: ${error.message}`)
    } else {
      console.log(`  ✅ Deleted successfully`)
    }
  }

  console.log('\n✅ Test account cleanup complete!')
}

deleteTestAccounts().catch(console.error)
