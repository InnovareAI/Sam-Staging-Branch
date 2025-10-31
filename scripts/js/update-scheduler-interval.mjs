#!/usr/bin/env node
/**
 * Update Scheduled Campaign Checker interval to reduce n8n operations
 * Current: Every 2 minutes = 86,400 ops/month
 * Options: 15 min (11,520 ops) or 30 min (5,760 ops)
 */
import https from 'https'

const N8N_CLOUD_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwN2RlODBmNS1mNjk3LTRmMWQtYTA0NC1hNTE5YjlhMzc3NWMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYxODgwMjI4fQ.qu4pgyKXHunfcKiNjx0dkRbtQZ51KmgoOFk2kQEsJ3U'
const N8N_CLOUD_URL = 'innovareai.app.n8n.cloud'
const WORKFLOW_ID = '7QJZcRwQBI0wPRS4'

// Choose interval: 15 or 30 minutes
const NEW_INTERVAL_MINUTES = process.argv[2] ? parseInt(process.argv[2]) : 15

console.log(`🔧 Updating Scheduled Campaign Checker interval to ${NEW_INTERVAL_MINUTES} minutes\n`)

function httpsRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: N8N_CLOUD_URL,
      path: `/api/v1${path}`,
      method,
      headers: {
        'X-N8N-API-KEY': N8N_CLOUD_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
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
  // Get current workflow
  console.log('📥 Fetching current workflow...')
  const workflow = await httpsRequest(`/workflows/${WORKFLOW_ID}`)

  // Find Schedule Trigger node
  const scheduleTriggerNode = workflow.nodes.find(n => n.type === 'n8n-nodes-base.scheduleTrigger')

  if (!scheduleTriggerNode) {
    console.error('❌ Schedule Trigger node not found')
    return
  }

  console.log('📋 Current interval:', scheduleTriggerNode.parameters.rule.interval[0])

  // Update interval
  scheduleTriggerNode.parameters.rule.interval = [{
    field: 'minutes',
    minutesInterval: NEW_INTERVAL_MINUTES
  }]

  console.log('📝 New interval:', scheduleTriggerNode.parameters.rule.interval[0])

  // Calculate cost savings
  const currentOps = (60 / 2) * 24 * 30 * 4  // 2 min interval
  const newOps = (60 / NEW_INTERVAL_MINUTES) * 24 * 30 * 4
  const savings = currentOps - newOps
  const savingsPercent = ((savings / currentOps) * 100).toFixed(0)

  console.log('\n💰 Cost Impact:')
  console.log(`   Current (2 min): ${currentOps.toLocaleString()} operations/month`)
  console.log(`   New (${NEW_INTERVAL_MINUTES} min): ${newOps.toLocaleString()} operations/month`)
  console.log(`   Savings: ${savings.toLocaleString()} operations (${savingsPercent}%)`)

  if (newOps > 50000) {
    console.log('\n⚠️  WARNING: Still exceeds 50,000 operation limit!')
    console.log('   Consider increasing interval to 30 minutes or using webhooks')
  } else {
    console.log(`\n✅ Within 50,000 operation limit (${(50000 - newOps).toLocaleString()} operations remaining)`)
  }

  // Update workflow
  console.log('\n📤 Updating workflow...')

  const updatePayload = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings
  }

  await httpsRequest(`/workflows/${WORKFLOW_ID}`, 'PUT', updatePayload)

  console.log('✅ Workflow updated successfully!')
  console.log(`\n🔍 Verify at: https://innovareai.app.n8n.cloud/workflow/${WORKFLOW_ID}`)
  console.log(`\n⏰ Campaigns will now be checked every ${NEW_INTERVAL_MINUTES} minutes`)
}

main().catch(console.error)
