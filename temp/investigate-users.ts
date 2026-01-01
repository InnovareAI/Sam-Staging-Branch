import { createClient } from '@supabase/supabase-js'

async function investigateUsers() {
  const suspiciousEmails = [
    'magerery@gmail.com',
    'bwalowitz@gmail.com',
    'walbro1981@gmail.com'
  ]

  console.log('🔍 Investigating suspicious user accounts...\n')

  for (const email of suspiciousEmails) {
    console.log('='.repeat(80))
    console.log(`📧 ${email}`)
    console.log('='.repeat(80))

    // Get auth user
    const { data: authUsers } = await supabase.auth.admin.listUsers()
    const authUser = authUsers.users.find(u => u.email === email)

    if (!authUser) {
      console.log('❌ Not found in auth.users')
      continue
    }

    console.log(`\n📋 Auth Details:`)
    console.log(`  ID: ${authUser.id}`)
    console.log(`  Created: ${authUser.created_at}`)
    console.log(`  Last sign in: ${authUser.last_sign_in_at || 'Never'}`)
    console.log(`  Email confirmed: ${authUser.email_confirmed_at ? 'Yes' : 'No'}`)
    console.log(`  Provider: ${authUser.app_metadata.provider || 'email'}`)
    console.log(`  Metadata: ${JSON.stringify(authUser.user_metadata, null, 2)}`)

    // Check users table
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (profile) {
      console.log(`\n👤 Profile:`)
      console.log(`  First name: ${profile.first_name || 'N/A'}`)
      console.log(`  Last name: ${profile.last_name || 'N/A'}`)
      console.log(`  Company: ${profile.company_name || 'N/A'}`)
      console.log(`  Current workspace: ${profile.current_workspace_id || 'Not set'}`)
      console.log(`  Created: ${profile.created_at}`)
    }

    // Check workspace memberships
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('workspace_id, role, status, created_at')
      .eq('user_id', authUser.id)

    console.log(`\n🏢 Workspace Memberships: ${memberships?.length || 0}`)
    memberships?.forEach(m => {
      console.log(`  - Workspace: ${m.workspace_id}`)
      console.log(`    Role: ${m.role}, Status: ${m.status}`)
      console.log(`    Joined: ${m.created_at}`)
    })

    // Check any activity
    const { data: threads } = await supabase
      .from('sam_conversation_threads')
      .select('id, title, created_at')
      .eq('user_id', authUser.id)
      .limit(5)

    console.log(`\n💬 Conversation Threads: ${threads?.length || 0}`)
    threads?.forEach(t => {
      console.log(`  - ${t.title || 'Untitled'} (${t.created_at})`)
    })

    // Check prospects
    const { data: prospects } = await supabase
      .from('workspace_prospects')
      .select('id, workspace_id, created_at')
      .eq('created_by', authUser.id)
      .limit(5)

    console.log(`\n👥 Prospects Created: ${prospects?.length || 0}`)

    // Check campaigns
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id, name, created_at')
      .eq('created_by', authUser.id)
      .limit(5)

    console.log(`\n📬 Campaigns Created: ${campaigns?.length || 0}`)

    console.log('\n')
  }
}

investigateUsers().catch(console.error)
