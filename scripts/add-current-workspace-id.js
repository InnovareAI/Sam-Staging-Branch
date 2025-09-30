import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function runMigration() {
  console.log('🔧 Adding current_workspace_id column to users table...\n')
  
  try {
    // Step 1: Add the column
    console.log('Step 1: Adding current_workspace_id column...')
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS current_workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;'
    }).catch(async () => {
      // Fallback: use raw SQL via pg
      const { Client } = await import('pg')
      const client = new Client({
        connectionString: process.env.DATABASE_URL
      })
      await client.connect()
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS current_workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;')
      await client.end()
      return { error: null }
    })
    
    if (alterError) throw alterError
    console.log('✅ Column added\n')
    
    // Step 2: Create index
    console.log('Step 2: Creating index...')
    await supabase.rpc('exec_sql', {
      sql: 'CREATE INDEX IF NOT EXISTS idx_users_current_workspace_id ON users(current_workspace_id);'
    }).catch(async () => {
      const { Client } = await import('pg')
      const client = new Client({
        connectionString: process.env.DATABASE_URL
      })
      await client.connect()
      await client.query('CREATE INDEX IF NOT EXISTS idx_users_current_workspace_id ON users(current_workspace_id);')
      await client.end()
    })
    console.log('✅ Index created\n')
    
    // Step 3: Update existing users
    console.log('Step 3: Setting current_workspace_id for existing users...')
    
    const { data: users } = await supabase
      .from('users')
      .select('id, email')
    
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('user_id, workspace_id')
      .order('created_at', { ascending: true })
    
    let updated = 0
    for (const user of users || []) {
      const userMembership = memberships?.find(m => m.user_id === user.id)
      if (userMembership) {
        const { error: updateError } = await supabase
          .from('users')
          .update({ current_workspace_id: userMembership.workspace_id })
          .eq('id', user.id)
        
        if (!updateError) {
          updated++
          console.log(`  ✅ Set workspace for ${user.email}`)
        }
      }
    }
    
    console.log(`\n✅ Updated ${updated} users\n`)
    
    // Step 4: Verify
    console.log('Step 4: Verifying results...')
    const { data: verification } = await supabase
      .from('users')
      .select('id, email, current_workspace_id')
    
    const withWorkspace = verification?.filter(u => u.current_workspace_id).length || 0
    const withoutWorkspace = (verification?.length || 0) - withWorkspace
    
    console.log(`\n📊 Final Status:`)
    console.log(`  Total users: ${verification?.length || 0}`)
    console.log(`  Users with workspace: ${withWorkspace}`)
    console.log(`  Users without workspace: ${withoutWorkspace}`)
    
    console.log('\n✅ Migration complete!')
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  }
}

runMigration()
