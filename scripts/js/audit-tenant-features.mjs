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
  console.log('🔍 Multi-Tenant Feature Audit\n')
  console.log('=' .repeat(80))

  // Get all workspaces
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('*')
    .order('created_at', { ascending: false })

  if (!workspaces) {
    console.error('❌ No workspaces found')
    return
  }

  console.log(`\nFound ${workspaces.length} workspaces\n`)

  // Find InnovareAI workspace
  const innovareAI = workspaces.find(w => w.tenant === 'innovareai' || w.name?.toLowerCase().includes('innovare'))
  
  if (!innovareAI) {
    console.error('❌ InnovareAI workspace not found!')
    return
  }

  console.log('📊 Reference Workspace: ' + innovareAI.name)
  console.log('   ID: ' + innovareAI.id)
  console.log('')

  // Audit each workspace against InnovareAI
  for (const workspace of workspaces) {
    console.log('\n' + '─'.repeat(80))
    console.log(`\n🏢 ${workspace.name}`)
    console.log(`   Tenant: ${workspace.tenant || 'none'}`)
    console.log(`   ID: ${workspace.id}`)

    // 1. LinkedIn Accounts
    const { data: accounts } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', workspace.id)
      .eq('account_type', 'linkedin')

    const hasLinkedIn = accounts && accounts.length > 0
    const activeLinkedIn = accounts?.some(a => a.is_active) || false
    
    console.log(`\n   🔗 LinkedIn: ${hasLinkedIn ? '✅' : '❌'} ${hasLinkedIn ? `(${accounts.length} account${accounts.length > 1 ? 's' : ''}, ${activeLinkedIn ? 'active' : 'inactive'})` : ''}`)

    // 2. Knowledge Base
    const { data: kb } = await supabase
      .from('knowledge_base')
      .select('id, section')
      .eq('workspace_id', workspace.id)

    const kbCount = kb?.length || 0
    const kbSections = kb ? [...new Set(kb.map(k => k.section))].filter(Boolean) : []
    
    console.log(`   📚 Knowledge Base: ${kbCount > 0 ? '✅' : '❌'} ${kbCount > 0 ? `(${kbCount} docs across ${kbSections.length} sections)` : ''}`)

    // 3. Campaigns
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('status, campaign_type')
      .eq('workspace_id', workspace.id)

    const campaignCount = campaigns?.length || 0
    const activeCampaigns = campaigns?.filter(c => c.status === 'active').length || 0
    
    console.log(`   📢 Campaigns: ${campaignCount > 0 ? '✅' : '❌'} ${campaignCount > 0 ? `(${campaignCount} total, ${activeCampaigns} active)` : ''}`)

    // 4. Prospects
    const { data: prospects } = await supabase
      .from('campaign_prospects')
      .select('id, campaigns!inner(workspace_id)')
      .eq('campaigns.workspace_id', workspace.id)

    const prospectCount = prospects?.length || 0
    
    console.log(`   👥 Prospects: ${prospectCount > 0 ? '✅' : '✓' } (${prospectCount} total)`)

    // 5. Approved Prospects (waiting for campaign)
    const { data: approved } = await supabase
      .from('prospect_approval_data')
      .select('id')
      .eq('workspace_id', workspace.id)
      .eq('status', 'approved')

    const approvedCount = approved?.length || 0
    
    console.log(`   ✅ Approved Prospects: ${approvedCount > 0 ? '✓' : '-'} (${approvedCount} ready)`)

    // 6. Members
    const { data: members } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace.id)

    const memberCount = members?.length || 0
    const owners = members?.filter(m => m.role === 'owner').length || 0
    
    console.log(`   👤 Members: ${memberCount} (${owners} owner${owners !== 1 ? 's' : ''})`)

    // 7. Check for missing critical features
    const issues = []
    if (!hasLinkedIn) issues.push('No LinkedIn account connected')
    if (kbCount === 0) issues.push('No knowledge base documents')
    if (campaignCount === 0 && approvedCount === 0) issues.push('No campaigns or prospects')
    
    if (issues.length > 0) {
      console.log(`\n   ⚠️  Issues:`)
      issues.forEach(issue => console.log(`      - ${issue}`))
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('\n✅ Audit Complete\n')

  // Summary
  const withLinkedIn = workspaces.filter(async w => {
    const { data } = await supabase
      .from('workspace_accounts')
      .select('id')
      .eq('workspace_id', w.id)
      .eq('account_type', 'linkedin')
      .limit(1)
    return data && data.length > 0
  }).length

  console.log('📊 Summary:')
  console.log(`   Total Workspaces: ${workspaces.length}`)
  console.log(`   With LinkedIn: ${withLinkedIn}/${workspaces.length}`)
}

main().catch(console.error)
