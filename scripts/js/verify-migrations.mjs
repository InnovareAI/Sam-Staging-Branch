#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '../../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('🔍 Verifying Security & Workspace Migrations\n')
console.log('=' .repeat(80))

// 1. Check encryption keys
console.log('\n📦 1. Encryption Keys')
const { data: encKeys, error: encError } = await supabase
  .from('workspace_encryption_keys')
  .select('workspace_id, created_at')
  .limit(5)

if (encError) {
  console.log(`   ❌ Error: ${encError.message}`)
} else {
  console.log(`   ✅ Table exists: ${encKeys.length} keys found`)
  if (encKeys.length > 0) {
    console.log(`   📝 Sample: ${encKeys[0].workspace_id} (created: ${encKeys[0].created_at})`)
  }
}

// 2. Check GDPR tables
console.log('\n🔐 2. GDPR Compliance')

const { data: gdprRequests, error: gdprError } = await supabase
  .from('gdpr_deletion_requests')
  .select('id')
  .limit(1)

if (gdprError) {
  console.log(`   ❌ Error: ${gdprError.message}`)
} else {
  console.log(`   ✅ gdpr_deletion_requests table exists`)
}

const { data: retentionPolicies, error: policyError } = await supabase
  .from('data_retention_policies')
  .select('id')
  .limit(1)

if (policyError) {
  console.log(`   ❌ Error: ${policyError.message}`)
} else {
  console.log(`   ✅ data_retention_policies table exists`)
}

// 3. Check workspace types
console.log('\n🏢 3. Workspace Types')
const { data: workspaces, error: wsError } = await supabase
  .from('workspaces')
  .select('id, name, workspace_type, owner_id')
  .limit(10)

if (wsError) {
  console.log(`   ❌ Error: ${wsError.message}`)
} else {
  console.log(`   ✅ owner_id and workspace_type columns added`)

  const typeCount = workspaces.reduce((acc, ws) => {
    acc[ws.workspace_type || 'null'] = (acc[ws.workspace_type || 'null'] || 0) + 1
    return acc
  }, {})

  console.log(`   📊 Types:`, typeCount)

  if (workspaces.length > 0) {
    console.log(`\n   Sample workspaces:`)
    workspaces.slice(0, 3).forEach(ws => {
      console.log(`   - ${ws.name} (${ws.workspace_type || 'null'}) - Owner: ${ws.owner_id || 'null'}`)
    })
  }
}

// 4. Check team member roles
console.log('\n👥 4. Team Member Roles')
const { data: members, error: memberError } = await supabase
  .from('workspace_members')
  .select('role, can_connect_accounts')
  .limit(5)

if (memberError) {
  console.log(`   ❌ Error: ${memberError.message}`)
} else {
  console.log(`   ✅ can_connect_accounts column added`)

  const roleCount = members.reduce((acc, m) => {
    const key = `${m.role} (can_connect: ${m.can_connect_accounts})`
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  console.log(`   📊 Role distribution:`, roleCount)
}

// 5. Check workspace utilities
console.log('\n🔧 5. Workspace Utilities')

// Test identify_workspace function
const { data: identified, error: identifyError } = await supabase
  .rpc('identify_workspace', { p_identifier: 'innovare' })

if (identifyError) {
  console.log(`   ❌ identify_workspace function error: ${identifyError.message}`)
} else {
  console.log(`   ✅ identify_workspace function works`)
  if (identified && identified.length > 0) {
    console.log(`   📝 Found: ${identified[0].workspace_name} (${identified[0].workspace_type})`)
  }
}

// Test workspace_directory view
const { data: directory, error: dirError } = await supabase
  .from('workspace_directory')
  .select('workspace_name, owner_email, workspace_type')
  .limit(3)

if (dirError) {
  console.log(`   ❌ workspace_directory view error: ${dirError.message}`)
} else {
  console.log(`   ✅ workspace_directory view works`)
  console.log(`   📊 Sample entries:`)
  directory.forEach(d => {
    console.log(`   - ${d.workspace_name} (${d.workspace_type}) - ${d.owner_email}`)
  })
}

// 6. Check prospect validation
console.log('\n✅ 6. Data Validation')
const { data: prospects, error: prospectError } = await supabase
  .from('workspace_prospects')
  .select('id, linkedin_url, data_quality_score')
  .limit(3)

if (prospectError) {
  console.log(`   ❌ Error: ${prospectError.message}`)
} else {
  console.log(`   ✅ data_quality_score column exists`)
  if (prospects && prospects.length > 0) {
    const avgScore = prospects
      .filter(p => p.data_quality_score)
      .reduce((sum, p) => sum + p.data_quality_score, 0) / prospects.length
    console.log(`   📊 Average quality score: ${avgScore.toFixed(1)}/100`)
  }
}

console.log('\n' + '=' .repeat(80))
console.log('\n🎉 Migration Verification Complete!\n')
console.log('📚 Next Steps:')
console.log('   1. Review GDPR workflow in docs/')
console.log('   2. Test encryption/decryption in workspace_prospects')
console.log('   3. Configure team member roles for existing workspaces')
console.log('   4. Set up daily cron job for GDPR cleanup')
console.log('')
