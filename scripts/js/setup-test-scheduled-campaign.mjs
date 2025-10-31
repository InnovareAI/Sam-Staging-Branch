#!/usr/bin/env node
/**
 * Setup test scheduled campaign for end-to-end testing
 * This will:
 * 1. Find or create a test campaign
 * 2. Add test prospect with LinkedIn URL
 * 3. Set campaign to scheduled with next_execution_time in the past
 * 4. Verify setup is ready for scheduler to pick up
 */
import https from 'https'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
const envPath = join(__dirname, '../../.env.local')
const envContent = readFileSync(envPath, 'utf8')

function getEnvValue(key) {
  const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'))
  return match ? match[1].trim() : null
}

const SUPABASE_URL = getEnvValue('NEXT_PUBLIC_SUPABASE_URL')
const SUPABASE_KEY = getEnvValue('SUPABASE_SERVICE_ROLE_KEY')

function supabaseRequest(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}${endpoint}`)

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : null
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`))
          } else {
            resolve(parsed)
          }
        } catch (e) {
          reject(e)
        }
      })
    })

    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

async function main() {
  console.log('🧪 Setting up End-to-End Test Campaign\n')

  // Step 1: Find an existing campaign or use a specific workspace
  console.log('📋 Step 1: Finding campaigns...')

  const campaigns = await supabaseRequest('/rest/v1/campaigns?select=id,name,workspace_id,status&order=created_at.desc&limit=5')

  if (!campaigns || campaigns.length === 0) {
    console.error('❌ No campaigns found. Please create a campaign first.')
    return
  }

  console.log(`✅ Found ${campaigns.length} campaigns:`)
  campaigns.forEach((c, i) => {
    console.log(`   ${i + 1}. ${c.name} (${c.id}) - Status: ${c.status}`)
  })

  // Use the first campaign for testing
  const testCampaign = campaigns[0]
  console.log(`\n🎯 Using campaign: ${testCampaign.name} (${testCampaign.id})`)

  // Step 2: Check if campaign has prospects
  console.log('\n📋 Step 2: Checking campaign prospects...')

  const prospects = await supabaseRequest(
    `/rest/v1/campaign_prospects?campaign_id=eq.${testCampaign.id}&select=id,first_name,last_name,linkedin_url,status&limit=5`
  )

  if (!prospects || prospects.length === 0) {
    console.log('⚠️  No prospects found. Creating test prospect...')

    // Create a test prospect in workspace_prospects first
    const workspaceProspect = await supabaseRequest(
      '/rest/v1/workspace_prospects',
      'POST',
      {
        workspace_id: testCampaign.workspace_id,
        first_name: 'Test',
        last_name: 'Scheduler',
        company_name: 'N8N Test Co',
        job_title: 'QA Engineer',
        linkedin_profile_url: 'https://www.linkedin.com/in/test-scheduler',
        email_address: 'test.scheduler@example.com'
      }
    )

    console.log('✅ Created workspace prospect:', workspaceProspect[0].id)

    // Add to campaign
    const campaignProspect = await supabaseRequest(
      '/rest/v1/campaign_prospects',
      'POST',
      {
        campaign_id: testCampaign.id,
        prospect_id: workspaceProspect[0].id,
        workspace_id: testCampaign.workspace_id,
        first_name: 'Test',
        last_name: 'Scheduler',
        linkedin_url: 'https://www.linkedin.com/in/test-scheduler',
        status: 'pending'
      }
    )

    console.log('✅ Added to campaign:', campaignProspect[0].id)
  } else {
    console.log(`✅ Found ${prospects.length} prospects:`)
    prospects.forEach(p => {
      console.log(`   - ${p.first_name} ${p.last_name} (${p.status})`)
    })
  }

  // Step 3: Get Unipile account for the workspace
  console.log('\n📋 Step 3: Checking Unipile account...')

  const accounts = await supabaseRequest(
    `/rest/v1/workspace_accounts?workspace_id=eq.${testCampaign.workspace_id}&is_active=eq.true&select=id,unipile_account_id,account_type`
  )

  if (!accounts || accounts.length === 0) {
    console.error('❌ No active Unipile account found for this workspace')
    console.log('   Please connect a LinkedIn account in the workspace settings')
    return
  }

  console.log('✅ Found active account:', accounts[0].unipile_account_id)

  // Step 4: Set campaign messages
  console.log('\n📋 Step 4: Setting campaign messages...')

  const messages = {
    cr: 'Hi {{first_name}}, this is an automated test from the N8N scheduler. Please ignore!',
    fu1: 'Test follow-up 1 - Automated message',
    fu2: 'Test follow-up 2 - Automated message',
    fu3: 'Test follow-up 3 - Automated message',
    fu4: 'Test follow-up 4 - Automated message',
    gb: 'Test goodbye - Automated message'
  }

  await supabaseRequest(
    `/rest/v1/campaigns?id=eq.${testCampaign.id}`,
    'PATCH',
    { messages: messages }
  )

  console.log('✅ Campaign messages configured')

  // Step 5: Set campaign to scheduled with past execution time
  console.log('\n📋 Step 5: Setting campaign to scheduled...')

  const pastTime = new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 minutes ago

  await supabaseRequest(
    `/rest/v1/campaigns?id=eq.${testCampaign.id}`,
    'PATCH',
    {
      status: 'scheduled',
      auto_execute: true,
      next_execution_time: pastTime
    }
  )

  console.log('✅ Campaign configured for immediate pickup')
  console.log('   Status: scheduled')
  console.log('   Auto Execute: true')
  console.log('   Next Execution: ', pastTime, '(in the past)')

  console.log('\n🎉 TEST CAMPAIGN READY!\n')
  console.log('📋 Campaign Details:')
  console.log('   ID:', testCampaign.id)
  console.log('   Name:', testCampaign.name)
  console.log('   Workspace:', testCampaign.workspace_id)
  console.log('\n🧪 To Test End-to-End:')
  console.log('   1. Go to: https://innovareai.app.n8n.cloud/workflow/7QJZcRwQBI0wPRS4')
  console.log('   2. Click "Execute Workflow" to test manually')
  console.log('   3. Should find this campaign and trigger execution')
  console.log('   4. Check Master Orchestrator for new execution')
  console.log('   5. Verify in LinkedIn (if using real account)')
  console.log('\n⚠️  Note: This will send a REAL LinkedIn message if account is connected!')
  console.log('   Campaign is set to send test messages to: Test Scheduler')
}

main().catch(console.error)
