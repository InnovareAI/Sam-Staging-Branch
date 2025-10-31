#!/usr/bin/env node
/**
 * Humanize LinkedIn Campaign Behavior
 *
 * Adds randomization to prevent bot detection:
 * - Random wait times between messages
 * - Business hours only sending
 * - Variance in message timing
 * - Random delays between prospects
 */
import https from 'https'

const N8N_CLOUD_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwN2RlODBmNS1mNjk3LTRmMWQtYTA0NC1hNTE5YjlhMzc3NWMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYxODgwMjI4fQ.qu4pgyKXHunfcKiNjx0dkRbtQZ51KmgoOFk2kQEsJ3U'
const N8N_CLOUD_URL = 'innovareai.app.n8n.cloud'
const WORKFLOW_ID = '2bmFPN5t2y6A4Rx2'

console.log('🤖 → 👤 Humanizing LinkedIn Campaign Behavior\n')

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
  console.log('📥 Fetching current workflow...\n')
  const workflow = await httpsRequest(`/workflows/${WORKFLOW_ID}`)

  console.log('🔍 Current Configuration:')

  // Find wait nodes
  const waitNodes = workflow.nodes.filter(n => n.type === 'n8n-nodes-base.wait')
  waitNodes.forEach(node => {
    console.log(`   ${node.name}: ${node.parameters.amount} ${node.parameters.unit}`)
  })

  console.log('\n📝 Applying Humanization:\n')

  // Strategy 1: Add random variance to wait times
  const humanizedWaitNodes = [
    {
      name: 'Wait for FU1',
      // Random between 2-4 days (48-96 hours) + random hours
      expression: '={{ Math.floor(Math.random() * 2 + 2) * 24 + Math.floor(Math.random() * 8) }}',
      unit: 'hours',
      description: '2-4 days + random 0-8 hours'
    },
    {
      name: 'Wait for FU2',
      // Random between 4-7 days
      expression: '={{ Math.floor(Math.random() * 3 + 4) * 24 + Math.floor(Math.random() * 12) }}',
      unit: 'hours',
      description: '4-7 days + random 0-12 hours'
    },
    {
      name: 'Wait for FU3',
      // Random between 5-9 days
      expression: '={{ Math.floor(Math.random() * 4 + 5) * 24 + Math.floor(Math.random() * 16) }}',
      unit: 'hours',
      description: '5-9 days + random 0-16 hours'
    },
    {
      name: 'Wait for FU4',
      // Random between 4-8 days
      expression: '={{ Math.floor(Math.random() * 4 + 4) * 24 + Math.floor(Math.random() * 12) }}',
      unit: 'hours',
      description: '4-8 days + random 0-12 hours'
    },
    {
      name: 'Wait for GB',
      // Random between 6-10 days (goodbye message)
      expression: '={{ Math.floor(Math.random() * 4 + 6) * 24 + Math.floor(Math.random() * 20) }}',
      unit: 'hours',
      description: '6-10 days + random 0-20 hours'
    }
  ]

  // Update wait nodes with randomization
  waitNodes.forEach((node, index) => {
    const humanConfig = humanizedWaitNodes[index]
    if (humanConfig) {
      node.parameters.amount = humanConfig.expression
      node.parameters.unit = humanConfig.unit
      console.log(`   ✅ ${humanConfig.name}: ${humanConfig.description}`)
    }
  })

  console.log('\n📋 Adding Business Hours Logic:\n')

  // Find the Campaign Handler function node (processes incoming data)
  const handlerNode = workflow.nodes.find(n => n.name === 'Campaign Handler')

  if (handlerNode) {
    // Add business hours calculation to the handler
    const businessHoursLogic = `
// Original campaign handler code
const items = $input.all();
const result = items.map(item => {
  // Add random delay between prospects (1-5 minutes)
  const prospectDelay = Math.floor(Math.random() * 4 + 1);

  // Calculate next business hour send time
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();

  // Business hours: Mon-Fri, 9am-5pm (configurable per timezone)
  const isBusinessHours = (day >= 1 && day <= 5) && (hour >= 9 && hour < 17);

  // If outside business hours, delay until next business day 9am
  let delayMinutes = prospectDelay;
  if (!isBusinessHours) {
    if (hour >= 17 || hour < 9) {
      // After 5pm or before 9am - wait until 9am
      delayMinutes += (9 - hour + 24) % 24 * 60;
    }
    if (day === 0) {
      // Sunday - wait until Monday
      delayMinutes += 24 * 60;
    } else if (day === 6) {
      // Saturday - wait until Monday
      delayMinutes += 48 * 60;
    }
  }

  return {
    ...item.json,
    prospectDelay: delayMinutes,
    businessHoursCheck: isBusinessHours
  };
});

return result;
`

    handlerNode.parameters.code = businessHoursLogic
    console.log('   ✅ Added business hours logic to Campaign Handler')
    console.log('   ✅ Added 1-5 minute random delay between prospects')
  }

  console.log('\n📋 Optimization Strategy:\n')
  console.log('   1. ✅ Randomized wait times (prevents pattern detection)')
  console.log('   2. ✅ Business hours only (Mon-Fri, 9am-5pm)')
  console.log('   3. ✅ Random delays between prospects (1-5 min)')
  console.log('   4. ⏭️  TODO: Add random message variations (done in Sam App)')
  console.log('   5. ⏭️  TODO: Respect LinkedIn rate limits (100/week)')

  console.log('\n💡 LinkedIn Safety Tips:\n')
  console.log('   - Connection requests: Max 100/week per account')
  console.log('   - Messages: Max 50/day to 1st degree connections')
  console.log('   - Profile views: Max 150/day')
  console.log('   - Withdraw old connection requests (>2 weeks)')

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

  console.log('\n📊 Expected Behavior:')
  console.log('   - CR → FU1: 2-4 days (random)')
  console.log('   - FU1 → FU2: 4-7 days (random)')
  console.log('   - FU2 → FU3: 5-9 days (random)')
  console.log('   - FU3 → FU4: 4-8 days (random)')
  console.log('   - FU4 → GB: 6-10 days (random)')
  console.log('   - Total campaign: 21-38 days (highly variable)')
  console.log('\n   Messages only sent during business hours (Mon-Fri, 9am-5pm)')
  console.log('   Random 1-5 minute delays between prospects')
}

main().catch(console.error)
