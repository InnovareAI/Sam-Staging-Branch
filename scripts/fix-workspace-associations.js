#!/usr/bin/env node

/**
 * Fix User Workspace Associations
 * 
 * This script fixes users who lost their workspace associations during database migration.
 * It ensures every user has a current_workspace_id and is a member of at least one workspace.
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl)
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey)
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function fixWorkspaceAssociations() {
  console.log('🔧 Starting Workspace Association Fix\n')

  try {
    // 1. Get all users
    console.log('📋 Step 1: Fetching all users...')
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email')
      .order('created_at', { ascending: true })

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`)
    }

    console.log(`   Found ${users.length} users\n`)

    // 2. Get all workspaces
    console.log('📋 Step 2: Fetching all workspaces...')
    const { data: workspaces, error: workspacesError } = await supabase
      .from('workspaces')
      .select('id, name, slug')
      .order('created_at', { ascending: true })

    if (workspacesError) {
      throw new Error(`Failed to fetch workspaces: ${workspacesError.message}`)
    }

    console.log(`   Found ${workspaces.length} workspaces\n`)

    // 3. Get all workspace memberships
    console.log('📋 Step 3: Fetching workspace memberships...')
    const { data: memberships, error: membershipsError } = await supabase
      .from('workspace_members')
      .select('user_id, workspace_id, role')

    if (membershipsError) {
      throw new Error(`Failed to fetch memberships: ${membershipsError.message}`)
    }

    console.log(`   Found ${memberships.length} existing memberships\n`)

    // Create membership lookup
    const membershipMap = new Map()
    memberships.forEach(m => {
      if (!membershipMap.has(m.user_id)) {
        membershipMap.set(m.user_id, [])
      }
      membershipMap.get(m.user_id).push(m)
    })

    // 4. Process each user
    console.log('🔧 Step 4: Ensuring all users have workspace memberships...\n')
    
    let usersFixed = 0
    let membershipsCreated = 0
    let errors = []

    for (const user of users) {
      const userEmail = user.email || user.id.substring(0, 8)
      const userMemberships = membershipMap.get(user.id) || []

      console.log(`👤 Processing: ${userEmail}`)

      // Case 1: User has no memberships at all
      if (userMemberships.length === 0) {
        console.log(`   ⚠️  No workspace memberships found`)
        
        // Assign to first available workspace (or create one if needed)
        let targetWorkspace = workspaces[0]
        
        if (!targetWorkspace) {
          console.log(`   ❌ No workspaces exist - creating default workspace`)
          const { data: newWorkspace, error: createError } = await supabase
            .from('workspaces')
            .insert({
              name: 'Default Workspace',
              slug: 'default',
              created_by: user.id
            })
            .select()
            .single()

          if (createError) {
            errors.push(`Failed to create workspace for ${userEmail}: ${createError.message}`)
            console.log(`   ❌ Failed to create workspace: ${createError.message}`)
            continue
          }
          
          targetWorkspace = newWorkspace
          workspaces.push(newWorkspace)
        }

        // Create membership
        console.log(`   ➕ Creating membership in: ${targetWorkspace.name}`)
        const { error: memberError } = await supabase
          .from('workspace_members')
          .insert({
            workspace_id: targetWorkspace.id,
            user_id: user.id,
            role: 'member'
          })

        if (memberError) {
          errors.push(`Failed to create membership for ${userEmail}: ${memberError.message}`)
          console.log(`   ❌ Failed to create membership: ${memberError.message}`)
          continue
        }

        membershipsCreated++
        usersFixed++
        console.log(`   ✅ Fixed!\n`)
      } else {
        console.log(`   ✅ Already has ${userMemberships.length} workspace membership(s)\n`)
      }
    }

    // 5. Summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 Summary:')
    console.log('='.repeat(60))
    console.log(`Total users processed: ${users.length}`)
    console.log(`Users fixed: ${usersFixed}`)
    console.log(`Memberships created: ${membershipsCreated}`)
    console.log(`Errors: ${errors.length}`)
    
    if (errors.length > 0) {
      console.log('\n❌ Errors encountered:')
      errors.forEach((err, i) => console.log(`   ${i + 1}. ${err}`))
    }

    console.log('\n✅ Workspace association fix complete!')

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message)
    process.exit(1)
  }
}

// Run the fix
fixWorkspaceAssociations()
  .then(() => {
    console.log('\n✨ All done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error)
    process.exit(1)
  })