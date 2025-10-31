#!/usr/bin/env node
/**
 * Setup Michelle's campaign for scheduled execution test
 */
import https from 'https'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

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
  console.log('🔍 Finding Michelle\'s Campaigns\n')

  // Find workspaces (look for Michelle's workspace)
  const workspaces = await supabaseRequest('/rest/v1/workspaces?select=id,name,created_at&order=created_at.desc&limit=20')

  console.log(`Found ${workspaces.length} workspaces:\n`)
  workspaces.forEach((w, i) => {
    console.log(`${i + 1}. ${w.name} (${w.id})`)
  })

  // Let user choose or we can search for campaigns across all workspaces
  console.log('\n📋 Searching for campaigns with prospects...\n')

  const campaigns = await supabaseRequest(
    '/rest/v1/campaigns?select=id,name,workspace_id,status,workspaces(name)&order=created_at.desc&limit=10'
  )

  console.log(`Found ${campaigns.length} campaigns:\n`)
  campaigns.forEach((c, i) => {
    console.log(`${i + 1}. ${c.name}`)
    console.log(`   ID: ${c.id}`)
    console.log(`   Workspace: ${c.workspaces?.name || c.workspace_id}`)
    console.log(`   Status: ${c.status}`)
    console.log()
  })

  if (campaigns.length === 0) {
    console.error('❌ No campaigns found')
    return
  }

  // Use first campaign for now
  const testCampaign = campaigns[0]
  console.log(`\n🎯 Selected: ${testCampaign.name}\n`)

  // Check prospects
  const prospects = await supabaseRequest(
    `/rest/v1/campaign_prospects?campaign_id=eq.${testCampaign.id}&select=id,first_name,last_name,linkedin_url,status&limit=5`
  )

  console.log(`📊 Campaign has ${prospects.length} prospects:`)
  prospects.forEach(p => {
    console.log(`   - ${p.first_name} ${p.last_name} (${p.status})`)
    console.log(`     LinkedIn: ${p.linkedin_url || 'No URL'}`)
  })

  if (prospects.length === 0) {
    console.error('\n❌ No prospects in this campaign. Cannot test.')
    return
  }

  // Check if campaign has messages
  const campaignDetails = await supabaseRequest(
    `/rest/v1/campaigns?id=eq.${testCampaign.id}&select=messages`
  )

  if (!campaignDetails[0].messages || !campaignDetails[0].messages.cr) {
    console.log('\n⚠️  Campaign has no messages. Setting default test messages...')

    await supabaseRequest(
      `/rest/v1/campaigns?id=eq.${testCampaign.id}`,
      'PATCH',
      {
        messages: {
          cr: 'Hi {{first_name}}, I would love to connect!',
          fu1: 'Following up on my connection request.',
          fu2: 'Hope you are doing well!',
          fu3: 'Just checking in.',
          fu4: 'One more follow up.',
          gb: 'Thanks for considering!'
        }
      }
    )

    console.log('✅ Default messages set')
  } else {
    console.log('\n✅ Campaign has messages configured')
  }

  // Set to scheduled with past time
  console.log('\n🕐 Setting campaign to scheduled (5 minutes in the past)...')

  const pastTime = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  await supabaseRequest(
    `/rest/v1/campaigns?id=eq.${testCampaign.id}`,
    'PATCH',
    {
      status: 'scheduled',
      auto_execute: true,
      next_execution_time: pastTime
    }
  )

  console.log('✅ Campaign ready for scheduler pickup!')
  console.log('\n📋 Test Campaign Configuration:')
  console.log('   Campaign ID:', testCampaign.id)
  console.log('   Campaign Name:', testCampaign.name)
  console.log('   Workspace:', testCampaign.workspaces?.name || testCampaign.workspace_id)
  console.log('   Status: scheduled')
  console.log('   Auto Execute: true')
  console.log('   Next Execution:', pastTime)
  console.log('   Prospects:', prospects.length)

  console.log('\n🧪 TO TEST END-TO-END:')
  console.log('\n1. Manual Test First:')
  console.log('   https://innovareai.app.n8n.cloud/workflow/7QJZcRwQBI0wPRS4')
  console.log('   Click "Execute Workflow"')
  console.log('')
  console.log('2. Should trigger:')
  console.log('   → Scheduler finds this campaign')
  console.log('   → Calls Sam App execute-live API')
  console.log('   → Sam App triggers Master Orchestrator')
  console.log('   → Master Orchestrator sends LinkedIn message')
  console.log('')
  console.log('3. Verify:')
  console.log('   → Check Master Orchestrator executions')
  console.log('   → Check campaign_prospects status updated')
  console.log('   → Check LinkedIn for connection request')
  console.log('\n⚠️  WARNING: This will send REAL LinkedIn messages!')
  console.log(`   First prospect: ${prospects[0].first_name} ${prospects[0].last_name}`)
}

main().catch(console.error)
