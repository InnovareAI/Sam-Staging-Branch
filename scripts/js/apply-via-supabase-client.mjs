#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const migrations = [
  '20251031000001_add_pii_encryption.sql',
  '20251031000002_add_gdpr_compliance.sql',
  '20251031000003_add_linkedin_url_validation.sql',
  '20251031000004_convert_to_single_user_workspaces.sql',
  '20251031000005_add_team_member_roles.sql',
  '20251031000006_workspace_split_utilities.sql'
]

for (const file of migrations) {
  console.log(`▶ ${file}`)
  const sql = readFileSync(`supabase/migrations/${file}`, 'utf8')

  // Split by statement and execute
  const statements = sql.split(/;\s*$/gm).filter(s => s.trim())

  for (const stmt of statements) {
    if (!stmt.trim() || stmt.trim().startsWith('--')) continue
    try {
      const { error } = await supabase.rpc('exec', { sql: stmt })
      if (error) throw error
    } catch (e) {
      console.error(`  ❌ ${e.message}`)
    }
  }
  console.log(`  ✅`)
}
