/**
 * Check Existing Database Tables
 * Find correct table names for workspace/user relationships
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkExistingTables() {
  console.log('🔍 **Checking existing workspace and user table names...**')
  console.log('')

  try {
    // Try different possible table names
    const tableChecks = [
      'workspace_users', 
      'workspace_members', 
      'workspaces_users',
      'workspace_user_roles',
      'user_workspaces',
      'workspaces',
      'users',
      'profiles'
    ]
    
    const existingTables = []
    
    for (const tableName of tableChecks) {
      const { data, error } = await supabase.from(tableName).select('*').limit(1)
      if (!error) {
        console.log(`✅ Table '${tableName}' exists`)
        existingTables.push(tableName)
      } else {
        console.log(`❌ Table '${tableName}' does not exist`)
      }
    }
    
    console.log('')
    console.log('📋 **EXISTING TABLES FOUND:**')
    existingTables.forEach(table => console.log(`   • ${table}`))
    console.log('')
    
    // Get sample data from workspaces table if it exists
    if (existingTables.includes('workspaces')) {
      console.log('📍 **WORKSPACES TABLE SAMPLE:**')
      const { data: workspaces, error: wsError } = await supabase
        .from('workspaces')
        .select('*')
        .limit(3)
      
      if (!wsError && workspaces?.length > 0) {
        console.log('   Sample workspace:', workspaces[0])
      } else {
        console.log('   No workspace data or error:', wsError?.message)
      }
      console.log('')
    }
    
    console.log('🎯 **ANALYSIS:**')
    if (!existingTables.includes('workspace_users') && !existingTables.includes('workspace_members')) {
      console.log('   ❌ No workspace-user relationship table found')
      console.log('   💡 Need to create workspace membership table OR modify RLS policies')
      console.log('')
      console.log('🔧 **SUGGESTED FIXES:**')
      console.log('   1. Create workspace_users/workspace_members table')
      console.log('   2. OR modify RLS policies to use different table structure')
      console.log('   3. OR remove RLS temporarily for testing')
    } else {
      console.log('   ✅ Workspace-user relationship table exists')
    }
    
  } catch (error) {
    console.error('❌ Error checking tables:', error.message)
  }
}

// Execute
checkExistingTables()