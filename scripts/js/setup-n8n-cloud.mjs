#!/usr/bin/env node
/**
 * Set up n8n Cloud workspace and create campaign workflow
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
  console.log('🚀 Setting up n8n Cloud Workspace\n')
  console.log('URL:', `https://${N8N_CLOUD_URL}`)
  console.log('API Key:', N8N_CLOUD_API_KEY.substring(0, 20) + '...\n')

  // Test connection
  console.log('1️⃣ Testing n8n Cloud API connection...')
  try {
    const workflows = await httpsRequest('/workflows')
    console.log(`   ✅ Connected! Found ${workflows.data?.length || 0} existing workflows\n`)
  } catch (error) {
    console.error('   ❌ Connection failed:', error.message)
    return
  }

  // Create campaign workflow from JSON
  console.log('2️⃣ Importing workflow from JSON...')
  
  const workflow = {
    name: 'SAM Campaign Execution',
    nodes: [
      {
        name: 'Campaign Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        position: [250, 300],
        parameters: {
          path: 'campaign-execute',
          httpMethod: 'POST',
          responseMode: 'onReceived',
          options: {}
        }
      },
      {
        name: 'Extract Campaign Data',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [450, 300],
        parameters: {
          language: 'javaScript',
          jsCode: `const webhookData = $input.first().json.body || $input.first().json;

return {
  workspace_id: webhookData.workspaceId,
  campaign_id: webhookData.campaignId,
  unipile_account_id: webhookData.unipileAccountId,
  prospects: webhookData.prospects || [],
  messages: webhookData.messages || {},
  supabase_url: webhookData.supabase_url,
  supabase_service_key: webhookData.supabase_service_key,
  unipile_dsn: webhookData.unipile_dsn,
  unipile_api_key: webhookData.unipile_api_key
};`
        }
      },
      {
        name: 'Process Each Prospect',
        type: 'n8n-nodes-base.splitInBatches',
        typeVersion: 3,
        position: [650, 300],
        parameters: {
          batchSize: 1,
          options: {}
        }
      },
      {
        name: 'Send LinkedIn Message',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4,
        position: [850, 300],
        parameters: {
          method: 'POST',
          url: '={{ "https://" + $json.unipile_dsn + "/api/v1/messaging" }}',
          authentication: 'none',
          sendHeaders: true,
          headerParameters: {
            parameters: [
              {
                name: 'X-API-KEY',
                value: '={{ $json.unipile_api_key }}'
              }
            ]
          },
          sendBody: true,
          contentType: 'json',
          body: '={{ { "account_id": $json.prospects[0].unipile_account_id, "attendees": [$json.prospects[0].linkedin_user_id], "text": $json.messages.cr, "type": "LINKEDIN" } }}',
          options: {}
        }
      }
    ],
    connections: {
      'Campaign Webhook': {
        main: [[{ node: 'Extract Campaign Data', type: 'main', index: 0 }]]
      },
      'Extract Campaign Data': {
        main: [[{ node: 'Process Each Prospect', type: 'main', index: 0 }]]
      },
      'Process Each Prospect': {
        main: [[{ node: 'Send LinkedIn Message', type: 'main', index: 0 }]]
      }
    },
    settings: {
      executionOrder: 'v1',
      saveManualExecutions: true,
      saveExecutionProgress: true,
      saveDataSuccessExecution: 'all',
      saveDataErrorExecution: 'all'
    }
  }

  try {
    const created = await httpsRequest('/workflows', 'POST', workflow)
    console.log('   ✅ Workflow created!')
    console.log('   ID:', created.id)
    console.log('   Name:', created.name)
    console.log('\n3️⃣ Webhook URL:')
    console.log(`   https://${N8N_CLOUD_URL}/webhook/campaign-execute\n`)
    
    console.log('✅ SETUP COMPLETE')
    console.log('\nNext steps:')
    console.log('1. Go to n8n Cloud UI and activate the workflow')
    console.log('2. Update .env.local with new n8n cloud settings')
    console.log('3. Test the webhook endpoint')
    
  } catch (error) {
    console.error('   ❌ Failed:', error.message)
  }
}

main().catch(console.error)
