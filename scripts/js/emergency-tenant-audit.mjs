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

async function main() {
  console.log('🚨 EMERGENCY TENANT AUDIT\n')
  console.log('=' .repeat(80))

  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('*')
    .order('created_at', { ascending: false })

  const issues = []

  for (const ws of workspaces) {
    console.log(`\n🏢 ${ws.name} (${ws.tenant})`)
    
    // Check members
    const { data: members } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', ws.id)

    const owners = members?.filter(m => m.role === 'owner').length || 0
    const admins = members?.filter(m => m.role === 'admin').length || 0
    const total = members?.length || 0

    console.log(`   👥 Members: ${total} (${owners} owners, ${admins} admins)`)
    
    if (owners === 0 && admins === 0) {
      issues.push({
        workspace: ws.name,
        issue: 'NO OWNERS OR ADMINS',
        severity: 'CRITICAL',
        fix: 'Promote a member to owner'
      })
      console.log('   🔴 CRITICAL: NO OWNERS OR ADMINS')
    }

    // Check LinkedIn
    const { data: linkedin } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', ws.id)
      .eq('account_type', 'linkedin')

    const hasLinkedIn = linkedin && linkedin.length > 0
    const activeLinkedIn = linkedin?.some(a => a.is_active)

    console.log(`   🔗 LinkedIn: ${hasLinkedIn ? '✅' : '❌'} ${hasLinkedIn && !activeLinkedIn ? '(INACTIVE)' : ''}`)
    
    if (hasLinkedIn && !activeLinkedIn) {
      issues.push({
        workspace: ws.name,
        issue: 'LinkedIn account connected but INACTIVE',
        severity: 'HIGH',
        fix: 'Reconnect LinkedIn account'
      })
      console.log('   ⚠️  LinkedIn connected but NOT ACTIVE')
    }

    // Check KB
    const { data: kb } = await supabase
      .from('knowledge_base')
      .select('id')
      .eq('workspace_id', ws.id)
      .eq('is_active', true)

    const kbCount = kb?.length || 0
    console.log(`   📚 KB Docs: ${kbCount}`)

    // Check campaigns
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id, status')
      .eq('workspace_id', ws.id)

    const activeCampaigns = campaigns?.filter(c => c.status === 'active').length || 0
    console.log(`   📢 Active Campaigns: ${activeCampaigns}`)

    // Check prospects
    const { data: prospects } = await supabase
      .from('campaign_prospects')
      .select('id, campaigns!inner(workspace_id)')
      .eq('campaigns.workspace_id', ws.id)

    console.log(`   👥 Prospects: ${prospects?.length || 0}`)
  }

  console.log('\n' + '='.repeat(80))
  console.log(`\n🚨 CRITICAL ISSUES FOUND: ${issues.length}\n`)

  if (issues.length > 0) {
    issues.forEach((issue, i) => {
      console.log(`${i + 1}. ${issue.workspace}`)
      console.log(`   Issue: ${issue.issue}`)
      console.log(`   Severity: ${issue.severity}`)
      console.log(`   Fix: ${issue.fix}`)
      console.log('')
    })
  } else {
    console.log('✅ No critical issues found')
  }
}

main().catch(console.error)
