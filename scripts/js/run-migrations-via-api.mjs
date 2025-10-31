#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import dotenv from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '../../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'public' } }
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
  console.log(`\n▶ ${file}`)
  const sql = readFileSync(join(__dirname, '../../supabase/migrations', file), 'utf8')

  try {
    // Execute raw SQL using Supabase management API
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: sql })
    })

    if (!response.ok) {
      const text = await response.text()
      console.log(`  ❌ ${text}`)
    } else {
      console.log(`  ✅`)
    }
  } catch (e) {
    console.error(`  ❌ ${e.message}`)
  }
}
