#!/usr/bin/env node
/**
 * Create N8N Scheduled Campaign Checker Workflow
 * This workflow runs every 2 minutes and triggers campaigns that are due
 */
import https from 'https'

const N8N_CLOUD_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwN2RlODBmNS1mNjk3LTRmMWQtYTA0NC1hNTE5YjlhMzc3NWMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYxODgwMjI4fQ.qu4pgyKXHunfcKiNjx0dkRbtQZ51KmgoOFk2kQEsJ3U'
const N8N_CLOUD_URL = 'innovareai.app.n8n.cloud'

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
  console.log('🚀 Creating N8N Scheduled Campaign Checker Workflow\n')

  const workflow = {
    name: 'SAM Scheduled Campaign Checker',
    nodes: [
      // 1. Schedule Trigger (every 2 minutes)
      {
        name: 'Schedule Trigger',
        type: 'n8n-nodes-base.scheduleTrigger',
        typeVersion: 1,
        position: [250, 300],
        parameters: {
          rule: {
            interval: [
              {
                field: 'minutes',
                minutesInterval: 2
              }
            ]
          }
        }
      },

      // 2. Check Supabase for Due Campaigns
      {
        name: 'Get Due Campaigns',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4,
        position: [450, 300],
        parameters: {
          method: 'GET',
          url: '={{ $env.SUPABASE_URL }}/rest/v1/campaigns',
          authentication: 'none',
          sendHeaders: true,
          headerParameters: {
            parameters: [
              {
                name: 'apikey',
                value: '={{ $env.SUPABASE_SERVICE_KEY }}'
              },
              {
                name: 'Authorization',
                value: '={{ "Bearer " + $env.SUPABASE_SERVICE_KEY }}'
              }
            ]
          },
          sendQuery: true,
          queryParameters: {
            parameters: [
              {
                name: 'status',
                value: 'eq.scheduled'
              },
              {
                name: 'auto_execute',
                value: 'eq.true'
              },
              {
                name: 'next_execution_time',
                value: '=lte.{{ $now.toISO() }}'
              },
              {
                name: 'select',
                value: 'id,name,workspace_id'
              }
            ]
          },
          options: {}
        }
      },

      // 3. Check if any campaigns found
      {
        name: 'Any Campaigns Due?',
        type: 'n8n-nodes-base.if',
        typeVersion: 2,
        position: [650, 300],
        parameters: {
          conditions: {
            options: {
              caseSensitive: true
            },
            conditions: [
              {
                leftValue: '={{ $json.length }}',
                rightValue: '0',
                operator: {
                  type: 'number',
                  operation: 'larger'
                }
              }
            ]
          },
          options: {}
        }
      },

      // 4. Split campaigns into individual items
      {
        name: 'Process Each Campaign',
        type: 'n8n-nodes-base.splitOut',
        typeVersion: 1,
        position: [850, 200],
        parameters: {
          options: {}
        }
      },

      // 5. Trigger Sam App Execution
      {
        name: 'Trigger Campaign Execution',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4,
        position: [1050, 200],
        parameters: {
          method: 'POST',
          url: '={{ $env.SAM_API_URL }}/api/campaigns/linkedin/execute-live',
          authentication: 'none',
          sendHeaders: true,
          headerParameters: {
            parameters: [
              {
                name: 'Content-Type',
                value: 'application/json'
              },
              {
                name: 'x-internal-trigger',
                value: 'n8n-scheduler'
              }
            ]
          },
          sendBody: true,
          contentType: 'json',
          body: '={{ { "campaignId": $json.id, "maxProspects": 1, "dryRun": false } }}',
          options: {}
        }
      },

      // 6. Log Success
      {
        name: 'Log Success',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [1250, 200],
        parameters: {
          language: 'javaScript',
          jsCode: `console.log('✅ Executed campaign:', $json.campaign_name);
console.log('   Campaign ID:', $(\"Process Each Campaign\").item.json.id);
console.log('   Workspace:', $(\"Process Each Campaign\").item.json.workspace_id);
return $input.all();`
        }
      },

      // 7. No Campaigns Branch
      {
        name: 'No Campaigns Due',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [850, 400],
        parameters: {
          language: 'javaScript',
          jsCode: `console.log('ℹ️  No campaigns due for execution');
return { message: 'No campaigns due', checked_at: new Date().toISOString() };`
        }
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
          [{ node: 'Process Each Campaign', type: 'main', index: 0 }],
          [{ node: 'No Campaigns Due', type: 'main', index: 0 }]
        ]
      },
      'Process Each Campaign': {
        main: [[{ node: 'Trigger Campaign Execution', type: 'main', index: 0 }]]
      },
      'Trigger Campaign Execution': {
        main: [[{ node: 'Log Success', type: 'main', index: 0 }]]
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

  console.log('📤 Creating scheduled workflow in n8n Cloud...')

  try {
    const created = await httpsRequest('/workflows', 'POST', workflow)
    console.log('\n✅ SCHEDULED WORKFLOW CREATED!\n')
    console.log('ID:', created.id)
    console.log('Name:', created.name)
    console.log('\n⏰ Schedule: Every 2 minutes')
    console.log('\n📋 Next Steps:')
    console.log('1. Go to n8n Cloud: https://innovareai.app.n8n.cloud/workflow/' + created.id)
    console.log('2. Set these environment variables in workflow settings:')
    console.log('   - SUPABASE_URL')
    console.log('   - SUPABASE_SERVICE_KEY')
    console.log('   - SAM_API_URL')
    console.log('3. Activate the workflow')
    console.log('\n✨ The workflow will automatically check for due campaigns every 2 minutes!')

  } catch (error) {
    console.error('\n❌ Error:', error.message)
  }
}

main().catch(console.error)
