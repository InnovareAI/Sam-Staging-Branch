import { createClient } from '@supabase/supabase-js'

async function deleteAbandonedAccounts() {
  const accountsToDelete = [
    { email: 'magerery@gmail.com', id: 'f0296ec8-d6dd-403d-97f5-d9c6e855e4de' },
    { email: 'bwalowitz@gmail.com', id: '71c1c7f5-6c9c-4b7a-bab8-1f55772b8a99' },
    { email: 'walbro1981@gmail.com', id: '0bc310f1-ef8a-472c-be11-997da00e58eb' }
  ]

  console.log('🗑️  Deleting abandoned accounts...\n')

  for (const account of accountsToDelete) {
    console.log(`Deleting ${account.email} (${account.id})...`)

    // Delete from auth.users (this cascades to related tables)
    const { error } = await supabase.auth.admin.deleteUser(account.id)

    if (error) {
      console.error(`  ❌ Failed: ${error.message}`)
    } else {
      console.log(`  ✅ Deleted successfully`)
    }
  }

  console.log('\n✅ Cleanup complete!')
}

deleteAbandonedAccounts().catch(console.error)
