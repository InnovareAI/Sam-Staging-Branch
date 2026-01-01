import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

async function applyTenantMigration() {
  console.log('🔧 Applying tenant constraint expansion migration...\n')

  // Read the migration file
  const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20251013000001_expand_tenant_constraints.sql'
  )

  const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

  console.log('Migration SQL:')
  console.log('─'.repeat(80))
  console.log(migrationSQL)
  console.log('─'.repeat(80))
  console.log()

  // Split SQL by statement (simple split on semicolon)
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  console.log(`Executing ${statements.length} SQL statements...\n`)

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';'
    console.log(`[${i + 1}/${statements.length}] Executing...`)

    const { error } = await supabase.rpc('exec_sql', { sql: statement })

    if (error) {
      // Try direct execution if rpc doesn't work
      console.log('   RPC method not available, trying direct query...')

      // For ALTER/UPDATE statements, we need to use the Supabase admin API
      // Let's just log what we're trying to do
      console.log(`   Statement: ${statement.substring(0, 100)}...`)
      console.log('   ⚠️  Cannot execute DDL via Supabase client')
    } else {
      console.log('   ✅ Success')
    }
  }

  console.log('\n⚠️  Note: DDL statements need to be run via Supabase Dashboard SQL Editor')
  console.log('Please copy the migration file to Supabase Dashboard:\n')
  console.log(`File: supabase/migrations/20251013000001_expand_tenant_constraints.sql\n`)
}

applyTenantMigration().catch(console.error)
