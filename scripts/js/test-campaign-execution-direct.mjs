#!/usr/bin/env node
/**
 * Test campaign execution by calling Sam App API directly
 * This will show the full error response
 */
import https from 'https'

const CAMPAIGN_ID = 'ade10177-afe6-4770-a64d-b4ac0928b66a'
const SAM_APP_URL = 'https://app.meet-sam.com'

// This simulates what the n8n scheduler does
const payload = {
  campaignId: CAMPAIGN_ID,
  maxProspects: 2,
  dryRun: false
}

console.log('🧪 Testing Campaign Execution\n')
console.log('Campaign ID:', CAMPAIGN_ID)
console.log('Payload:', JSON.stringify(payload, null, 2))
console.log('\n📡 Calling Sam App API...\n')

const url = new URL(`${SAM_APP_URL}/api/campaigns/linkedin/execute-live`)

const options = {
  hostname: url.hostname,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-internal-trigger': 'cron-pending-prospects'  // Bypass auth for scheduler (must match route.ts)
  }
}

const req = https.request(options, (res) => {
  let data = ''

  res.on('data', (chunk) => {
    data += chunk
  })

  res.on('end', () => {
    console.log('📥 Response Status:', res.statusCode)
    console.log('📥 Response Headers:', JSON.stringify(res.headers, null, 2))
    console.log('\n📥 Response Body:')

    try {
      const parsed = JSON.parse(data)
      console.log(JSON.stringify(parsed, null, 2))

      if (parsed.error) {
        console.log('\n❌ ERROR FOUND:')
        console.log('   Error:', parsed.error)
        console.log('   Details:', parsed.details)
        if (parsed.troubleshooting) {
          console.log('\n🔧 Troubleshooting:')
          Object.entries(parsed.troubleshooting).forEach(([key, value]) => {
            console.log(`   ${key}: ${value}`)
          })
        }
      } else if (parsed.n8n_triggered) {
        console.log('\n✅ SUCCESS! N8N workflow triggered')
        console.log('   Prospects queued:', parsed.prospects_processed || 0)
      } else {
        console.log('\n⚠️  Response received but N8N not triggered')
      }
    } catch (e) {
      console.log(data)
    }
  })
})

req.on('error', (error) => {
  console.error('❌ Request Error:', error.message)
})

req.write(JSON.stringify(payload))
req.end()
