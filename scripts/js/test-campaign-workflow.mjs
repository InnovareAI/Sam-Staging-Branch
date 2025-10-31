#!/usr/bin/env node
/**
 * Test SAM Master Campaign Orchestrator
 * Usage: node test-campaign-workflow.mjs [campaignId] [maxProspects]
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
const SUPABASE_SERVICE_KEY = getEnvValue('SUPABASE_SERVICE_ROLE_KEY')
const UNIPILE_DSN = getEnvValue('UNIPILE_DSN')
const UNIPILE_API_KEY = getEnvValue('UNIPILE_API_KEY')
const N8N_WEBHOOK_URL = getEnvValue('N8N_CAMPAIGN_WEBHOOK_URL')

const campaignId = process.argv[2]
const maxProspects = parseInt(process.argv[3] || '1')

if (!campaignId) {
  console.error('❌ Usage: node test-campaign-workflow.mjs <campaignId> [maxProspects]')
  process.exit(1)
}

console.log('🧪 Testing SAM Master Campaign Orchestrator')
console.log('   Campaign ID:', campaignId)
console.log('   Max Prospects:', maxProspects)
console.log('   Webhook:', N8N_WEBHOOK_URL)
console.log()

function httpsRequest(url, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`))
        } else {
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            resolve(data)
          }
        }
      })
    })

    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

async function main() {
  // Step 1: Fetch campaign data
  console.log('📥 Fetching campaign data...')

  const { data: campaign, error: campaignError } = await httpsRequest(
    `${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}&select=*`,
    'GET',
    null,
    {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  ).then(data => ({ data: data[0], error: null }))
    .catch(error => ({ data: null, error }))

  if (campaignError || !campaign) {
    console.error('❌ Failed to fetch campaign:', campaignError?.message)
    return
  }

  console.log('✅ Campaign:', campaign.name)
  console.log('   Workspace:', campaign.workspace_id)
  console.log('   Type:', campaign.campaign_type)
  console.log()

  // Step 2: Fetch prospects
  console.log('📥 Fetching prospects...')

  const { data: prospects, error: prospectsError } = await httpsRequest(
    `${SUPABASE_URL}/rest/v1/campaign_prospects?campaign_id=eq.${campaignId}&status=in.(pending,approved,ready_to_message)&limit=${maxProspects}&select=*`,
    'GET',
    null,
    {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  ).then(data => ({ data, error: null }))
    .catch(error => ({ data: null, error }))

  if (prospectsError || !prospects || prospects.length === 0) {
    console.error('❌ No prospects found or error:', prospectsError?.message)
    return
  }

  console.log(`✅ Found ${prospects.length} prospect(s):`)
  prospects.forEach(p => {
    console.log(`   - ${p.first_name} ${p.last_name} (${p.linkedin_url || 'No LinkedIn'})`)
  })
  console.log()

  // Step 3: Get Unipile account
  console.log('📥 Fetching Unipile account...')

  const { data: accounts, error: accountError } = await httpsRequest(
    `${SUPABASE_URL}/rest/v1/workspace_accounts?workspace_id=eq.${campaign.workspace_id}&is_active=eq.true&select=*`,
    'GET',
    null,
    {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  ).then(data => ({ data, error: null }))
    .catch(error => ({ data: null, error }))

  if (accountError || !accounts || accounts.length === 0) {
    console.error('❌ No active Unipile account found')
    return
  }

  const unipileAccountId = accounts[0].unipile_account_id
  console.log('✅ Unipile Account:', unipileAccountId)
  console.log()

  // Step 4: Build webhook payload
  const payload = {
    workspaceId: campaign.workspace_id,
    campaignId: campaign.id,
    unipileAccountId: unipileAccountId,
    prospects: prospects.map(p => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      linkedin_url: p.linkedin_url,
      linkedin_user_id: p.linkedin_user_id
    })),
    messages: campaign.messages || {
      cr: campaign.connection_request_template,
      fu1: 'Follow-up message 1',
      fu2: 'Follow-up message 2',
      fu3: 'Follow-up message 3',
      fu4: 'Follow-up message 4',
      gb: 'Goodbye message'
    },
    timing: campaign.timing || {
      fu1_delay_days: 2,
      fu2_delay_days: 5,
      fu3_delay_days: 7,
      fu4_delay_days: 5,
      gb_delay_days: 7
    },
    supabase_url: SUPABASE_URL,
    supabase_service_key: SUPABASE_SERVICE_KEY,
    unipile_dsn: UNIPILE_DSN,
    unipile_api_key: UNIPILE_API_KEY
  }

  console.log('📤 Sending to n8n webhook...')
  console.log('   URL:', N8N_WEBHOOK_URL)
  console.log()

  try {
    const response = await httpsRequest(N8N_WEBHOOK_URL, 'POST', payload)
    console.log('✅ Webhook Response:', response)
    console.log()
    console.log('📋 Next Steps:')
    console.log('1. Check n8n execution logs: https://innovareai.app.n8n.cloud/workflow/2bmFPN5t2y6A4Rx2')
    console.log('2. Monitor prospect status in Supabase')
    console.log('3. Verify LinkedIn connection requests sent')
  } catch (error) {
    console.error('❌ Webhook Error:', error.message)
  }
}

main().catch(console.error)
