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
  console.log('🔍 Checking Blue Label Labs Workspace\n')

  // Find workspace
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .select('*')
    .ilike('name', '%blue%label%')
    .single()

  if (wsError || !workspace) {
    console.error('❌ Workspace not found')
    process.exit(1)
  }

  console.log('✅ Workspace:', workspace.name)
  console.log('   ID:', workspace.id)
  console.log('   Tenant:', workspace.tenant)
  console.log('')

  // Get campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false })

  console.log(`📊 Campaigns: ${campaigns?.length || 0}`)
  if (campaigns && campaigns.length > 0) {
    campaigns.forEach(c => {
      console.log(`   - ${c.name} (${c.status}) [${c.campaign_type}]`)
    })
  }
  console.log('')

  // Get prospects
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*, campaigns(name)')
    .eq('campaigns.workspace_id', workspace.id)

  console.log(`👥 Campaign Prospects: ${prospects?.length || 0}`)
  console.log('')

  // Get approved prospects
  const { data: approved } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('workspace_id', workspace.id)
    .eq('status', 'approved')

  console.log(`✅ Approved Prospects: ${approved?.length || 0}`)
  console.log('')

  // Get knowledge base for ICP/templates
  const { data: kb } = await supabase
    .from('knowledge_base')
    .select('*')
    .eq('workspace_id', workspace.id)

  console.log(`📚 Knowledge Base Entries: ${kb?.length || 0}`)
  if (kb && kb.length > 0) {
    const icpDocs = kb.filter(k => k.metadata?.type === 'icp' || k.title?.toLowerCase().includes('icp'))
    console.log(`   - ICP Documents: ${icpDocs.length}`)
    
    const templates = kb.filter(k => k.metadata?.type === 'template' || k.title?.toLowerCase().includes('template'))
    console.log(`   - Templates: ${templates.length}`)
  }
}

main().catch(console.error)
