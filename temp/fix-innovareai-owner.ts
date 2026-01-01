import { createClient } from '@supabase/supabase-js'

async function fixInnovareAIOwner() {
  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
  const tlUserId = 'f6885ff3-deef-4781-8721-93011c990b1b'

  console.log('🔧 Fixing InnovareAI Workspace ownership...\n')

  // 1. Get all current members
  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id, role, status, joined_at')
    .eq('workspace_id', workspaceId)

  console.log(`Current members: ${members?.length || 0}\n`)

  // Get user details
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const userMap = new Map(authUsers.users.map(u => [u.id, u]))

  const { data: userProfiles } = await supabase
    .from('users')
    .select('id, email')
  const profileMap = new Map(userProfiles?.map(p => [p.id, p]) || [])

  // Find the unknown owner
  const unknownOwner = members?.find(m => m.role === 'owner')

  if (unknownOwner) {
    const authUser = userMap.get(unknownOwner.user_id)
    const profile = profileMap.get(unknownOwner.user_id)
    const email = authUser?.email || profile?.email || 'Unknown'

    console.log('❌ Current owner:')
    console.log(`   User ID: ${unknownOwner.user_id}`)
    console.log(`   Email: ${email}`)
    console.log(`   Status: ${unknownOwner.status}`)

    if (email === 'Unknown' || !authUser) {
      console.log('\n⚠️  This is an invalid owner (no auth user found)')
      console.log('   Deleting this membership...')

      const { error: deleteError } = await supabase
        .from('workspace_members')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('user_id', unknownOwner.user_id)

      if (deleteError) {
        console.error('❌ Error deleting:', deleteError)
        return
      }

      console.log('   ✅ Deleted invalid owner membership\n')
    } else if (unknownOwner.user_id !== tlUserId) {
      console.log(`\n⚠️  Owner is ${email}, but should be tl@innovareai.com`)
      console.log('   Changing their role to admin...')

      const { error: updateError } = await supabase
        .from('workspace_members')
        .update({ role: 'admin' })
        .eq('workspace_id', workspaceId)
        .eq('user_id', unknownOwner.user_id)

      if (updateError) {
        console.error('❌ Error updating role:', updateError)
        return
      }

      console.log('   ✅ Changed to admin\n')
    }
  } else {
    console.log('ℹ️  No existing owner found\n')
  }

  // 2. Check if tl@innovareai.com is already a member
  const tlMember = members?.find(m => m.user_id === tlUserId)

  if (tlMember) {
    console.log('✅ tl@innovareai.com is already a member')
    console.log(`   Current role: ${tlMember.role}`)

    if (tlMember.role !== 'owner') {
      console.log('\n   Updating to owner...')

      const { error: updateError } = await supabase
        .from('workspace_members')
        .update({ role: 'owner' })
        .eq('workspace_id', workspaceId)
        .eq('user_id', tlUserId)

      if (updateError) {
        console.error('❌ Error updating to owner:', updateError)
        return
      }

      console.log('   ✅ Updated tl@innovareai.com to owner')
    } else {
      console.log('   ✅ Already owner - no change needed')
    }
  } else {
    console.log('❌ tl@innovareai.com is not a member of InnovareAI Workspace')
    console.log('   Adding as owner...')

    const { error: insertError } = await supabase
      .from('workspace_members')
      .insert({
        user_id: tlUserId,
        workspace_id: workspaceId,
        role: 'owner',
        status: 'active',
        joined_at: new Date().toISOString()
      })

    if (insertError) {
      console.error('❌ Error adding member:', insertError)
      return
    }

    console.log('   ✅ Added tl@innovareai.com as owner')
  }

  console.log('\n✅ Ownership fix complete!')
  console.log('   InnovareAI Workspace owner: tl@innovareai.com')
}

fixInnovareAIOwner().catch(console.error)
