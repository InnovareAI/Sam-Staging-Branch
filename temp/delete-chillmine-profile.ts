import { createClient } from '@supabase/supabase-js'

async function deleteChillmineProfile() {
  console.log('🗑️  Deleting orphaned tl@chillmine.io profile...\n')

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'tl@chillmine.io')
    .single()

  if (!profile) {
    console.log('✅ Profile already deleted')
    return
  }

  console.log(`Found profile:`)
  console.log(`   User ID: ${profile.id}`)
  console.log(`   Email: ${profile.email}`)
  console.log(`   Current Workspace: ${profile.current_workspace_id}\n`)

  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', profile.id)

  if (error) {
    console.error('❌ Error deleting profile:', error)
  } else {
    console.log('✅ Profile deleted successfully')
  }
}

deleteChillmineProfile().catch(console.error)
