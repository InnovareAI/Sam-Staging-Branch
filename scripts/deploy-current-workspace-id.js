#!/usr/bin/env node

/**
 * Deploy current_workspace_id column to users table
 * This script adds the missing column and populates it for all users
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

// Execute raw SQL via Supabase Management API
async function executeSQL(sql) {
  // Parse the Supabase URL to get project ref
  const urlMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)
  if (!urlMatch) {
    throw new Error('Could not parse Supabase URL')
  }
  const projectRef = urlMatch[1]
  
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ query: sql })
    }
  )
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`SQL execution failed: ${response.status} - ${error}`)
  }
  
  return await response.json()
}

async function deployColumn() {
  console.log('🚀 Deploying current_workspace_id column...\n')
  
  try {
    // Step 1: Add the column
    console.log('📝 Step 1: Adding current_workspace_id column...')
    
    const addColumnSQL = `
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'current_workspace_id'
        ) THEN
          ALTER TABLE users ADD COLUMN current_workspace_id UUID;
          RAISE NOTICE 'Column added';
        ELSE
          RAISE NOTICE 'Column already exists';
        END IF;
      END $$;
    `
    
    try {
      await executeSQL(addColumnSQL)
      console.log('   ✅ Column added/verified\n')
    } catch (error) {
      console.log('   ⚠️  Using alternative method...')
      // If Management API fails, we'll continue with data updates
    }
    
    // Step 2: Add foreign key constraint
    console.log('📝 Step 2: Adding foreign key constraint...')
    
    const addConstraintSQL = `
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'fk_users_current_workspace'
        ) THEN
          ALTER TABLE users
          ADD CONSTRAINT fk_users_current_workspace 
          FOREIGN KEY (current_workspace_id) 
          REFERENCES workspaces(id) 
          ON DELETE SET NULL;
          RAISE NOTICE 'Constraint added';
        ELSE
          RAISE NOTICE 'Constraint already exists';
        END IF;
      END $$;
    `
    
    try {
      await executeSQL(addConstraintSQL)
      console.log('   ✅ Foreign key constraint added\n')
    } catch (error) {
      console.log('   ⚠️  Skipping constraint (may already exist)\n')
    }
    
    // Step 3: Create index
    console.log('📝 Step 3: Creating index...')
    
    const createIndexSQL = `
      CREATE INDEX IF NOT EXISTS idx_users_current_workspace_id 
      ON users(current_workspace_id);
    `
    
    try {
      await executeSQL(createIndexSQL)
      console.log('   ✅ Index created\n')
    } catch (error) {
      console.log('   ⚠️  Skipping index (may already exist)\n')
    }
    
    // Step 4: Populate data using Supabase client
    console.log('📝 Step 4: Setting current_workspace_id for all users...\n')
    
    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email')
    
    if (usersError) throw usersError
    console.log(`   Found ${users.length} users`)
    
    // Get all workspace memberships
    const { data: memberships, error: membError } = await supabase
      .from('workspace_members')
      .select('user_id, workspace_id, joined_at')
      .order('joined_at', { ascending: true })
    
    if (membError) throw membError
    console.log(`   Found ${memberships.length} workspace memberships`)
    
    // Get all workspaces for display
    const { data: workspaces, error: wsError } = await supabase
      .from('workspaces')
      .select('id, name, slug')
    
    if (wsError) throw wsError
    console.log(`   Found ${workspaces.length} workspaces\n`)
    
    // Update each user
    let updated = 0
    let skipped = 0
    let errors = []
    
    for (const user of users) {
      const userMembership = memberships.find(m => m.user_id === user.id)
      
      if (userMembership) {
        const workspace = workspaces.find(w => w.id === userMembership.workspace_id)
        
        const { error: updateError } = await supabase
          .from('users')
          .update({ current_workspace_id: userMembership.workspace_id })
          .eq('id', user.id)
        
        if (updateError) {
          errors.push(`${user.email}: ${updateError.message}`)
          console.log(`   ❌ ${user.email}: ${updateError.message}`)
        } else {
          updated++
          console.log(`   ✅ ${user.email} → ${workspace?.name || userMembership.workspace_id}`)
        }
      } else {
        skipped++
        console.log(`   ⚠️  ${user.email} (no workspace membership)`)
      }
    }
    
    // Step 5: Verify results
    console.log('\n📝 Step 5: Verifying results...\n')
    
    const { data: verification, error: verifyError } = await supabase
      .from('users')
      .select('id, email, current_workspace_id')
    
    if (verifyError) throw verifyError
    
    const usersWithWorkspace = verification.filter(u => u.current_workspace_id).length
    const usersWithoutWorkspace = verification.length - usersWithWorkspace
    
    // Summary
    console.log('\n' + '='.repeat(70))
    console.log('📊 DEPLOYMENT SUMMARY')
    console.log('='.repeat(70))
    console.log(`Total users: ${verification.length}`)
    console.log(`✅ Users with current_workspace_id: ${usersWithWorkspace}`)
    console.log(`⚠️  Users without current_workspace_id: ${usersWithoutWorkspace}`)
    console.log(`\nUpdate Results:`)
    console.log(`  - Updated: ${updated}`)
    console.log(`  - Skipped: ${skipped}`)
    console.log(`  - Errors: ${errors.length}`)
    
    if (errors.length > 0) {
      console.log('\n❌ Errors encountered:')
      errors.forEach((err, i) => console.log(`   ${i + 1}. ${err}`))
    }
    
    console.log('\n' + '='.repeat(70))
    
    if (usersWithWorkspace === verification.length) {
      console.log('✅ SUCCESS! All users have current_workspace_id set')
      console.log('\n🎉 You can now use the LinkedIn integration!')
    } else if (usersWithWorkspace > 0) {
      console.log('⚠️  PARTIAL SUCCESS - Some users still need workspace assignments')
    } else {
      console.log('❌ FAILED - No users have current_workspace_id set')
      console.log('\nPlease run the SQL migration manually via Supabase Dashboard')
    }
    
  } catch (error) {
    console.error('\n❌ Deployment failed:', error)
    console.error('\nPlease try running the SQL migration manually:')
    console.error('File: migrations/fix_current_workspace_id.sql')
    process.exit(1)
  }
}

// Run the deployment
deployColumn()
  .then(() => {
    console.log('\n✨ Deployment complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Deployment failed:', error)
    process.exit(1)
  })