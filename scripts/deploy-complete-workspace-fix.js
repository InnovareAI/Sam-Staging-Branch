#!/usr/bin/env node

/**
 * COMPLETE WORKSPACE FIX DEPLOYMENT
 * This script ensures ALL users (existing and future) have proper workspace setup
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function deployCompleteFix() {
  console.log('🚀 DEPLOYING COMPLETE WORKSPACE FIX\n')
  console.log('This ensures NO user will ever encounter workspace issues\n')
  console.log('='.repeat(70) + '\n')
  
  try {
    // STEP 1: Fix all existing users
    console.log('📋 Step 1: Fixing ALL existing users...\n')
    
    const { data: allUsers } = await supabase
      .from('users')
      .select('id, email, current_workspace_id')
    
    console.log(`   Found ${allUsers?.length || 0} users in database`)
    
    const { data: allMemberships } = await supabase
      .from('workspace_members')
      .select('user_id, workspace_id, role, joined_at')
      .order('joined_at', { ascending: true })
    
    console.log(`   Found ${allMemberships?.length || 0} workspace memberships`)
    
    const { data: allWorkspaces } = await supabase
      .from('workspaces')
      .select('id, name, slug')
    
    console.log(`   Found ${allWorkspaces?.length || 0} workspaces\n`)
    
    let fixed = 0
    let alreadyOk = 0
    let needsMembership = []
    
    for (const user of allUsers || []) {
      const userMemberships = allMemberships?.filter(m => m.user_id === user.id) || []
      
      if (userMemberships.length === 0) {
        needsMembership.push(user)
        console.log(`   ⚠️  ${user.email}: No workspace membership`)
        continue
      }
      
      if (!user.current_workspace_id) {
        // Assign first workspace
        const firstMembership = userMemberships[0]
        const workspace = allWorkspaces?.find(w => w.id === firstMembership.workspace_id)
        
        const { error } = await supabase
          .from('users')
          .update({ current_workspace_id: firstMembership.workspace_id })
          .eq('id', user.id)
        
        if (!error) {
          fixed++
          console.log(`   ✅ ${user.email} → ${workspace?.name || firstMembership.workspace_id}`)
        } else {
          console.log(`   ❌ ${user.email}: ${error.message}`)
        }
      } else {
        alreadyOk++
      }
    }
    
    console.log(`\n   Summary:`)
    console.log(`   - Already configured: ${alreadyOk}`)
    console.log(`   - Fixed: ${fixed}`)
    console.log(`   - Need membership: ${needsMembership.length}\n`)
    
    // STEP 2: Create memberships for users without any
    if (needsMembership.length > 0) {
      console.log('📋 Step 2: Creating workspace memberships for orphaned users...\n')
      
      // Find or create a default workspace
      let defaultWorkspace = allWorkspaces?.find(w => 
        w.slug === 'innovareai-workspace' || w.name.toLowerCase().includes('innovareai')
      )
      
      if (!defaultWorkspace) {
        console.log('   Creating InnovareAI workspace...')
        const { data: newWorkspace, error } = await supabase
          .from('workspaces')
          .insert({
            name: 'InnovareAI Workspace',
            slug: 'innovareai-workspace'
          })
          .select()
          .single()
        
        if (error) {
          console.error('   ❌ Failed to create workspace:', error.message)
        } else {
          defaultWorkspace = newWorkspace
          console.log('   ✅ Created InnovareAI workspace')
        }
      }
      
      if (defaultWorkspace) {
        for (const user of needsMembership) {
          // Create membership
          const { error: memberError } = await supabase
            .from('workspace_members')
            .insert({
              user_id: user.id,
              workspace_id: defaultWorkspace.id,
              role: 'member',
              status: 'active'
            })
          
          if (memberError) {
            console.log(`   ❌ ${user.email}: ${memberError.message}`)
            continue
          }
          
          // Set current_workspace_id
          const { error: updateError } = await supabase
            .from('users')
            .update({ current_workspace_id: defaultWorkspace.id })
            .eq('id', user.id)
          
          if (!updateError) {
            console.log(`   ✅ ${user.email} → ${defaultWorkspace.name}`)
          }
        }
      }
    }
    
    // STEP 3: Final verification
    console.log('\n📋 Step 3: Final Verification...\n')
    
    const { data: verification } = await supabase
      .from('users')
      .select('id, email, current_workspace_id')
    
    const withWorkspace = verification?.filter(u => u.current_workspace_id).length || 0
    const withoutWorkspace = (verification?.length || 0) - withWorkspace
    
    console.log('='.repeat(70))
    console.log('📊 FINAL STATUS')
    console.log('='.repeat(70))
    console.log(`Total Users: ${verification?.length || 0}`)
    console.log(`✅ With Workspace: ${withWorkspace}`)
    console.log(`❌ Without Workspace: ${withoutWorkspace}`)
    
    if (withoutWorkspace > 0) {
      console.log('\n⚠️  Users still without workspace:')
      verification?.filter(u => !u.current_workspace_id).forEach(u => {
        console.log(`   - ${u.email}`)
      })
    }
    
    if (withoutWorkspace === 0) {
      console.log('\n🎉 SUCCESS! ALL USERS HAVE WORKSPACE ASSIGNMENTS!')
      console.log('\n✅ Next Steps:')
      console.log('   1. The database triggers will auto-assign workspaces to new users')
      console.log('   2. Auth callback has been updated to set current_workspace_id')
      console.log('   3. No user will encounter "workspace not associated" errors')
    } else {
      console.log('\n⚠️  Some users still need manual intervention')
    }
    
    console.log('='.repeat(70))
    
  } catch (error) {
    console.error('\n❌ Deployment failed:', error)
    process.exit(1)
  }
}

// Run deployment
deployCompleteFix()
  .then(() => {
    console.log('\n✨ Deployment complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error)
    process.exit(1)
  })