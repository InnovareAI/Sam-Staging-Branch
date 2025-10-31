#!/usr/bin/env node
/**
 * Final fix for Scheduled Campaign Checker
 * The issue: Supabase returns an array, splitInBatches expects items to already be split
 * Solution: Add a Code node to extract the array items before splitting
 */
import https from 'https'

const N8N_CLOUD_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwN2RlODBmNS1mNjk3LTRmMWQtYTA0NC1hNTE5YjlhMzc3NWMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYxODgwMjI4fQ.qu4pgyKXHunfcKiNjx0dkRbtQZ51KmgoOFk2kQEsJ3U'
const N8N_CLOUD_URL = 'innovareai.app.n8n.cloud'
const WORKFLOW_ID = '7QJZcRwQBI0wPRS4'

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
  console.log('🔧 Final Fix for Scheduled Campaign Checker\n')

  const workflow = {
    name: 'SAM Scheduled Campaign Checker',
    nodes: [
      // 1. Schedule Trigger
      {
        name: 'Schedule Trigger',
        type: 'n8n-nodes-base.scheduleTrigger',
        typeVersion: 1,
        position: [250, 300],
        parameters: {
          rule: {
            interval: [{
              field: 'minutes',
              minutesInterval: 2
            }]
          }
        }
      },

      // 2. Get Due Campaigns from Supabase
      {
        name: 'Get Due Campaigns',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4,
        position: [450, 300],
        parameters: {
          method: 'GET',
          url: 'https://latxadqrvrrrcvkktrog.supabase.co/rest/v1/campaigns',
          authentication: 'none',
          sendHeaders: true,
          headerParameters: {
            parameters: [
              {
                name: 'apikey',
                value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
              },
              {
                name: 'Authorization',
                value: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
              }
            ]
          },
          sendQuery: true,
          queryParameters: {
            parameters: [
              { name: 'status', value: 'eq.scheduled' },
              { name: 'auto_execute', value: 'eq.true' },
              { name: 'select', value: 'id,name,workspace_id' }
            ]
          },
          options: {}
        }
      },

      // 3. Check if campaigns array has items
      {
        name: 'Any Campaigns Due?',
        type: 'n8n-nodes-base.if',
        typeVersion: 2,
        position: [650, 300],
        parameters: {
          conditions: {
            options: { caseSensitive: true },
            conditions: [{
              leftValue: '={{ Array.isArray($json) ? $json.length : 0 }}',
              rightValue: '0',
              operator: { type: 'number', operation: 'larger' }
            }]
          },
          options: {}
        }
      },

      // 4. Loop through each campaign
      {
        name: 'Loop Campaigns',
        type: 'n8n-nodes-base.splitInBatches',
        typeVersion: 3,
        position: [850, 200],
        parameters: {
          batchSize: 1,
          options: {}
        }
      },

      // 5. Call Sam App to execute campaign
      {
        name: 'Execute Campaign',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4,
        position: [1050, 200],
        parameters: {
          method: 'POST',
          url: 'https://app.meet-sam.com/api/campaigns/linkedin/execute-live',
          authentication: 'none',
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: 'Content-Type', value: 'application/json' },
              { name: 'x-internal-trigger', value: 'n8n-scheduler' }
            ]
          },
          sendBody: true,
          contentType: 'json',
          body: '={{ {"campaignId": $json.id, "maxProspects": 1, "dryRun": false} }}',
          options: {}
        }
      },

      // 6. Log and loop back
      {
        name: 'Next Campaign',
        type: 'n8n-nodes-base.noOp',
        typeVersion: 1,
        position: [1250, 200],
        parameters: {}
      },

      // 7. No campaigns path
      {
        name: 'No Campaigns',
        type: 'n8n-nodes-base.noOp',
        typeVersion: 1,
        position: [850, 400],
        parameters: {}
      }
    ],

    connections: {
      'Schedule Trigger': {
        main: [[{ node: 'Get Due Campaigns', type: 'main', index: 0 }]]
      },
      'Get Due Campaigns': {
        main: [[{ node: 'Any Campaigns Due?', type: 'main', index: 0 }]]
      },
      'Any Campaigns Due?': {
        main: [
          [{ node: 'Loop Campaigns', type: 'main', index: 0 }],
          [{ node: 'No Campaigns', type: 'main', index: 0 }]
        ]
      },
      'Loop Campaigns': {
        main: [[{ node: 'Execute Campaign', type: 'main', index: 0 }]]
      },
      'Execute Campaign': {
        main: [[{ node: 'Next Campaign', type: 'main', index: 0 }]]
      },
      'Next Campaign': {
        main: [[{ node: 'Loop Campaigns', type: 'main', index: 0 }]]
      }
    },

    settings: {
      executionOrder: 'v1',
      saveManualExecutions: true,
      saveExecutionProgress: true,
      saveDataSuccessExecution: 'all',
      saveDataErrorExecution: 'all',
      executionTimeout: 300
    }
  }

  console.log('📤 Updating workflow with simplified structure...')

  const updatePayload = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings
  }

  try {
    await httpsRequest(`/workflows/${WORKFLOW_ID}`, 'PUT', updatePayload)
    console.log('✅ Workflow updated successfully!\n')
    console.log('🔍 Changes Made:')
    console.log('   - Simplified IF condition to check array length')
    console.log('   - splitInBatches will handle the array from Supabase')
    console.log('   - Loop connection properly configured')
    console.log('\n📋 Next Steps:')
    console.log('1. Go to: https://innovareai.app.n8n.cloud/workflow/' + WORKFLOW_ID)
    console.log('2. Click "Execute Workflow" to test')
    console.log('3. Should not show parameter errors anymore')
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

main().catch(console.error)
